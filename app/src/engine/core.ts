/* Mathzilo — piezas básicas del motor: azar con semilla, racionales exactos y valores mostrables.
   Nada de coma flotante en las respuestas: los decimales se guardan como enteros escalados
   (0,75 → u = 75, p = 2) y las fracciones como numerador y denominador enteros.            */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const ri = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
export function shuffle<T>(r: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
export const digitsReversed = (n: number) => parseInt(String(n).split('').reverse().join(''), 10);

/* ---------- Racionales exactos ---------- */
export interface Rat { n: number; d: number }
export function rat(n: number, d = 1): Rat {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error('racional no válido ' + n + '/' + d);
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
export const rAdd = (a: Rat, b: Rat) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const rSub = (a: Rat, b: Rat) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const rMul = (a: Rat, b: Rat) => rat(a.n * b.n, a.d * b.d);
export const rDiv = (a: Rat, b: Rat) => rat(a.n * b.d, a.d * b.n);
export const rEq = (a: Rat, b: Rat) => a.n === b.n && a.d === b.d;
export const rCmp = (a: Rat, b: Rat) => Math.sign(a.n * b.d - b.n * a.d);

/* ---------- Valores que ve el niño ---------- */
export type Val =
  | { k: 'int'; v: number }
  | { k: 'dec'; u: number; p: number }           // u × 10^-p
  | { k: 'frac'; n: number; d: number }          // tal cual se muestra (puede no estar simplificada)
  | { k: 'sym'; s: '<' | '>' | '=' }
  | { k: 'time'; h: number; m: number }
  | { k: 'money'; c: number };                   // céntimos de euro

export const I = (v: number): Val => ({ k: 'int', v });
export const D = (u: number, p: number): Val => ({ k: 'dec', u, p });
export const F = (n: number, d: number): Val => ({ k: 'frac', n, d });
export const T = (h: number, m: number): Val => ({ k: 'time', h, m });
export const S = (s: '<' | '>' | '='): Val => ({ k: 'sym', s });
export const EUR = (c: number): Val => ({ k: 'money', c });

/** Decimal sin ceros de sobra (5,00 → 5; 0,50 → 0,5) */
export function decNorm(u: number, p: number): Val {
  while (p > 0 && u % 10 === 0) { u /= 10; p--; }
  return p === 0 ? I(u) : D(u, p);
}
/** Fracción simplificada (si el denominador queda en 1, es un entero) */
export function fracNorm(n: number, d: number): Val {
  const q = rat(n, d);
  return q.d === 1 ? I(q.n) : F(q.n, q.d);
}

/** Valor exacto (para comparar respuestas); null si no es un número */
export function valRat(v: Val): Rat | null {
  switch (v.k) {
    case 'int': return rat(v.v);
    case 'dec': return rat(v.u, 10 ** v.p);
    case 'frac': return rat(v.n, v.d);
    case 'money': return rat(v.c, 100);
    default: return null;
  }
}
/** Clave única por valor numérico (dos formas del mismo número son la misma opción) */
export function valKey(v: Val): string {
  const q = valRat(v);
  if (q) return 'n' + q.n + '/' + q.d;
  if (v.k === 'sym') return 's' + v.s;
  if (v.k === 'time') return 't' + v.h + ':' + v.m;
  return '?';
}
export function sameVal(a: Val, b: Val): boolean { return valKey(a) === valKey(b); }

/** Un valor con sentido para enseñarlo como opción (sin negativos donde no tocan, etc.) */
export function valOk(v: Val, allowNeg: boolean): boolean {
  switch (v.k) {
    case 'int': return Number.isInteger(v.v) && (allowNeg || v.v >= 0) && Math.abs(v.v) < 1e8;
    case 'dec': return Number.isInteger(v.u) && (allowNeg || v.u >= 0) && v.p >= 1 && v.p <= 3;
    case 'frac': return Number.isInteger(v.n) && Number.isInteger(v.d) && v.d > 1 && v.n > 0 && v.d <= 100;
    case 'money': return Number.isInteger(v.c) && v.c >= 0;
    case 'time': return v.h >= 1 && v.h <= 12 && [0, 15, 30, 45].includes(v.m);
    case 'sym': return true;
  }
}

/* ---------- Árbol de la operación: el banco de pruebas lo recalcula por otro camino ---------- */
export type Expr =
  | number
  | { dec: number; p: number }
  | { frac: [number, number] }
  | { op: '+' | '-' | '*' | '/' | 'idiv' | 'mod' | 'pow' | 'sqrt' | 'gcd' | 'lcm' | 'mean' | 'cmp' | 'pct' | 'round'; args: Expr[] };
export const ex = (op: Exclude<Expr, number | { dec: number } | { frac: [number, number] }>['op'], ...args: Expr[]): Expr => ({ op, args });

/* ---------- Pregunta ---------- */
export interface Option { v: Val; tag: string }
export type NumPad = 'int' | 'dec' | 'frac' | 'neg' | 'money';
export type Visual =
  | { type: 'clock'; h: number; m: number }
  | { type: 'pie'; n: number; d: number }
  | { type: 'pies'; a: [number, number]; b: [number, number] }
  | { type: 'rect'; w: number; h: number; unit: string; show: 'sides' | 'grid' }
  | { type: 'tri'; a: number; b: number; c: number; unit: string }
  | { type: 'trih'; b: number; h: number; unit: string }
  | { type: 'box'; w: number; h: number; d: number; unit: string }
  | { type: 'coins'; coins: number[] }
  | { type: 'frame'; a: number; b: number }
  | { type: 'chips'; items: Val[]; hi: number }
  | { type: 'columns'; op: '+' | '-'; a: number; b: number; ans: number }
  | { type: 'mulcols'; a: number; b: number }
  | { type: 'line'; from: number; to: number; marks: number[]; hi: number }
  | { type: 'place'; n: number }
  | { type: 'decs'; a: Val; b: Val; op: '+' | '-'; ans: Val }
  | { type: 'bars'; values: number[] };

export interface Prompt { key: string; vars: Record<string, Val | string | number> }

export interface Question {
  gen: string;
  level: number;
  prompt: Prompt;
  answer: Val;
  options: Option[];
  cands: Option[];             // todos los errores típicos previstos (para etiquetar lo escrito a mano)
  type: 'mc' | 'num';
  pad: NumPad;
  reduced: boolean;            // la fracción tiene que darse simplificada
  expr: Expr;
  data: Record<string, number>;
  seed: number;
  visual?: Visual;
}

export interface Draft {
  prompt: Prompt;
  answer: Val;
  expr: Expr;
  data?: Record<string, number>;
  cands: Option[];
  visual?: Visual;
  numShare?: number;            // probabilidad de teclado numérico
  mcOnly?: boolean;
  pad?: NumPad;
  reduced?: boolean;
  allowNeg?: boolean;
}

/** Elige 3 distractores válidos y distintos, completa con vecinos si faltan, y mezcla */
export function pickOptions(r: Rng, answer: Val, cands: Option[], allowNeg: boolean): Option[] {
  const seen = new Set<string>([valKey(answer)]);
  const chosen: Option[] = [];
  for (const c of shuffle(r, cands)) {
    if (chosen.length >= 3) break;
    if (!valOk(c.v, allowNeg)) continue;
    const k = valKey(c.v);
    if (!seen.has(k)) { seen.add(k); chosen.push(c); }
  }
  let step = 1;
  while (chosen.length < 3 && step < 200) {
    for (const s of [step, -step]) {
      if (chosen.length >= 3) break;
      const v = neighbour(answer, s);
      if (!v || !valOk(v, allowNeg)) continue;
      const k = valKey(v);
      if (!seen.has(k)) { seen.add(k); chosen.push({ v, tag: 'cuenta-mal' }); }
    }
    step++;
  }
  return shuffle(r, chosen.concat([{ v: answer, tag: 'ok' }]));
}
function neighbour(v: Val, s: number): Val | null {
  switch (v.k) {
    case 'int': return I(v.v + s);
    case 'dec': return D(v.u + s, v.p);
    case 'money': return EUR(v.c + s * 10);
    case 'frac': return v.n + s > 0 && v.n + s !== v.d ? F(v.n + s, v.d) : null;
    case 'time': { const t = (((v.h % 12) * 60 + v.m + 15 * s) % 720 + 720) % 720; return T(Math.floor(t / 60) || 12, t % 60); }
    case 'sym': return null;
  }
}

/* ---------- Leer lo que escribe el niño en el teclado numérico ---------- */
export function parseInput(s: string): Rat | null {
  const t = s.trim().replace(/\s+/g, '').replace(',', '.').replace('−', '-');
  if (!t) return null;
  let m = t.match(/^(-?)(\d+)\/(\d+)$/);
  if (m) { const d = parseInt(m[3], 10); if (!d) return null; return rat((m[1] ? -1 : 1) * parseInt(m[2], 10), d); }
  m = t.match(/^(-?)(\d*)\.(\d{1,4})$/);
  if (m && (m[2] || m[3])) {
    const p = m[3].length, u = parseInt((m[2] || '0') + m[3], 10);
    return rat((m[1] ? -1 : 1) * u, 10 ** p);
  }
  m = t.match(/^(-?)(\d+)$/);
  if (m) return rat((m[1] ? -1 : 1) * parseInt(m[2], 10));
  return null;
}
/** ¿Es correcta la respuesta escrita? Si se pide fracción simplificada, la forma importa */
export function inputMatches(q: Question, s: string): boolean {
  const a = valRat(q.answer), g = parseInput(s);
  if (!a || !g || !rEq(a, g)) return false;
  if (q.answer.k === 'frac' && q.reduced) {
    const m = s.replace(/\s+/g, '').match(/^(\d+)\/(\d+)$/);
    if (m && gcd(parseInt(m[1], 10), parseInt(m[2], 10)) !== 1) return false;
  }
  return true;
}
/** Convierte lo escrito en un Val del mismo tipo que la respuesta (para etiquetar el error) */
export function inputToVal(q: Question, s: string): Val | null {
  const g = parseInput(s);
  if (!g) return null;
  const m = s.replace(/\s+/g, '').match(/^(\d+)\/(\d+)$/);
  if (m) return F(parseInt(m[1], 10), parseInt(m[2], 10));
  switch (q.answer.k) {
    case 'dec': { const p = q.answer.p; const u = g.n * (10 ** p) / g.d; return Number.isInteger(u) ? D(u, p) : (g.d === 1 ? I(g.n) : null); }
    case 'money': { const c = g.n * 100 / g.d; return Number.isInteger(c) ? EUR(c) : null; }
    default: return g.d === 1 ? I(g.n) : F(g.n, g.d);
  }
}
