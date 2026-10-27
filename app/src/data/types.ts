import type { Rules } from '../engine';

export type Lang = 'es' | 'en' | 'fr' | 'de';
export const LANGS: Lang[] = ['es', 'en', 'fr', 'de'];
export type Kind = 'zorro' | 'robot';
export type Tone = 'young' | 'older';

export interface SyncConfig {
  url: string;              // servidor de sincronización (vacío = solo en este dispositivo)
  token: string;            // token del dispositivo (adulto o tablet)
  role: 'parent' | 'tablet';
  familyId: string;
  email?: string;
}

export interface Settings {
  rules: Rules;
  shieldsOn: boolean;
  dayStartHour: number;     // hora a la que empieza el día para las rachas (0-8)
  lang: Lang;               // idioma del modo padre
  equivalence: string;      // solo lo ve el padre: a qué equivale una estrella
}

export interface Family {
  id: string;
  createdAt: number;
  updatedAt: number;
  settings: Settings;
  pinHash: string;
  pinSalt: string;
  pinLength: number;
  privacyAcceptedAt: number;
}

export interface Child {
  id: string;
  name: string;
  kind: Kind;
  petName: string;
  level: number;
  lang: Lang;
  tone: Tone;
  maxLen: 10 | 15 | 20;
  bestStreak: number;       // guardado para que la mascota nunca retroceda
  sound: boolean;
  bigText?: boolean;        // letra más grande (accesibilidad)
  taskDays?: number[];      // días de la semana con tareas (0 = domingo … 6 = sábado); sin valor = todos
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  childId: string;
  startedAt: number;
  endedAt: number;
  day: string;              // AAAA-MM-DD local, con la hora de inicio del día aplicada
  length: number;
  level: number;
  correct: number;
  stars: number;
  passed: boolean;
  practice: boolean;
  fast: boolean;
  device: string;
  serverDay?: string;       // fecha validada por el servidor al sincronizar
}

export interface Answer {
  id: string;
  sessionId: string;
  childId: string;
  skill: string;
  seed: number;
  given: string;
  ok: boolean;
  ms: number;
  tag: string;
}

export type EventType = 'test' | 'racha' | 'escudo' | 'canje' | 'ajuste' | 'tarea';
export interface StarEvent {
  id: string;
  childId: string;
  ts: number;
  day: string;
  type: EventType;
  amount: number;
  note: string;             // texto libre o clave de traducción con prefijo «@»
  by: 'child' | 'parent';
  device: string;
  sessionId?: string;
  ref?: string;             // apunte al que compensa
}

export interface Reward {
  id: string;
  name: string;
  cost: number;
  note: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Mastery {
  childId: string;
  skill: string;
  value: number;            // 0-100
  attempts: number;
  last: number;
}

export interface ActiveTest {
  childId: string;
  n: number;
  level: number;
  practice: boolean;
  qs: { gen: string; seed: number }[];
  i: number;
  answers: Omit<Answer, 'id' | 'sessionId' | 'childId'>[];
  startedAt: number;
  quick: number;
  fast: boolean;
}

/** Tarea que pone el padre, o premio por cumplir un conjunto de tareas (kind 'bonus') */
export interface Task {
  id: string;
  childId: string;
  kind: 'task' | 'bonus';
  title: string;
  stars: number;            // puede llevar un decimal (1,5)
  days: number[];           // días de la semana en que toca (0 = domingo … 6 = sábado)
  date?: string;            // solo ese día (AAAA-MM-DD); entonces `days` no cuenta
  taskIds?: string[];       // premio: tareas que incluye (vacío = todas las del día)
  active: boolean;          // false = en pausa
  deleted?: boolean;        // borrada (se guarda para que el historial siga teniendo su nombre)
  createdAt: number;
  updatedAt: number;
}
/** Estado de una tarea en un día: el niño dice que la ha hecho; el padre la da por buena o no */
export type CheckState = 'claimed' | 'approved' | 'rejected';
export interface TaskCheck {
  id: string;               // tarea + ':' + día
  taskId: string;
  childId: string;
  day: string;
  state: CheckState;
  claimedAt?: number;
  decidedAt?: number;
  updatedAt: number;
}

export interface OutboxItem { seq?: number; table: SyncTable; id: string; op: 'put' | 'del' }
export type SyncTable = 'family' | 'children' | 'sessions' | 'answers' | 'events' | 'rewards' | 'flags' | 'tasks' | 'checks';

/** El niño pulsó «No lo entiendo» en una explicación (sirve para mejorar los textos en el piloto) */
export interface Flag { id: string; childId: string; ts: number; gen: string; tag: string; lang: Lang; tone: Tone }
