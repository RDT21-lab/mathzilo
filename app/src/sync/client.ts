/* Sincronización con el servidor propio (server/sync-server.mjs).
   - La app escribe siempre en local; la cola `outbox` se envía cuando hay conexión.
   - Lo que llega del servidor se escribe directamente (sin volver a la cola).
   - Los canjes y sus correcciones exigen conexión: el servidor comprueba el PIN y el saldo. */
import { db, deviceId, getMeta, setMeta } from '../data/db';
import { getFamily, onLocalChange } from '../data/repo';
import type { StarEvent, SyncConfig, SyncTable } from '../data/types';

const ORDER: SyncTable[] = ['family', 'children', 'rewards', 'tasks', 'checks', 'sessions', 'answers', 'events', 'flags'];
const IMMUTABLE = new Set<SyncTable>(['sessions', 'answers', 'events', 'flags']);

export class SyncError extends Error {
  constructor(public code: string, public info: Record<string, unknown> = {}) { super(code); }
}
export interface SyncStatus { state: 'off' | 'idle' | 'busy' | 'offline' | 'error'; at: number; error?: string; pending: number }
let status: SyncStatus = { state: 'off', at: 0, pending: 0 };
const statusListeners = new Set<(s: SyncStatus) => void>();
export function onSyncStatus(f: (s: SyncStatus) => void) { statusListeners.add(f); f(status); return () => { statusListeners.delete(f); }; }
function setStatus(s: Partial<SyncStatus>) { status = { ...status, ...s }; statusListeners.forEach(f => f(status)); }

export const getSyncConfig = () => getMeta<SyncConfig | null>('sync', null);
/* Aviso cuando se crea, cambia o borra la configuración (para reconectar el tiempo real) */
const configListeners = new Set<() => void>();
const configChanged = () => configListeners.forEach(f => f());

/* PIN del modo padre en la tablet: eleva los cambios de ajustes durante 5 minutos */
let elevation: { pin: string; until: number } | null = null;
export function elevate(pin: string | null) { elevation = pin ? { pin, until: Date.now() + 5 * 60_000 } : null; }
/** Mientras el padre usa la tablet, el PIN sigue valiendo (el modo padre se cierra tras 5 minutos sin tocar nada) */
export function keepElevated() { if (elevation) elevation.until = Date.now() + 5 * 60_000; }

async function call(base: string, p: string, body: unknown, token?: string) {
  let r: Response;
  try {
    r = await fetch(base.replace(/\/+$/, '') + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  } catch { throw new SyncError('offline'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new SyncError(j.error ?? String(r.status), j);
  return j;
}

/* ---------- Alta y vinculación ---------- */
export async function register(url: string, email: string, password: string) {
  const j = await call(url, '/api/register', { email, password });
  await setMeta('sync', { url, token: j.token, role: 'parent', familyId: j.familyId, email } satisfies SyncConfig);
  await setMeta('syncCursor', 0);
  await enqueueEverything();
  await syncNow({ import: true });
  configChanged();
}
export async function login(url: string, email: string, password: string) {
  const j = await call(url, '/api/login', { email, password });
  await setMeta('sync', { url, token: j.token, role: 'parent', familyId: j.familyId, email } satisfies SyncConfig);
  await setMeta('syncCursor', 0);
  await syncNow();
  configChanged();
}
export async function pairCreate(): Promise<{ code: string; expiresIn: number }> {
  const c = await getSyncConfig();
  if (!c) throw new SyncError('sin-config');
  return call(c.url, '/api/pair/create', {}, c.token);
}
export async function pairClaim(url: string, code: string) {
  const j = await call(url, '/api/pair/claim', { code });
  await setMeta('sync', { url, token: j.token, role: 'tablet', familyId: j.familyId } satisfies SyncConfig);
  await setMeta('syncCursor', 0);
  await syncNow();
  configChanged();
}
export async function unlink() {
  await db.meta.delete('sync'); await db.meta.delete('syncCursor');
  setStatus({ state: 'off' });
  configChanged();
}
async function enqueueEverything() {
  for (const t of ORDER) {
    const ids = (await db.table(t).toCollection().primaryKeys()) as string[];
    if (ids.length) await db.outbox.bulkAdd(ids.map(id => ({ table: t, id, op: 'put' as const })));
  }
}

/* ---------- Sincronizar ---------- */
let running: Promise<void> | null = null, again = false;
export async function syncNow(opts: { import?: boolean } = {}): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    try { await doSync(opts); }
    finally { running = null; }
    if (again) { again = false; await syncNow(); }
  })();
  return running;
}
async function doSync(opts: { import?: boolean }, full = false) {
  const cfg = await getSyncConfig();
  if (!cfg) { setStatus({ state: 'off' }); return; }
  const fam = await getFamily();
  const items = await db.outbox.orderBy('seq').toArray();
  const maxSeq = items.length ? items[items.length - 1].seq! : 0;
  const last = new Map<string, typeof items[number]>();
  for (const it of items) last.set(it.table + ':' + it.id, it);
  const ordered = [...last.values()].sort((a, b) => ORDER.indexOf(a.table) - ORDER.indexOf(b.table) || a.seq! - b.seq!);
  const push: unknown[] = [];
  for (const it of ordered) {
    if (it.op === 'del') { push.push({ table: it.table, op: 'del', id: it.id }); continue; }
    const row = await db.table(it.table).get(it.id);
    if (row) push.push({ table: it.table, op: 'put', row });
  }
  setStatus({ state: 'busy', pending: push.length });
  const pin = elevation && elevation.until > Date.now() ? elevation.pin : undefined;
  // si esta versión conoce tablas nuevas, se pide todo una vez para recibir lo que antes no llegaba
  if (await getMeta('syncTables', '') !== ORDER.join()) full = true;
  let res: { seq: number; pull: { table: SyncTable; op: 'put' | 'del'; row?: { id: string; updatedAt?: number }; id?: string }[]; rejected: { table: SyncTable; id: string; error: string }[] };
  try {
    res = await call(cfg.url, '/api/sync', { since: full ? 0 : await getMeta('syncCursor', 0), push, tz: new Date().getTimezoneOffset(),
      dayStart: fam?.settings.dayStartHour ?? 4, import: !!opts.import, tables: ORDER, ...(pin && cfg.role !== 'parent' ? { pin } : {}) }, cfg.token);
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'error';
    setStatus({ state: code === 'offline' ? 'offline' : 'error', error: code, pending: push.length });
    return;
  }
  await applyPull(res.pull);
  // lo que el servidor rechaza no puede quedarse en local: los dos dispositivos deben cuadrar
  let needFull = false;
  for (const r of res.rejected) {
    // la copia local es más reciente que la del servidor: se quita para que la recarga traiga la buena
    if (r.table !== 'family') await db.table(r.table).delete(r.id);
    if (!IMMUTABLE.has(r.table)) needFull = true;
  }
  await db.outbox.where('seq').belowOrEqual(maxSeq).delete();
  await setMeta('syncCursor', res.seq);
  await setMeta('syncTables', ORDER.join());
  setStatus({ state: 'idle', at: Date.now(), pending: await db.outbox.count(), error: undefined });
  if (needFull && !full) await doSync({}, true);
}
async function applyPull(pull: { table: SyncTable; op: 'put' | 'del'; row?: { id: string; updatedAt?: number }; id?: string }[]) {
  if (!pull.length) return;
  await db.transaction('rw', [db.family, db.children, db.sessions, db.answers, db.events, db.rewards, db.mastery, db.meta, db.flags, db.tasks, db.checks], async () => {
    for (const p of pull) {
      const t = db.table(p.table);
      if (p.op === 'del') {
        const id = p.id!;
        await t.delete(id);
        if (p.table === 'children') {
          for (const x of [db.sessions, db.answers, db.events, db.mastery, db.flags, db.tasks, db.checks]) await x.where('childId').equals(id).delete();
          await db.meta.delete('active:' + id);
        }
        continue;
      }
      const row = p.row!;
      if (!IMMUTABLE.has(p.table)) {
        const cur = await t.get(row.id) as { updatedAt?: number } | undefined;
        if (cur && (cur.updatedAt ?? 0) > (row.updatedAt ?? 0)) continue;
      }
      await t.put(row);
    }
  });
}

/* ---------- Canjes con PIN en el servidor ---------- */
export async function redeemRemote(childId: string, amount: number, note: string, pin: string): Promise<StarEvent> {
  const cfg = (await getSyncConfig())!;
  const fam = await getFamily();
  const event = { id: crypto.randomUUID(), childId, type: 'canje', amount, note, device: await deviceId() };
  const j = await call(cfg.url, '/api/redeem', { event, pin, tz: new Date().getTimezoneOffset(), dayStart: fam?.settings.dayStartHour ?? 4 }, cfg.token);
  await db.events.put(j.event);
  syncNow();
  return j.event;
}
export async function compensateRemote(ref: StarEvent, pin: string): Promise<StarEvent> {
  const cfg = (await getSyncConfig())!;
  const fam = await getFamily();
  const event = { id: crypto.randomUUID(), childId: ref.childId, type: 'ajuste', ref: ref.id, note: '@ev.fix', device: await deviceId() };
  const j = await call(cfg.url, '/api/redeem', { event, pin, tz: new Date().getTimezoneOffset(), dayStart: fam?.settings.dayStartHour ?? 4 }, cfg.token);
  await db.events.put(j.event);
  syncNow();
  return j.event;
}
export async function deleteRemoteAccount(pin: string) {
  const cfg = await getSyncConfig();
  if (cfg) await call(cfg.url, '/api/account/delete', { pin }, cfg.token);
}

/* ---------- Avisos en el móvil del padre (Web Push) ----------
   El servidor avisa cuando un niño marca una tarea como hecha. El texto va cifrado de punta a
   punta: el servicio de avisos de Google o Apple solo transporta bytes ilegibles.            */
export type PushState = 'no-server' | 'unsupported' | 'need-install' | 'denied' | 'off' | 'on';
const pushApis = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export async function pushState(): Promise<PushState> {
  const cfg = await getSyncConfig();
  if (!cfg || cfg.role !== 'parent') return 'no-server';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!pushApis()) return ios && !installed ? 'need-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  return sub && sub.endpoint === await getMeta('pushEndpoint', '') ? 'on' : 'off';
}
function keyBytes(b64url: string): Uint8Array {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}
export async function enablePush(lang: string) {
  const cfg = await getSyncConfig();
  if (!cfg || cfg.role !== 'parent' || !pushApis()) throw new SyncError('push-no');
  if (await Notification.requestPermission() !== 'granted') throw new SyncError('push-permiso');
  let key: string;
  try { key = (await (await fetch(cfg.url.replace(/\/+$/, '') + '/api/push/key')).json()).key; } catch { throw new SyncError('offline'); }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && await getMeta('pushKey', '') !== key) { await sub.unsubscribe(); sub = null; }      // el servidor cambió de clave
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) as BufferSource });
  await call(cfg.url, '/api/push/subscribe', { sub: sub.toJSON(), lang }, cfg.token);
  await setMeta('pushEndpoint', sub.endpoint); await setMeta('pushKey', key);
}
export async function disablePush() {
  const cfg = await getSyncConfig();
  const sub = pushApis() ? await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() : null;
  if (cfg && sub) await call(cfg.url, '/api/push/unsubscribe', { endpoint: sub.endpoint }, cfg.token).catch(() => {});
  await sub?.unsubscribe();
  await db.meta.delete('pushEndpoint');
}
export async function testPush() {
  const cfg = (await getSyncConfig())!;
  return call(cfg.url, '/api/push/test', {}, cfg.token) as Promise<{ sent: number }>;
}

/* ---------- En segundo plano ---------- */
export function startBackgroundSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let es: EventSource | null = null;
  const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => syncNow(), 1500); };
  const offLocal = onLocalChange(soon);
  const onOnline = () => syncNow();
  window.addEventListener('online', onOnline);
  const iv = setInterval(() => syncNow(), 60_000);
  const connect = async () => {
    es?.close(); es = null;
    const cfg = await getSyncConfig();
    if (!cfg) return;
    syncNow();
    if ('EventSource' in window) {
      es = new EventSource(cfg.url.replace(/\/+$/, '') + '/api/events?token=' + encodeURIComponent(cfg.token));
      es.addEventListener('change', () => syncNow());
      es.addEventListener('open', () => syncNow());          // al reconectar, recoger lo que llegó mientras tanto
    }
  };
  configListeners.add(connect);
  connect();
  return () => { configListeners.delete(connect); offLocal(); window.removeEventListener('online', onOnline); clearInterval(iv); if (timer) clearTimeout(timer); es?.close(); };
}

/** Dirección del servidor que se propone: la misma web, salvo en alojamientos solo estáticos */
export function defaultServer(): string {
  if (!location.protocol.startsWith('http')) return '';
  return /(\.github\.io|\.pages\.dev|\.netlify\.app)$/.test(location.hostname) ? '' : location.origin;
}
