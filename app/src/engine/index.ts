/* Mathzilo — motor de preguntas: registro de generadores, armado de tests, etiquetado de errores,
   explicaciones y reglas de estrellas. Sin IA en tiempo de ejecución.                          */
import { mulberry32, pickOptions, valKey, inputMatches, inputToVal, parseInput, valRat, rEq, type Question, type Val, type Option } from './core';
import { BASIC } from './gens-basic';
import { ADVANCED } from './gens-advanced';
import { GEO, GEO_LEVEL_SKILLS, GEO_MAX_LEVEL, GEO_TAGS, GEO_TOPIC, GEO_TOPICS, TOPIC_WEIGHT, type GeoTopic } from './geo';
import type { Explanation, Generator } from './types';

export * from './core';
export type { Explanation, Step } from './types';

/** Generadores de matemáticas (niveles 1-6). Los de geografía (niveles 1-3) van aparte: GEO */
export const GENERATORS: Generator[] = [...BASIC, ...ADVANCED];
export { GEO, GEO_LEVEL_SKILLS, GEO_MAX_LEVEL, GEO_TOPIC, GEO_TOPICS, TOPIC_WEIGHT };
export { topicsFor, type GeoTopic } from './geo';
export const GEN_BY_ID: Record<string, Generator> = Object.fromEntries([...GENERATORS, ...GEO].map(g => [g.id, g]));
export type Subject = 'mates' | 'geo';
export const isGeo = (genId: string) => genId.startsWith('geo-');
export const MAX_LEVEL = 6;
export const LEVEL_SKILLS: Record<number, string[]> = {};
for (const g of GENERATORS) (LEVEL_SKILLS[g.level] ||= []).push(g.id);

/** Todas las etiquetas de error que puede producir el motor (cada una necesita su frase) */
export const ERROR_TAGS = [
  'cuenta-mal', 'decena-mal', 'resta-en-vez', 'suma-en-vez', 'resta-al-reves', 'olvido-llevada', 'llevada-doble', 'olvido-prestamo',
  'tabla-cercana', 'cifras-cambiadas', 'cifra-copiada', 'comparar-al-reves', 'comparar-igual', 'serie-paso', 'serie-sentido', 'doble-mitad',
  'hora-agujas', 'hora-media', 'cuarto-mal', 'moneda-mal', 'valor-posicional', 'fraccion-mal', 'fraccion-al-reves', 'fraccion-partes',
  'perimetro-lados', 'area-perimetro', 'mult-parcial', 'resto-cociente', 'resto-mal', 'cociente-mal', 'frac-mayor-denominador',
  'coma-mal-puesta', 'paso-olvidado', 'redondeo-mal', 'frac-suma-den', 'frac-equiv-sumar', 'porcentaje-mal', 'porcentaje-resto',
  'multiplo-divisor', 'area-triangulo', 'frac-den-distinto', 'signo-mal', 'potencia-por', 'raiz-mitad', 'mcd-mcm', 'divisor-comun',
  'multiplo-comun', 'media-sin-dividir', 'media-mal-contar', 'proporcion-sumar', 'volumen-area', 'sin-simplificar', ...GEO_TAGS
] as const;

export function makeQuestion(genId: string, seed: number): Question {
  const g = GEN_BY_ID[genId];
  if (!g) throw new Error('generador desconocido: ' + genId);
  const r = mulberry32(seed);
  const d = g.make(r);
  const allowNeg = !!d.allowNeg;
  const options = pickOptions(r, d.answer, d.cands, allowNeg);
  const type = d.mcOnly ? 'mc' : (r() < (d.numShare ?? 0) ? 'num' : 'mc');
  const pad = d.pad ?? (d.answer.k === 'frac' ? 'frac' : d.answer.k === 'dec' ? 'dec' : d.answer.k === 'money' ? 'money' : allowNeg ? 'neg' : 'int');
  return { gen: g.id, level: g.level, prompt: d.prompt, answer: d.answer, options, cands: d.cands, type, pad, reduced: !!d.reduced,
           expr: d.expr, data: d.data ?? {}, seed, visual: d.visual };
}

/** Identidad de una pregunta: enunciado más dibujo (reloj, monedas, tarta…) */
export const qKey = (q: Question) => JSON.stringify([q.prompt, q.visual ?? null]);

/** Otra pregunta del mismo tipo con números distintos (mini-reto tras un fallo) */
export function similar(q: Question, seed: number): Question {
  const key = qKey(q);
  for (let i = 0; i < 30; i++) {
    const n = makeQuestion(q.gen, seed + i * 7919);
    if (qKey(n) !== key) return n;
  }
  return makeQuestion(q.gen, seed + 1);
}

export interface TestContext {
  mastery?: Record<string, number>;   // 0-100 por habilidad
  review?: string[];                   // habilidades con errores recientes
  topics?: GeoTopic[];                 // geografía: temas elegidos (sin valor = todos)
}

/** Matemáticas: 70 % del nivel actual (más peso a las habilidades con menos dominio) y 30 % de repaso.
    Geografía: por temas (ver makeGeoTest) */
export function makeTest(level: number, n: number, seed: number, ctx: TestContext = {}, subject: Subject = 'mates'): Question[] {
  if (subject === 'geo') return makeGeoTest(level, n, seed, ctx);
  const r = mulberry32(seed);
  const lv = Math.min(Math.max(level, 1), MAX_LEVEL);
  const pool = LEVEL_SKILLS[lv];
  const lowerAll = GENERATORS.filter(g => g.level < lv && g.level >= lv - 2).map(g => g.id);
  const review = (ctx.review ?? []).filter(id => GEN_BY_ID[id] && GEN_BY_ID[id].level <= lv && !isGeo(id));
  const reviewPool = review.length ? review : (lowerAll.length ? lowerAll : pool);
  const nReview = Math.round(n * 0.3);
  const weight = (id: string) => 1 + (100 - (ctx.mastery?.[id] ?? 40)) / 25;
  const weighted = (ids: string[]) => {
    const total = ids.reduce((s, id) => s + weight(id), 0);
    let x = r() * total;
    for (const id of ids) { x -= weight(id); if (x <= 0) return id; }
    return ids[ids.length - 1];
  };
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(i < n - nReview ? weighted(pool) : reviewPool[Math.floor(r() * reviewPool.length)]);
  // mezcla: el repaso no va todo al final
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const seen = new Set<string>();
  return ids.map(id => {
    let q: Question, tries = 0;
    do { q = makeQuestion(id, Math.floor(r() * 1e9)); tries++; } while (seen.has(qKey(q)) && tries < 200);
    seen.add(qKey(q));
    return q;
  });
}

/** Geografía: primero el tema (comunidades y provincias pesan el doble), luego la pregunta del tema.
    Pesan más las del nivel del niño (×3), las de menos dominio y las falladas hace poco (×2); las de
    niveles superiores solo salen para no repetir. */
function makeGeoTest(level: number, n: number, seed: number, ctx: TestContext): Question[] {
  const r = mulberry32(seed);
  const lv = Math.min(Math.max(level, 1), GEO_MAX_LEVEL);
  const topics = ctx.topics?.length ? ctx.topics : GEO_TOPICS;
  const review = new Set(ctx.review ?? []);
  const pickW = <T,>(items: T[], w: (x: T) => number): T => {
    let x = r() * items.reduce((s, it) => s + w(it), 0);
    for (const it of items) { x -= w(it); if (x <= 0) return it; }
    return items[items.length - 1];
  };
  // preguntas del tema hasta el nivel del niño; las de niveles superiores solo entran si ya no queda ninguna sin
  // repetir (un tema con pocas en nivel 1, como las 6 grandes cordilleras, en un test de 20)
  const all = Object.fromEntries(topics.map(t => [t, GEO.filter(g => GEO_TOPIC[g.id] === t)])) as Record<GeoTopic, Generator[]>;
  const upTo = Object.fromEntries(topics.map(t => [t, all[t].filter(g => g.level <= lv)])) as Record<GeoTopic, Generator[]>;
  const weight = (g: Generator) => (g.level === lv ? 3 : 1) * (1 + (100 - (ctx.mastery?.[g.id] ?? 40)) / 25) * (review.has(g.id) ? 2 : 1);
  const seen = new Set<string>();
  return Array.from({ length: n }, () => {
    let q: Question, tries = 0;
    do {
      const t = pickW(topics, x => TOPIC_WEIGHT[x]);                  // si sale repetida, se vuelve a sortear tema y pregunta
      const g = pickW(tries < 50 && upTo[t].length ? upTo[t] : all[t], weight);
      q = makeQuestion(g.id, Math.floor(r() * 1e9)); tries++;
    } while (seen.has(qKey(q)) && tries < 80);
    seen.add(qKey(q));
    return q;
  });
}

/** ¿Acierto? `given` es la opción elegida o, en teclado numérico, el texto escrito */
export function isCorrect(q: Question, given: Val | string): boolean {
  if (typeof given === 'string') return inputMatches(q, given);
  return valKey(given) === valKey(q.answer);
}

/** Etiqueta del error típico que explica la respuesta dada */
export function tagFor(q: Question, given: Val | string): string {
  if (isCorrect(q, given)) return 'ok';
  let v: Val | null;
  if (typeof given === 'string') {
    const a = valRat(q.answer), g = parseInput(given);
    if (a && g && rEq(a, g)) return 'sin-simplificar';
    v = inputToVal(q, given);
    if (!v) return 'cuenta-mal';
  } else v = given;
  const k = valKey(v);
  const all: Option[] = q.options.concat(q.cands);
  for (const c of all) if (c.tag !== 'ok' && valKey(c.v) === k) return c.tag;
  return 'cuenta-mal';
}

export function explain(q: Question, tag: string, given: Val | null): Explanation {
  const e = GEN_BY_ID[q.gen].explain(q, tag, given);
  return { tag, tagVars: { ans: q.answer, ...(given ? { given } : {}), ...(e.vars ?? {}) }, steps: e.steps, visual: e.visual };
}

/* ---------- Estrellas ---------- */
/** Estrellas de un test: solo bonus (aprobar, perfecto, racha); cada acierto ya no suma (v0.9.3).
 *  Las cantidades van de 0,5 en 0,5. Las tareas tienen sus propias estrellas. */
export interface Rules {
  passPct: number;
  passBonus: Record<number, number>;
  perfect: number;
  streakBonus: Record<number, number>;
  maxLen: number;
}
export const DEFAULT_RULES: Rules = {
  passPct: 70, passBonus: { 10: 1, 15: 1, 20: 1 }, perfect: 0, streakBonus: { 3: 0, 7: 0, 14: 0, 30: 0 }, maxLen: 20
};
export interface ScoreItem { id: 'superado' | 'perfecto' | 'racha'; days?: number; stars: number }
export interface ScoreResult {
  passed: boolean; pct: number; first: boolean; practice: boolean; items: ScoreItem[]; total: number;
  newStreak: number; streakExtended: boolean; fast: boolean;
}
/** st: ¿ya hubo test hoy?, ¿ya contó la racha hoy?, racha antes del test. res: aciertos, total, prisa */
export function scoreTest(rules: Rules, st: { doneToday: boolean; streakToday: boolean; streak: number }, res: { correct: number; total: number; fast: boolean }): ScoreResult {
  const pct = (res.correct / res.total) * 100;
  const passed = res.correct * 100 >= rules.passPct * res.total;
  const first = !st.doneToday;
  const items: ScoreItem[] = [];
  if (first) {
    if (passed && !res.fast) {
      items.push({ id: 'superado', stars: rules.passBonus[res.total] ?? 0 });
      if (res.correct === res.total) items.push({ id: 'perfecto', stars: rules.perfect });
    }
  }
  let newStreak = st.streak, extended = false;
  if (passed && !st.streakToday) {
    newStreak = st.streak + 1; extended = true;
    const sb = rules.streakBonus[newStreak];
    if (sb && !res.fast) items.push({ id: 'racha', stars: sb, days: newStreak });
  }
  const shown = items.filter(it => it.stars > 0);              // un premio a 0 no sale en el resultado
  const total = shown.reduce((s, it) => s + it.stars, 0);
  return { passed, pct, first, practice: !first, items: shown, total, newStreak, streakExtended: extended, fast: !!res.fast };
}
