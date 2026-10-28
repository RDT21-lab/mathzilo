/* Reglas puras (sin base de datos): fecha del día, racha y escudos, saldo, dominio y sugerencias
   de nivel. El saldo nunca se guarda: es siempre la suma de los apuntes.                      */
import type { Session, StarEvent, Task } from './types';

/** Día local AAAA-MM-DD; antes de `dayStartHour` cuenta como el día anterior */
export function dayOf(ts: number, dayStartHour: number): string {
  const d = new Date(ts - dayStartHour * 3600_000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(b) - p(a)) / 86400_000);
}

export type DayState = 'done' | 'shield' | 'miss' | 'today' | 'none';
export interface StreakInfo {
  streak: number;           // días seguidos con test superado (los escudos la mantienen)
  best: number;             // mejor racha (nunca baja)
  shields: number;          // escudos guardados (0-2)
  doneToday: boolean;       // ya hizo un test hoy (el siguiente es práctica)
  passedToday: boolean;     // hoy ya contó para la racha
  rested: number;           // racha que se perdió y aún no se ha retomado (para el mensaje amable)
  states: Record<string, DayState>;
  shieldDays: string[];
}

/** Recorre los días desde el primer test superado: suma racha, gana y gasta escudos */
export function computeStreak(sessions: Pick<Session, 'day' | 'passed' | 'serverDay'>[], today: string, shieldsOn: boolean, storedBest = 0): StreakInfo {
  const passed = new Set<string>(), done = new Set<string>();
  for (const s of sessions) {
    const d = s.serverDay ?? s.day;
    if (d > today) continue;                       // fechas del futuro no regalan rachas
    done.add(d);
    if (s.passed) passed.add(d);
  }
  const states: Record<string, DayState> = {};
  const shieldDays: string[] = [];
  let streak = 0, best = 0, shields = 0, lost = 0;
  const first = [...passed].sort()[0];
  if (first) {
    for (let d = first; d <= today; d = addDays(d, 1)) {
      if (passed.has(d)) {
        streak++; lost = 0;
        best = Math.max(best, streak);
        if (shieldsOn && streak % 7 === 0) shields = Math.min(2, shields + 1);
        states[d] = 'done';
      } else if (d === today) {
        states[d] = 'today';
      } else if (streak > 0 && shieldsOn && shields > 0) {
        shields--; states[d] = 'shield'; shieldDays.push(d);
      } else {
        if (streak > 0) lost = streak;
        streak = 0; states[d] = 'miss';
      }
    }
  }
  if (!passed.has(today)) states[today] = 'today';
  return { streak, best: Math.max(best, storedBest), shields, doneToday: done.has(today), passedToday: passed.has(today),
           rested: streak === 0 ? lost : 0, states, shieldDays };
}

/** Las estrellas pueden llevar un decimal (tareas): se redondea para que 0,1 + 0,2 sea 0,3 */
export const roundStars = (n: number) => Math.round(n * 10) / 10;
export function balanceOf(events: Pick<StarEvent, 'amount'>[]): number {
  return roundStars(events.reduce((s, e) => s + e.amount, 0));
}

/* ---------- Tareas ---------- */
/** Día de la semana de una fecha AAAA-MM-DD (0 = domingo) */
export const weekdayOf = (day: string) => new Date(day + 'T12:00:00Z').getUTCDay();
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** Tareas que tocan ese día: activas, de esa fecha, o del día de la semana si el niño tiene tareas ese día.
    Una tarea con fecha la ha puesto el padre a propósito: sale aunque ese día de la semana esté desconectado */
export function tasksForDay(tasks: Task[], day: string, taskDays: number[] = ALL_DAYS): Task[] {
  const wd = weekdayOf(day), on = taskDays.includes(wd);
  return tasks.filter(t => t.kind === 'task' && t.active && !t.deleted && (t.date ? t.date === day : on && t.days.includes(wd)));
}
export interface BonusState { bonus: Task; tasks: Task[]; done: number; complete: boolean }
/** Premios por conjunto que se juegan ese día y cuántas de sus tareas están ya aprobadas */
export function bonusesForDay(tasks: Task[], day: string, approved: Set<string>, taskDays: number[] = ALL_DAYS): BonusState[] {
  const today = tasksForDay(tasks, day, taskDays);
  return tasks.filter(b => b.kind === 'bonus' && b.active && !b.deleted).map(bonus => {
    const inc = bonus.taskIds?.length ? today.filter(t => bonus.taskIds!.includes(t.id)) : today;
    const done = inc.filter(t => approved.has(t.id)).length;
    return { bonus, tasks: inc, done, complete: inc.length > 0 && done === inc.length };
  }).filter(b => b.tasks.length > 0);
}
export const checkId = (taskId: string, day: string) => taskId + ':' + day;
/** Los apuntes de tareas tienen identificador fijo: aprobar dos veces (o desde dos móviles) no paga dos veces */
export const taskEventId = (taskId: string, day: string) => 'tarea:' + taskId + ':' + day;

/** Dominio 0-100: sube con los aciertos y baja con los fallos (más deprisa al principio) */
export function nextMastery(value: number | undefined, ok: boolean): number {
  const m = value ?? 50;
  const v = ok ? m + (100 - m) * 0.2 : m * 0.75;
  return Math.round(Math.max(0, Math.min(100, v)));
}

/** Sugerencia de nivel: subir con ≥ 90 % en 5 tests seguidos; bajar con < 50 % en 3 */
export function levelSuggestion(sessions: Pick<Session, 'level' | 'correct' | 'length' | 'endedAt'>[], level: number): 'up' | 'down' | null {
  const atLevel = sessions.filter(s => s.level === level).sort((a, b) => a.endedAt - b.endedAt);
  const pct = (s: { correct: number; length: number }) => (s.correct / s.length) * 100;
  const last5 = atLevel.slice(-5), last3 = atLevel.slice(-3);
  if (level < 6 && last5.length === 5 && last5.every(s => pct(s) >= 90)) return 'up';
  if (level > 1 && last3.length === 3 && last3.every(s => pct(s) < 50)) return 'down';
  return null;
}

/** Tres respuestas seguidas en menos de 2 s → ese test no da bonus */
export const FAST_MS = 2000;
export const FAST_RUN = 3;
