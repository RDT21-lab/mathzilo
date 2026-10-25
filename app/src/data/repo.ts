/* Acciones sobre los datos. Cada escritura sincronizable deja un aviso en la cola `outbox`:
   la app escribe primero en el dispositivo y la sincronización envía después.              */
import { db, deviceId, getMeta, setMeta } from './db';
import { balanceOf, computeStreak, dayOf, nextMastery, type StreakInfo } from './domain';
import { hashPin, newSalt, LOCK_MS, MAX_TRIES } from './pin';
import { DEFAULT_RULES, makeTest, scoreTest, LEVEL_SKILLS, type ScoreResult } from '../engine';
import M from '../mascots/mascots.js';
import type { ActiveTest, Answer, Child, Family, Flag, Kind, Lang, Reward, Session, Settings, StarEvent, SyncTable, Tone } from './types';

const uid = () => crypto.randomUUID();
const FAMILY_ID = 'family';
type Row = Family | Child | Session | Answer | StarEvent | Reward | Flag;

/** Escribe filas y las encola para sincronizar, todo en una transacción */
async function put(table: SyncTable, rows: Row[]) {
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).bulkPut(rows);
    await db.outbox.bulkAdd(rows.map(r => ({ table, id: (r as { id: string }).id, op: 'put' as const })));
  });
  notify();
}

/* Avisos de cambio para la sincronización en segundo plano */
type Listener = () => void;
const listeners = new Set<Listener>();
export function onLocalChange(f: Listener) { listeners.add(f); return () => listeners.delete(f); }
function notify() { listeners.forEach(f => f()); }

/* ---------------- Familia ---------------- */
export async function getFamily(): Promise<Family | undefined> { return db.family.get(FAMILY_ID); }
export function defaultSettings(lang: Lang): Settings {
  return { rules: structuredClone(DEFAULT_RULES), shieldsOn: true, dayStartHour: 4, lang, equivalence: '' };
}

export interface NewChild { name: string; kind: Kind; petName: string; level: number; lang: Lang }
export async function createFamily(o: { lang: Lang; pin: string; children: NewChild[] }) {
  const salt = newSalt(), now = Date.now();
  const fam: Family = { id: FAMILY_ID, createdAt: now, updatedAt: now, settings: defaultSettings(o.lang), pinSalt: salt,
    pinHash: await hashPin(o.pin, salt), pinLength: o.pin.length, privacyAcceptedAt: now };
  await put('family', [fam]);
  for (const c of o.children) await addChild(c);
  await addReward({ name: o.lang === 'es' ? 'Helado' : o.lang === 'fr' ? 'Glace' : o.lang === 'de' ? 'Eis' : 'Ice cream', cost: 40, note: '' });
}
export async function updateSettings(patch: Partial<Settings>) {
  const f = await getFamily(); if (!f) return;
  await put('family', [{ ...f, settings: { ...f.settings, ...patch }, updatedAt: Date.now() }]);
}

/* ---------------- PIN con bloqueo ---------------- */
export interface PinCheck { ok: boolean; locked: boolean; triesLeft: number; until: number }
export async function checkPin(pin: string): Promise<PinCheck> {
  const f = await getFamily();
  const lock = await getMeta('pinLock', { fails: 0, until: 0 });
  const now = Date.now();
  if (lock.until > now) return { ok: false, locked: true, triesLeft: 0, until: lock.until };
  if (f && (await hashPin(pin, f.pinSalt)) === f.pinHash) {
    await setMeta('pinLock', { fails: 0, until: 0 });
    return { ok: true, locked: false, triesLeft: MAX_TRIES, until: 0 };
  }
  const fails = (lock.until && lock.until <= now ? 0 : lock.fails) + 1;
  const until = fails >= MAX_TRIES ? now + LOCK_MS : 0;
  await setMeta('pinLock', { fails: until ? 0 : fails, until });
  return { ok: false, locked: !!until, triesLeft: Math.max(0, MAX_TRIES - fails), until };
}
export async function changePin(pin: string) {
  const f = await getFamily(); if (!f) return;
  const salt = newSalt();
  await put('family', [{ ...f, pinSalt: salt, pinHash: await hashPin(pin, salt), pinLength: pin.length, updatedAt: Date.now() }]);
}

/* ---------------- Hijos ---------------- */
export async function addChild(c: NewChild): Promise<Child> {
  const now = Date.now();
  const child: Child = { id: uid(), name: c.name.trim(), kind: c.kind, petName: c.petName.trim() || (c.kind === 'zorro' ? 'Chispa' : 'Bip'),
    level: c.level, lang: c.lang, tone: c.level <= 3 ? 'young' : 'older', maxLen: 20, bestStreak: 0, sound: true, createdAt: now, updatedAt: now };
  await put('children', [child]);
  return child;
}
export async function updateChild(id: string, patch: Partial<Child>) {
  const c = await db.children.get(id); if (!c) return;
  await put('children', [{ ...c, ...patch, updatedAt: Date.now() }]);
}
/** Borra un hijo y todo lo suyo (también en la nube en la próxima sincronización) */
export async function deleteChild(id: string) {
  await db.transaction('rw', [db.children, db.sessions, db.answers, db.events, db.mastery, db.meta, db.outbox, db.flags], async () => {
    await db.flags.where('childId').equals(id).delete();
    await db.children.delete(id);
    await db.sessions.where('childId').equals(id).delete();
    await db.answers.where('childId').equals(id).delete();
    await db.events.where('childId').equals(id).delete();
    await db.mastery.where('childId').equals(id).delete();
    await db.meta.delete('active:' + id);
    await db.outbox.add({ table: 'children', id, op: 'del' });
  });
  notify();
}

/* ---------------- Premios ---------------- */
export async function addReward(r: { name: string; cost: number; note: string }) {
  const now = Date.now();
  await put('rewards', [{ id: uid(), name: r.name, cost: r.cost, note: r.note, active: true, createdAt: now, updatedAt: now }]);
}
export async function updateReward(id: string, patch: Partial<Reward>) {
  const r = await db.rewards.get(id); if (!r) return;
  await put('rewards', [{ ...r, ...patch, updatedAt: Date.now() }]);
}

/* ---------------- Estado del niño ---------------- */
export async function today(): Promise<string> {
  const f = await getFamily();
  return dayOf(Date.now(), f?.settings.dayStartHour ?? 4);
}
export async function streakOf(child: Child, fam?: Family): Promise<StreakInfo> {
  const f = fam ?? await getFamily();
  const sessions = await db.sessions.where('childId').equals(child.id).toArray();
  return computeStreak(sessions, dayOf(Date.now(), f?.settings.dayStartHour ?? 4), f?.settings.shieldsOn ?? true, child.bestStreak);
}
export async function balance(childId: string): Promise<number> {
  return balanceOf(await db.events.where('childId').equals(childId).toArray());
}

/* ---------------- Test ---------------- */
export async function getActive(childId: string): Promise<ActiveTest | null> { return getMeta<ActiveTest | null>('active:' + childId, null); }
export async function saveActive(a: ActiveTest) { await setMeta('active:' + a.childId, a); }
export async function dropActive(childId: string) { await db.meta.delete('active:' + childId); }

export async function startTest(child: Child, n: number): Promise<ActiveTest> {
  const info = await streakOf(child);
  const mastery = Object.fromEntries((await db.mastery.where('childId').equals(child.id).toArray()).map(m => [m.skill, m.value]));
  // repaso: habilidades con fallos en los últimos 14 días
  const since = Date.now() - 14 * 86400_000;
  const recentWrong = await db.answers.where('childId').equals(child.id).filter(a => !a.ok).toArray();
  const sessionsById = new Map((await db.sessions.where('childId').equals(child.id).toArray()).map(s => [s.id, s]));
  const review = [...new Set(recentWrong.filter(a => (sessionsById.get(a.sessionId)?.endedAt ?? 0) > since).map(a => a.skill))];
  const seed = Math.floor(Math.random() * 1e9);
  const qs = makeTest(child.level, n, seed, { mastery, review }).map(q => ({ gen: q.gen, seed: q.seed }));
  const a: ActiveTest = { childId: child.id, n, level: child.level, practice: info.doneToday, qs, i: 0, answers: [], startedAt: Date.now(), quick: 0, fast: false };
  await saveActive(a);
  return a;
}

export interface FinishResult {
  score: ScoreResult;
  session: Session;
  before: StreakInfo;
  after: StreakInfo;
  stageBefore: number;
  stageAfter: number;
  gotShield: boolean;
}
export async function finishTest(a: ActiveTest): Promise<FinishResult> {
  const fam = (await getFamily())!;
  const child = (await db.children.get(a.childId))!;
  const dev = await deviceId();
  const now = Date.now();
  const day = dayOf(now, fam.settings.dayStartHour);
  const before = await streakOf(child, fam);
  const correct = a.answers.filter(x => x.ok).length;
  const score = scoreTest(fam.settings.rules, { doneToday: before.doneToday, streakToday: before.passedToday, streak: before.streak },
                          { correct, total: a.n, fast: a.fast });
  const session: Session = { id: uid(), childId: child.id, startedAt: a.startedAt, endedAt: now, day, length: a.n, level: a.level, correct,
    stars: score.total, passed: score.passed, practice: score.practice, fast: a.fast, device: dev };
  const answers: Answer[] = a.answers.map(x => ({ ...x, id: uid(), sessionId: session.id, childId: child.id }));
  const events: StarEvent[] = score.items.filter(it => it.stars > 0).map(it => ({
    id: uid(), childId: child.id, ts: now, day, type: it.id === 'racha' ? 'racha' : 'test', amount: it.stars,
    note: '@ev.' + it.id + (it.id === 'aciertos' ? ';n=' + it.n + ';t=' + a.n : it.id === 'racha' ? ';d=' + it.days : ';t=' + a.n),
    by: 'child', device: dev, sessionId: session.id }));
  await put('sessions', [session]);
  await put('answers', answers);
  if (events.length) await put('events', events);
  // dominio por habilidad
  await db.transaction('rw', db.mastery, async () => {
    for (const x of a.answers) {
      const m = await db.mastery.get([child.id, x.skill]);
      await db.mastery.put({ childId: child.id, skill: x.skill, value: nextMastery(m?.value, x.ok), attempts: (m?.attempts ?? 0) + 1, last: now });
    }
  });
  const after = await streakOf(child, fam);
  const stageBefore = M.stageFor(Math.max(child.bestStreak, before.best));
  if (after.best > child.bestStreak) await updateChild(child.id, { bestStreak: after.best });
  await dropActive(child.id);
  return { score, session, before, after, stageBefore, stageAfter: M.stageFor(after.best), gotShield: after.shields > before.shields };
}

/* ---------------- Canjes (solo el padre) ---------------- */
export class RedeemError extends Error {}
/** Resta estrellas; el saldo no puede quedar en negativo. El PIN ya se ha comprobado */
export async function redeemLocal(childId: string, amount: number, note: string): Promise<StarEvent> {
  if (!Number.isInteger(amount) || amount <= 0) throw new RedeemError('amount');
  const bal = await balance(childId);
  if (bal - amount < 0) throw new RedeemError('balance');
  const now = Date.now(), fam = await getFamily();
  const ev: StarEvent = { id: uid(), childId, ts: now, day: dayOf(now, fam?.settings.dayStartHour ?? 4), type: 'canje', amount: -amount,
    note, by: 'parent', device: await deviceId() };
  await put('events', [ev]);
  return ev;
}
/** Un apunte no se borra: se corrige con otro de signo contrario */
export async function compensate(eventId: string): Promise<StarEvent | null> {
  const e = await db.events.get(eventId);
  if (!e) return null;
  const done = await db.events.filter(x => x.ref === eventId).count();
  if (done) return null;
  const now = Date.now(), fam = await getFamily();
  const ev: StarEvent = { id: uid(), childId: e.childId, ts: now, day: dayOf(now, fam?.settings.dayStartHour ?? 4), type: 'ajuste', amount: -e.amount,
    note: '@ev.fix', by: 'parent', device: await deviceId(), ref: e.id };
  await put('events', [ev]);
  return ev;
}

/* ---------------- Piloto: «no lo entiendo» ---------------- */
export async function addFlag(child: Child, gen: string, tag: string) {
  await put('flags', [{ id: uid(), childId: child.id, ts: Date.now(), gen, tag, lang: child.lang, tone: child.tone }]);
}

/* ---------------- Datos ---------------- */
export async function exportAll() {
  const [family, children, sessions, answers, events, rewards, mastery, flags] = await Promise.all([
    db.family.toArray(), db.children.toArray(), db.sessions.toArray(), db.answers.toArray(), db.events.toArray(), db.rewards.toArray(), db.mastery.toArray(), db.flags.toArray()]);
  return { app: 'Mathzilo', version: 1, exportedAt: new Date().toISOString(),
           family: family.map(f => ({ ...f, pinHash: undefined, pinSalt: undefined })), children, sessions, answers, events, rewards, mastery, flags };
}
export async function wipeAll() {
  await Promise.all(db.tables.map(t => t.clear()));
  notify();
}

export const ALL_SKILLS = LEVEL_SKILLS;
export type { Tone };
