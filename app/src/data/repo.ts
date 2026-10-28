/* Acciones sobre los datos. Cada escritura sincronizable deja un aviso en la cola `outbox`:
   la app escribe primero en el dispositivo y la sincronización envía después.              */
import { db, deviceId, getMeta, setMeta } from './db';
import { balanceOf, bonusesForDay, checkId, computeStreak, dayOf, nextMastery, roundStars, taskEventId, tasksForDay, type BonusState, type StreakInfo } from './domain';
import { hashPin, newSalt, LOCK_MS, MAX_TRIES } from './pin';
import { DEFAULT_RULES, makeTest, scoreTest, LEVEL_SKILLS, type ScoreResult } from '../engine';
import M from '../mascots/mascots.js';
import type { ActiveTest, Answer, Child, Family, Flag, Kind, Lang, Reward, Session, Settings, StarEvent, SyncTable, Task, TaskCheck, Tone } from './types';

const uid = () => crypto.randomUUID();
const FAMILY_ID = 'family';
type Row = Family | Child | Session | Answer | StarEvent | Reward | Flag | Task | TaskCheck;

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
  await db.transaction('rw', [db.children, db.sessions, db.answers, db.events, db.mastery, db.meta, db.outbox, db.flags, db.tasks, db.checks], async () => {
    await db.flags.where('childId').equals(id).delete();
    await db.tasks.where('childId').equals(id).delete();
    await db.checks.where('childId').equals(id).delete();
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
  if (roundStars(bal - amount) < 0) throw new RedeemError('balance');
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

/* ---------------- Tareas ---------------- */
export interface NewTask { childId: string; kind: 'task' | 'bonus'; title: string; stars: number; days: number[]; date?: string; taskIds?: string[] }
export async function addTask(o: NewTask): Promise<Task> {
  const now = Date.now();
  const task: Task = { id: uid(), childId: o.childId, kind: o.kind, title: o.title.trim().slice(0, 60), stars: Math.max(0, roundStars(o.stars)),
    days: o.days, ...(o.date ? { date: o.date } : {}), ...(o.taskIds ? { taskIds: o.taskIds } : {}), active: true, createdAt: now, updatedAt: now };
  await put('tasks', [task]);
  return task;
}
export async function updateTask(id: string, patch: Partial<Task>) {
  const t = await db.tasks.get(id); if (!t) return;
  const next = { ...t, ...patch, updatedAt: Date.now() };
  next.stars = Math.max(0, roundStars(next.stars));
  await put('tasks', [next]);
}
/** Se marca como borrada (no se elimina) para que el historial de estrellas conserve su nombre */
export const deleteTask = (id: string) => updateTask(id, { deleted: true, active: false });

export interface TaskBoard {
  day: string;
  items: { task: Task; check?: TaskCheck }[];
  bonuses: BonusState[];
  approved: number;
  claimed: number;
}
/** Las tareas de un niño en un día, con su estado y los premios por conjunto */
export async function taskBoard(child: Pick<Child, 'id' | 'taskDays'>, day: string): Promise<TaskBoard> {
  const tasks = await db.tasks.where('childId').equals(child.id).toArray();
  const checks = new Map((await db.checks.where('childId').equals(child.id).filter(c => c.day === day).toArray()).map(c => [c.taskId, c]));
  const todays = tasksForDay(tasks, day, child.taskDays).sort((a, b) => a.createdAt - b.createdAt);
  const approved = new Set([...checks.values()].filter(c => c.state === 'approved').map(c => c.taskId));
  return { day, items: todays.map(task => ({ task, check: checks.get(task.id) })), bonuses: bonusesForDay(tasks, day, approved, child.taskDays),
    approved: todays.filter(t => approved.has(t.id)).length, claimed: todays.filter(t => checks.get(t.id)?.state === 'claimed').length };
}
/** Cada paso de una tarea gana al anterior aunque el reloj de este dispositivo vaya por detrás del otro */
const stamp = (prev?: TaskCheck) => Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1);
/** El niño dice que la ha hecho; el padre recibe el aviso */
export async function claimTask(taskId: string, day: string) {
  const task = await db.tasks.get(taskId); if (!task) return;
  const id = checkId(taskId, day), prev = await db.checks.get(id), now = Date.now();
  if (prev?.state === 'approved' || prev?.state === 'claimed') return;
  await put('checks', [{ id, taskId, childId: task.childId, day, state: 'claimed', claimedAt: now, updatedAt: stamp(prev) }]);
}
const noteArg = (s: string) => s.replace(/[;=]/g, ',');
/** El padre la da por hecha: suma sus estrellas y, si completa un conjunto, el premio del conjunto */
export async function approveTask(taskId: string, day: string) {
  const task = await db.tasks.get(taskId); if (!task) return;
  const id = checkId(taskId, day), prev = await db.checks.get(id), now = Date.now();
  if (prev?.state === 'approved') return;
  await put('checks', [{ id, taskId, childId: task.childId, day, state: 'approved', ...(prev?.claimedAt ? { claimedAt: prev.claimedAt } : {}), decidedAt: now, updatedAt: stamp(prev) }]);
  const dev = await deviceId();
  const ev = (t: Task, key: string): StarEvent => ({ id: taskEventId(t.id, day), childId: t.childId, ts: now, day, type: 'tarea', amount: roundStars(t.stars),
    note: '@ev.' + key + ';n=' + noteArg(t.title), by: 'parent', device: dev });
  const events: StarEvent[] = [];
  if (task.stars > 0 && !(await db.events.get(taskEventId(task.id, day)))) events.push(ev(task, 'task'));
  const child = await db.children.get(task.childId);
  const board = await taskBoard({ id: task.childId, taskDays: child?.taskDays }, day);
  for (const b of board.bonuses) if (b.complete && b.bonus.stars > 0 && !(await db.events.get(taskEventId(b.bonus.id, day)))) events.push(ev(b.bonus, 'bonus'));
  if (events.length) await put('events', events);
}
/** El padre dice que aún no está: el niño puede volver a marcarla. Una tarea ya pagada no cambia */
export async function rejectTask(taskId: string, day: string) {
  const task = await db.tasks.get(taskId); if (!task) return;
  const id = checkId(taskId, day), prev = await db.checks.get(id), now = Date.now();
  if (prev?.state === 'approved') return;
  await put('checks', [{ id, taskId, childId: task.childId, day, state: 'rejected', ...(prev?.claimedAt ? { claimedAt: prev.claimedAt } : {}), decidedAt: now, updatedAt: stamp(prev) }]);
}
/** Tareas que esperan la decisión del padre (de cualquier día), las más antiguas primero */
export async function pendingChecks(): Promise<{ check: TaskCheck; task?: Task; child?: Child }[]> {
  const list = await db.checks.where('state').equals('claimed').toArray();
  const out = await Promise.all(list.map(async check => ({ check, task: await db.tasks.get(check.taskId), child: await db.children.get(check.childId) })));
  return out.filter(x => x.task && x.child && !x.task.deleted).sort((a, b) => (a.check.claimedAt ?? 0) - (b.check.claimedAt ?? 0));
}

/* ---------------- Piloto: «no lo entiendo» ---------------- */
export async function addFlag(child: Child, gen: string, tag: string) {
  await put('flags', [{ id: uid(), childId: child.id, ts: Date.now(), gen, tag, lang: child.lang, tone: child.tone }]);
}

/* ---------------- Datos ---------------- */
export async function exportAll() {
  const [family, children, sessions, answers, events, rewards, mastery, flags, tasks, checks] = await Promise.all([
    db.family.toArray(), db.children.toArray(), db.sessions.toArray(), db.answers.toArray(), db.events.toArray(), db.rewards.toArray(), db.mastery.toArray(), db.flags.toArray(),
    db.tasks.toArray(), db.checks.toArray()]);
  return { app: 'Mathzilo', version: 1, exportedAt: new Date().toISOString(),
           family: family.map(f => ({ ...f, pinHash: undefined, pinSalt: undefined })), children, sessions, answers, events, rewards, mastery, flags, tasks, checks };
}
/* ---------------- Restaurar una copia exportada ---------------- */
export type Backup = Awaited<ReturnType<typeof exportAll>> & { pilotNotes?: string };
export class BackupError extends Error {}
/** Lee y valida un archivo exportado (sin tocar nada todavía) */
export function readBackup(text: string): Backup {
  let d: Backup;
  try { d = JSON.parse(text); } catch { throw new BackupError('json'); }
  const okApp = d && typeof d === 'object' && ['Mathzilo', 'StarMath'].includes((d as { app?: string }).app ?? '') && d.version === 1;
  if (!okApp || !Array.isArray(d.family) || d.family.length !== 1 || !Array.isArray(d.children) || !Array.isArray(d.events)) throw new BackupError('formato');
  for (const k of ['sessions', 'answers', 'rewards', 'mastery'] as const) if (!Array.isArray(d[k])) throw new BackupError('formato');
  return d;
}
/** Sustituye todo lo de este dispositivo por la copia. El PIN no viaja en la copia: se elige uno nuevo */
export async function restoreBackup(d: Backup, pin: string) {
  const salt = newSalt(), now = Date.now();
  const fam: Family = { ...(d.family[0] as unknown as Family), id: FAMILY_ID, pinSalt: salt, pinHash: await hashPin(pin, salt), pinLength: pin.length, updatedAt: now };
  const device = await getMeta<string>('device', '');
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(t => t.clear()));
    await db.family.put(fam);
    await db.children.bulkPut(d.children);
    await db.sessions.bulkPut(d.sessions);
    await db.answers.bulkPut(d.answers);
    await db.events.bulkPut(d.events);
    await db.rewards.bulkPut(d.rewards);
    await db.mastery.bulkPut(d.mastery);
    if (Array.isArray(d.flags)) await db.flags.bulkPut(d.flags);
    if (Array.isArray(d.tasks)) await db.tasks.bulkPut(d.tasks);        // copias anteriores a las tareas no las traen
    if (Array.isArray(d.checks)) await db.checks.bulkPut(d.checks);
    if (device) await db.meta.put({ key: 'device', value: device });
    if (d.pilotNotes) await db.meta.put({ key: 'pilotNotes', value: d.pilotNotes });
    await db.meta.put({ key: 'lastExport', value: now });
  });
  notify();
}

export async function wipeAll() {
  await Promise.all(db.tables.map(t => t.clear()));
  notify();
}

export const ALL_SKILLS = LEVEL_SKILLS;
export type { Tone };
