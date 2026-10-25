/* Banco de pruebas del motor: 10.000 semillas por generador y una comprobación independiente.
   El segundo camino usa racionales con BigInt y algoritmos distintos (restas repetidas,
   búsqueda de divisores…), así que un error del generador no se repite aquí.               */
import { describe, expect, it } from 'vitest';
import {
  GENERATORS, ERROR_TAGS, qKey, makeQuestion, makeTest, explain, tagFor, isCorrect, valKey, valOk, scoreTest, DEFAULT_RULES, LEVEL_SKILLS,
  type Expr, type Val, type Question
} from '../src/engine';

const N = Number(process.env.SEEDS ?? 10000);

type BR = { n: bigint; d: bigint };
const bgcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const norm = (n: bigint, d: bigint): BR => { if (d < 0n) { n = -n; d = -d; } const g = bgcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const isInt = (x: BR) => x.d === 1n;
function intOf(x: BR | string): bigint { if (typeof x === 'string' || !isInt(x)) throw new Error('no entero'); return x.n; }

function ev(e: Expr): BR | string {
  if (typeof e === 'number') return { n: BigInt(e), d: 1n };
  if ('dec' in e) return norm(BigInt(e.dec), 10n ** BigInt(e.p));
  if ('frac' in e) return norm(BigInt(e.frac[0]), BigInt(e.frac[1]));
  const a = e.args.map(ev);
  const A = a[0] as BR, B = a[1] as BR;
  switch (e.op) {
    case '+': return norm(A.n * B.d + B.n * A.d, A.d * B.d);
    case '-': return norm(A.n * B.d - B.n * A.d, A.d * B.d);
    case '*': return norm(A.n * B.n, A.d * B.d);
    case '/': return norm(A.n * B.d, A.d * B.n);
    case 'idiv': { let x = intOf(A), q = 0n; const y = intOf(B); while (x >= y) { x -= y; q++; } return { n: q, d: 1n }; }
    case 'mod': { let x = intOf(A); const y = intOf(B); while (x >= y) x -= y; return { n: x, d: 1n }; }
    case 'pow': { let p = 1n; for (let i = 0n; i < intOf(B); i++) p *= intOf(A); return { n: p, d: 1n }; }
    case 'sqrt': { const x = intOf(A); for (let k = 0n; k * k <= x; k++) if (k * k === x) return { n: k, d: 1n }; throw new Error('raíz no exacta'); }
    case 'gcd': { const x = intOf(A), y = intOf(B); let best = 1n; for (let k = 1n; k <= x && k <= y; k++) if (x % k === 0n && y % k === 0n) best = k; return { n: best, d: 1n }; }
    case 'lcm': { const x = intOf(A), y = intOf(B); for (let m = x; ; m += x) if (m % y === 0n) return { n: m, d: 1n }; }
    case 'pct': return norm(A.n * B.n, A.d * B.d * 100n);
    case 'round': { const x = intOf(A), t = intOf(B), r = x % t; return { n: r * 2n >= t ? x - r + t : x - r, d: 1n }; }
    case 'cmp': { const c = A.n * B.d - B.n * A.d; return c < 0n ? '<' : c > 0n ? '>' : '='; }
    case 'mean': throw new Error('no usado');
  }
}
function valBR(v: Val): BR | string {
  switch (v.k) {
    case 'int': return { n: BigInt(v.v), d: 1n };
    case 'dec': return norm(BigInt(v.u), 10n ** BigInt(v.p));
    case 'frac': return norm(BigInt(v.n), BigInt(v.d));
    case 'money': return norm(BigInt(v.c), 100n);
    case 'time': return { n: BigInt(v.h * 60 + v.m), d: 1n };
    case 'sym': return v.s;
  }
}
const same = (x: BR | string, y: BR | string) => typeof x === 'string' || typeof y === 'string' ? x === y : x.n === y.n && x.d === y.d;

/** Lo que teclearía el niño para dar la respuesta correcta */
function typed(v: Val): string {
  switch (v.k) {
    case 'int': return String(v.v);
    case 'dec': { const s = String(Math.abs(v.u)).padStart(v.p + 1, '0'); return (v.u < 0 ? '-' : '') + s.slice(0, -v.p) + ',' + s.slice(-v.p); }
    case 'frac': return v.n + '/' + v.d;
    case 'money': return v.c % 100 ? (v.c / 100).toFixed(2).replace('.', ',') : String(v.c / 100);
    default: return '';
  }
}
const tagSet = new Set<string>(ERROR_TAGS);

/** Comprobaciones especiales donde la respuesta es "elige el que cumple" o un dibujo */
function special(q: Question): string | null {
  if (q.gen === 'mult-div') {
    const ok = (v: Val) => v.k === 'int' && (q.data.kind === 0 ? v.v % q.data.k === 0 : q.data.n % v.v === 0);
    if (!ok(q.answer)) return 'la respuesta no cumple la propiedad';
    for (const o of q.options) if (o.tag !== 'ok' && ok(o.v)) return 'un distractor también es correcto: ' + valKey(o.v);
    return null;
  }
  if (q.gen === 'clock' || q.gen === 'clock-quarter') {
    const vis = q.visual as { h: number; m: number };
    if (q.answer.k !== 'time' || q.answer.h !== vis.h || q.answer.m !== vis.m) return 'la hora no coincide con el reloj';
    return null;
  }
  if (q.gen === 'frac-pie') {
    const vis = q.visual as { n: number; d: number };
    return q.answer.k === 'frac' && q.answer.n === vis.n && q.answer.d === vis.d ? null : 'la fracción no coincide con la tarta';
  }
  return null;
}

describe('motor: 10.000 semillas por generador', () => {
  for (const g of GENERATORS) {
    it(g.id + ' (nivel ' + g.level + ')', () => {
      const fails: string[] = [];
      const fail = (m: string) => { if (fails.length < 10) fails.push(m); };
      const tagsSeen = new Set<string>();
      for (let seed = 1; seed <= N; seed++) {
        const q = makeQuestion(g.id, seed);
        const label = g.id + ' #' + seed + ' ' + JSON.stringify(q.prompt.vars);
        // 1. la respuesta coincide con el segundo cálculo
        const sp = special(q);
        if (sp) fail(label + ': ' + sp);
        if (g.id !== 'mult-div' && !same(ev(q.expr), valBR(q.answer))) fail(label + ': respuesta ' + JSON.stringify(q.answer) + ' ≠ ' + JSON.stringify(ev(q.expr)));
        // 2. opciones: 4 (3 en comparaciones), distintas, una sola correcta, todas válidas
        const keys = q.options.map(o => valKey(o.v));
        const expected = q.answer.k === 'sym' ? 3 : 4;
        if (q.options.length !== expected) fail(label + ': ' + q.options.length + ' opciones');
        if (new Set(keys).size !== keys.length) fail(label + ': opciones repetidas');
        if (keys.filter(k => k === valKey(q.answer)).length !== 1) fail(label + ': no hay una sola correcta');
        if (q.options.filter(o => o.tag === 'ok').length !== 1) fail(label + ': etiqueta ok mal puesta');
        const neg = g.level >= 6 && q.pad === 'neg';
        for (const o of q.options) if (!valOk(o.v, neg)) fail(label + ': opción no válida ' + JSON.stringify(o.v));
        // 3. sin negativos antes del nivel 6
        const ans = valBR(q.answer);
        if (typeof ans !== 'string' && ans.n < 0n && g.level < 6) fail(label + ': resultado negativo');
        // 4. cada distractor tiene etiqueta conocida y explicación con pasos
        for (const o of q.options) {
          if (o.tag === 'ok') continue;
          tagsSeen.add(o.tag);
          if (!tagSet.has(o.tag)) fail(label + ': etiqueta sin frase ' + o.tag);
          if (tagFor(q, o.v) !== o.tag) fail(label + ': tagFor no recupera ' + o.tag);
          const x = explain(q, o.tag, o.v);
          if (!x.steps.length) fail(label + ': sin explicación para ' + o.tag);
          if (isCorrect(q, o.v)) fail(label + ': un distractor se da por bueno');
        }
        // 5. teclado numérico: escribir la respuesta correcta se acepta
        if (q.type === 'num') {
          if (!isCorrect(q, typed(q.answer))) fail(label + ': no acepta lo tecleado «' + typed(q.answer) + '»');
          if (q.answer.k === 'dec' && !isCorrect(q, typed(q.answer).replace(',', '.'))) fail(label + ': no acepta el punto decimal');
        }
      }
      expect(fails, fails.join('\n')).toEqual([]);
      expect(tagsSeen.size).toBeGreaterThan(0);
    });
  }
});

describe('armado de tests', () => {
  it('cubre los 6 niveles sin repetir enunciados', () => {
    for (let lv = 1; lv <= 6; lv++) {
      for (const n of [10, 15, 20]) {
        const qs = makeTest(lv, n, 1234 + lv * n);
        expect(qs.length).toBe(n);
        expect(new Set(qs.map(qKey)).size).toBe(n);
        const current = qs.filter(q => q.level === lv).length;
        expect(current).toBeGreaterThanOrEqual(Math.floor(n * 0.6));
      }
    }
  });
  it('el repaso usa las habilidades con errores recientes', () => {
    const qs = makeTest(3, 20, 99, { review: ['sub-borrow'] });
    expect(qs.filter(q => q.gen === 'sub-borrow').length).toBe(6);
  });
  it('da más peso a las habilidades con menos dominio', () => {
    const mastery = Object.fromEntries(LEVEL_SKILLS[2].map(id => [id, 95]));
    mastery['coins'] = 5;
    let coins = 0;
    for (let s = 0; s < 200; s++) coins += makeTest(2, 10, s, { mastery }).filter(q => q.gen === 'coins').length;
    expect(coins / 200).toBeGreaterThan(2.5);
  });
  it('cada nivel tiene al menos 6 habilidades', () => {
    for (let lv = 1; lv <= 6; lv++) expect(LEVEL_SKILLS[lv].length).toBeGreaterThanOrEqual(6);
  });
});

describe('teclado numérico', () => {
  it('acepta coma y punto, y exige simplificar cuando toca', () => {
    const q = makeQuestion('dec-add', 5);
    const s = typed(q.answer);
    expect(isCorrect(q, s)).toBe(true);
    const f = makeQuestion('frac-add-same', 3);
    expect(f.answer.k).toBe('frac');
  });
  it('etiqueta un resultado sin simplificar', () => {
    const q = { ...makeQuestion('frac-add-diff', 11), reduced: true } as Question;
    if (q.answer.k === 'frac') expect(tagFor(q, q.answer.n * 2 + '/' + q.answer.d * 2)).toBe('sin-simplificar');
  });
});

describe('reglas de estrellas', () => {
  const R = DEFAULT_RULES;
  it('10 preguntas con 8 aciertos da 10 estrellas', () => {
    expect(scoreTest(R, { doneToday: false, streakToday: false, streak: 0 }, { correct: 8, total: 10, fast: false }).total).toBe(10);
  });
  it('perfecto y bonus de racha del día 7', () => {
    const s = scoreTest(R, { doneToday: false, streakToday: false, streak: 6 }, { correct: 20, total: 20, fast: false });
    expect(s.total).toBe(20 + 4 + 3 + 7);
    expect(s.newStreak).toBe(7);
  });
  it('el segundo test del día es práctica y la prisa quita bonus', () => {
    expect(scoreTest(R, { doneToday: true, streakToday: true, streak: 3 }, { correct: 10, total: 10, fast: false }).total).toBe(0);
    expect(scoreTest(R, { doneToday: false, streakToday: false, streak: 2 }, { correct: 10, total: 10, fast: true }).total).toBe(10);
  });
  it('7 de 10 aprueba; 10 de 15 no', () => {
    expect(scoreTest(R, { doneToday: false, streakToday: false, streak: 0 }, { correct: 7, total: 10, fast: false }).passed).toBe(true);
    expect(scoreTest(R, { doneToday: false, streakToday: false, streak: 0 }, { correct: 10, total: 15, fast: false }).passed).toBe(false);
  });
});
