/* Generadores de los niveles 4 a 6. Decimales como enteros escalados y fracciones como pares de
   enteros: ninguna respuesta pasa por coma flotante.                                            */
import { ex, I, D, F, S, EUR, pick, ri, gcd, lcm, decNorm, fracNorm, rat, rCmp, type Option, type Rng, type Val, type Draft } from './core';
import { st, type Generator } from './types';
import { NAMES } from './gens-basic';

const o = (v: Val, tag: string): Option => ({ v, tag });
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶'];
const SHOP = ['notebooks', 'pens', 'tickets', 'balls', 'comics', 'plants'];
const fracExpr = (n: number, d: number) => ({ frac: [n, d] as [number, number] });

function retry(r: Rng, f: (r: Rng) => Draft | null): Draft {
  for (let i = 0; i < 200; i++) { const d = f(r); if (d) return d; }
  throw new Error('generador sin caso válido');
}

export const ADVANCED: Generator[] = [
  /* ---------------- Nivel 4 ---------------- */
  {
    id: 'mult-2digit', level: 4,
    make(r) {
      const a = ri(r, 12, 99), bt = ri(r, 1, 3), bu = ri(r, 1, 9), b = bt * 10 + bu, ans = a * b;
      return { prompt: { key: 'mul', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('*', a, b), data: { a, b, bt, bu }, cands: [
        o(I(a * bu + a * bt), 'mult-parcial'), o(I(a * bu), 'mult-parcial'), o(I(a * bt * 10), 'mult-parcial'),
        o(I(ans + 10), 'decena-mal'), o(I(ans - 10), 'decena-mal'), o(I(ans + 100), 'olvido-llevada')], numShare: 0.5 };
    },
    explain(q) {
      const { a, bt, bu } = q.data;
      return { steps: [st('ex.m2.s1', { a: I(a), bu: I(bu), p1: I(a * bu) }), st('ex.m2.s2', { a: I(a), bt: I(bt * 10), p2: I(a * bt * 10) }),
                       st('ex.m2.s3', { p1: I(a * bu), p2: I(a * bt * 10), ans: q.answer })], visual: { type: 'mulcols', a, b: bt * 10 + bu } };
    }
  },
  {
    id: 'div-rem', level: 4,
    make(r): Draft {
      const b = ri(r, 3, 9), qn = ri(r, 3, 15), rem = ri(r, 1, b - 1), a = b * qn + rem;
      if (r() < 0.5) {
        return { prompt: { key: 'divQ', vars: { a: I(a), b: I(b), r: I(rem) } }, answer: I(qn), expr: ex('idiv', a, b), data: { a, b, q: qn, r: rem, askR: 0 }, cands: [
          o(I(qn + 1), 'cociente-mal'), o(I(qn - 1), 'cociente-mal'), o(I(rem), 'resto-cociente'), o(I(b), 'cifra-copiada'), o(I(qn + 2), 'cuenta-mal')], numShare: 0.5 };
      }
      return { prompt: { key: 'divR', vars: { a: I(a), b: I(b), c: I(qn) } }, answer: I(rem), expr: ex('mod', a, b), data: { a, b, q: qn, r: rem, askR: 1 }, cands: [
        o(I(qn), 'resto-cociente'), o(I(b - rem), 'resto-mal'), o(I(rem + b), 'resto-mal'), o(I(rem + 1), 'cuenta-mal'), o(I(rem - 1), 'cuenta-mal')], numShare: 0.5 };
    },
    explain(q) {
      const { a, b, q: qn, r } = q.data;
      return { steps: [st('ex.drem.s1', { a: I(a), b: I(b), q: I(qn), bq: I(b * qn) }), st('ex.drem.s2', { a: I(a), bq: I(b * qn), r: I(r) }),
                       st('ex.drem.s3', { r: I(r), b: I(b) }), st('ex.drem.s4', { a: I(a), b: I(b), q: I(qn), r: I(r) })] };
    }
  },
  {
    id: 'frac-compare', level: 4,
    make(r) {
      return retry(r, r => {
        const sameNum = r() < 0.5;
        let a: [number, number], b: [number, number];
        if (sameNum) { const n = ri(r, 1, 4), d1 = ri(r, n + 1, 12), d2 = ri(r, n + 1, 12); if (d1 === d2) return null; a = [n, d1]; b = [n, d2]; }
        else { const d = ri(r, 3, 12), n1 = ri(r, 1, d - 1), n2 = ri(r, 1, d - 1); if (n1 === n2) return null; a = [n1, d]; b = [n2, d]; }
        const c = rCmp(rat(a[0], a[1]), rat(b[0], b[1]));
        const s = c < 0 ? '<' : '>', other = c < 0 ? '>' : '<';
        return { prompt: { key: 'cmp', vars: { a: F(a[0], a[1]), b: F(b[0], b[1]) } }, answer: S(s), expr: ex('cmp', fracExpr(a[0], a[1]), fracExpr(b[0], b[1])),
          data: { an: a[0], ad: a[1], bn: b[0], bd: b[1], sameNum: sameNum ? 1 : 0 }, cands: [o(S(other), sameNum ? 'frac-mayor-denominador' : 'comparar-al-reves'), o(S('='), 'comparar-igual')],
          mcOnly: true, visual: { type: 'pies', a, b } };
      });
    },
    explain(q) {
      const d = q.data;
      return { steps: [st(d.sameNum ? 'ex.fcmp.num' : 'ex.fcmp.den', { n: I(d.an), d: I(d.ad) }), st('ex.fcmp.end', { a: F(d.an, d.ad), b: F(d.bn, d.bd), s: q.answer })],
               visual: { type: 'pies', a: [d.an, d.ad], b: [d.bn, d.bd] } };
    }
  },
  {
    id: 'dec-add', level: 4,
    make(r) {
      const p = r() < 0.5 ? 1 : 2, max = p === 1 ? 89 : 899;
      const plus = r() < 0.6;
      let a = ri(r, 2, max), b = ri(r, 2, max);
      if (!plus && a < b) [a, b] = [b, a];
      if (a === b) a += 1;
      const u = plus ? a + b : a - b;
      return { prompt: { key: plus ? 'add' : 'sub', vars: { a: D(a, p), b: D(b, p) } }, answer: decNorm(u, p), expr: ex(plus ? '+' : '-', { dec: a, p }, { dec: b, p }),
        data: { a, b, p, plus: plus ? 1 : 0 }, pad: 'dec', visual: { type: 'decs', a: D(a, p), b: D(b, p), op: plus ? '+' : '-', ans: decNorm(u, p) }, cands: [
          o(decNorm(u, p + 1), 'coma-mal-puesta'), o(decNorm(u, Math.max(p - 1, 0) || 0), 'coma-mal-puesta'), o(I(u), 'coma-mal-puesta'),
          o(decNorm(u + 1, p), 'cuenta-mal'), o(decNorm(u - 1, p), 'cuenta-mal'), o(decNorm(plus ? Math.abs(a - b) : a + b, p), plus ? 'resta-en-vez' : 'suma-en-vez')], numShare: 0.5 };
    },
    explain(q) {
      const { a, b, p, plus } = q.data;
      return { steps: [st('ex.dec.align'), st(p === 1 ? 'ex.dec.tenths' : 'ex.dec.hundredths', { a: I(a), b: I(b), u: I(plus ? a + b : a - b) }), st('ex.dec.comma', { ans: q.answer })],
               visual: q.visual };
    }
  },
  {
    id: 'word-2', level: 4,
    make(r) {
      const name = pick(r, NAMES), item = '@shop.' + pick(r, SHOP), n = ri(r, 2, 6), price = ri(r, 2, 9);
      const cost = n * price, bill = [10, 20, 50, 100].find(x => x > cost) as number;
      const ans = bill - cost;
      return { prompt: { key: 'w.change', vars: { name, item, n: I(n), p: EUR(price * 100), bill: EUR(bill * 100) } }, answer: EUR(ans * 100),
        expr: ex('-', bill, ex('*', n, price)), data: { n, price, bill, cost }, pad: 'money', cands: [
          o(EUR(cost * 100), 'paso-olvidado'), o(EUR((bill - price) * 100), 'paso-olvidado'), o(EUR((bill + cost) * 100), 'suma-en-vez'),
          o(EUR((ans + 1) * 100), 'cuenta-mal'), o(EUR((ans - 1) * 100), 'cuenta-mal')], numShare: 0.4 };
    },
    explain(q) {
      const { n, price, bill, cost } = q.data;
      return { steps: [st('ex.w2.s1', { n: I(n), p: EUR(price * 100), cost: EUR(cost * 100) }), st('ex.w2.s2', { bill: EUR(bill * 100), cost: EUR(cost * 100), ans: q.answer })] };
    }
  },
  {
    id: 'area-rect', level: 4,
    make(r) {
      const w = ri(r, 3, 12), h = ri(r, 2, 9), ans = w * h;
      return { prompt: { key: 'areaRect', vars: { w: I(w), h: I(h) } }, answer: I(ans), expr: ex('*', w, h), data: { w, h },
        visual: { type: 'rect', w, h, unit: 'cm', show: 'grid' }, cands: [
          o(I(2 * (w + h)), 'area-perimetro'), o(I(w + h), 'perimetro-lados'), o(I(ans + w), 'tabla-cercana'), o(I(ans - h), 'tabla-cercana'), o(I(ans + 10), 'decena-mal')], numShare: 0.5 };
    },
    explain(q) {
      const { w, h } = q.data;
      return { steps: [st('ex.area.what'), st('ex.area.rect', { w: I(w), h: I(h), ans: q.answer })], visual: { type: 'rect', w, h, unit: 'cm', show: 'grid' } };
    }
  },
  {
    id: 'round', level: 4,
    make(r) {
      return retry(r, r => {
        const n = ri(r, 10000, 99999), to = pick(r, [10, 100, 1000]);
        const down = Math.floor(n / to) * to, up = down + to;
        if (n === down) return null;
        const ans = n - down >= to / 2 ? up : down, other = ans === up ? down : up;
        const bigger = to * 10, wrongPlace = Math.round(n / bigger) * bigger;
        return { prompt: { key: 'round', vars: { n: I(n), to: '@round.' + to } }, answer: I(ans), expr: ex('round', n, to), data: { n, to, down, up },
          cands: [o(I(other), 'redondeo-mal'), o(I(wrongPlace), 'valor-posicional'), o(I(Math.round(n / (to / 10 || 1)) * (to / 10 || 1)), 'valor-posicional'), o(I(ans + to), 'redondeo-mal')], numShare: 0.3 };
      });
    },
    explain(q) {
      const { n, to, down, up } = q.data;
      const dgt = Math.floor((n % to) / (to / 10));
      return { steps: [st('ex.round.s1', { n: I(n), down: I(down), up: I(up) }), st('ex.round.s2', { d: I(dgt) }), st(dgt >= 5 ? 'ex.round.up' : 'ex.round.down', { ans: q.answer })],
               visual: { type: 'line', from: down, to: up, marks: [n], hi: n } };
    }
  },

  /* ---------------- Nivel 5 ---------------- */
  {
    id: 'dec-ops', level: 5,
    make(r) {
      if (r() < 0.5) {
        const a = ri(r, 1, 9), b = ri(r, 11, 99);       // a décimas + b centésimas: 0,a + 0,bb
        if (b % 10 === 0) return ADVANCED_BY_ID['dec-ops'].make(r);
        const u = a * 10 + b;
        return { prompt: { key: 'add', vars: { a: D(a, 1), b: D(b, 2) } }, answer: decNorm(u, 2), expr: ex('+', { dec: a, p: 1 }, { dec: b, p: 2 }), data: { a, b, mixed: 1 },
          pad: 'dec', visual: { type: 'decs', a: D(a * 10, 2), b: D(b, 2), op: '+', ans: decNorm(u, 2) }, cands: [
            o(decNorm(a + b, 2), 'coma-mal-puesta'), o(decNorm(a + b, 1), 'coma-mal-puesta'), o(decNorm(u + 10, 2), 'decena-mal'), o(decNorm(u - 1, 2), 'cuenta-mal'), o(decNorm(u + 1, 2), 'cuenta-mal')], numShare: 0.5 };
      }
      const a = ri(r, 11, 99), p = 2, k = ri(r, 2, 6), u = a * k;                // 0,aa × k
      return { prompt: { key: 'mul', vars: { a: D(a, p), b: I(k) } }, answer: decNorm(u, p), expr: ex('*', { dec: a, p }, k), data: { a, k, mixed: 0 }, pad: 'dec', cands: [
        o(decNorm(u, p + 1), 'coma-mal-puesta'), o(decNorm(u, p - 1), 'coma-mal-puesta'), o(I(u), 'coma-mal-puesta'), o(decNorm(a + k * 100, p), 'suma-en-vez'), o(decNorm(u + k, p), 'cuenta-mal')], numShare: 0.5 };
    },
    explain(q) {
      const d = q.data;
      if (d.mixed) return { steps: [st('ex.dec.align'), st('ex.dec.zero', { a: D(d.a, 1), a0: D(d.a * 10, 2) }), st('ex.dec.comma', { ans: q.answer })], visual: q.visual };
      return { steps: [st('ex.decmul.s1', { a: I(d.a), k: I(d.k), u: I(d.a * d.k) }), st('ex.decmul.s2', { p: I(2), ans: q.answer })] };
    }
  },
  {
    id: 'frac-add-same', level: 5,
    make(r) {
      const d = ri(r, 3, 12), plus = r() < 0.6;
      let a = ri(r, 1, d - 2), b = ri(r, 1, d - 1 - a);
      if (!plus && a === b) { a = Math.min(a + 1, d - 1); }
      if (!plus && a < b) [a, b] = [b, a];
      const n = plus ? a + b : a - b;
      if (n <= 0 || n >= d) return ADVANCED_BY_ID['frac-add-same'].make(r);
      const cands = [o(F(n + 1, d), 'cuenta-mal'), o(F(Math.max(n - 1, 1), d), 'cuenta-mal'), o(F(plus ? a * b : a + b, d), plus ? 'cuenta-mal' : 'suma-en-vez')];
      if (plus) cands.push(o(F(n, 2 * d), 'frac-suma-den'));
      return { prompt: { key: plus ? 'add' : 'sub', vars: { a: F(a, d), b: F(b, d) } }, answer: F(n, d), expr: ex(plus ? '+' : '-', fracExpr(a, d), fracExpr(b, d)),
        data: { a, b, d, plus: plus ? 1 : 0 }, pad: 'frac', cands, numShare: 0.4, visual: { type: 'pie', n, d } };
    },
    explain(q) {
      const { a, b, d, plus } = q.data;
      return { steps: [st('ex.fsame.s1', { d: I(d) }), st(plus ? 'ex.fsame.add' : 'ex.fsame.sub', { a: I(a), b: I(b), n: I(plus ? a + b : a - b) }), st('ex.fsame.s3', { ans: q.answer })],
               visual: { type: 'pie', n: plus ? a + b : a - b, d } };
    }
  },
  {
    id: 'frac-equiv', level: 5,
    make(r) {
      let n: number, d: number;
      do { d = ri(r, 2, 7); n = ri(r, 1, d - 1); } while (gcd(n, d) !== 1);
      const k = ri(r, 2, 6), d2 = d * k, ans = n * k;
      return { prompt: { key: 'fracEquiv', vars: { f: F(n, d), d2: I(d2) } }, answer: I(ans), expr: ex('*', fracExpr(n, d), d2), data: { n, d, k, d2 }, cands: [
        o(I(n + d2 - d), 'frac-equiv-sumar'), o(I(ans + 1), 'cuenta-mal'), o(I(ans - 1), 'cuenta-mal'), o(I(n), 'cifra-copiada'), o(I(k), 'cuenta-mal')], numShare: 0.5 };
    },
    explain(q) {
      const { n, d, k, d2 } = q.data;
      return { steps: [st('ex.fequiv.s1', { d: I(d), d2: I(d2), k: I(k) }), st('ex.fequiv.s2', { n: I(n), k: I(k), ans: q.answer }), st('ex.fequiv.s3', { f: F(n, d), g: F(n * k, d2) })] };
    }
  },
  {
    id: 'percent-simple', level: 5,
    make(r) {
      const p = pick(r, [10, 25, 50]);
      const n = p === 10 ? 10 * ri(r, 2, 20) : p === 25 ? 4 * ri(r, 2, 25) : 2 * ri(r, 5, 60);
      const ans = n * p / 100;
      const cands = [o(I(n - ans), 'porcentaje-resto'), o(I(ans * 2), 'cuenta-mal'), o(I(p), 'cifra-copiada'), o(I(ans + 10), 'decena-mal')];
      if (n % p === 0) cands.push(o(I(n / p), 'porcentaje-mal'));
      return { prompt: { key: 'pct', vars: { p: I(p), n: I(n) } }, answer: I(ans), expr: ex('pct', p, n), data: { p, n }, cands, numShare: 0.5 };
    },
    explain(q) {
      const { p, n } = q.data, k = 100 / p;
      return { steps: [st('ex.pct.simple', { p: I(p), k: I(k) }), st('ex.pct.div', { n: I(n), k: I(k), ans: q.answer })], visual: { type: 'pie', n: 1, d: k } };
    }
  },
  {
    id: 'mult-div', level: 5,
    make(r) {
      return retry(r, (r): Draft | null => {
        if (r() < 0.5) {
          const k = ri(r, 3, 9), ans = k * ri(r, 3, 12);
          const wrong = new Set<number>();
          const cands: Option[] = [];
          for (const div of [2, 3, 4]) if (k % div === 0 && div !== k) { cands.push(o(I(div), 'multiplo-divisor')); wrong.add(div); }
          while (cands.length < 5) {
            const v = k * ri(r, 2, 12) + pick(r, [1, 2, -1, -2]);
            if (v % k !== 0 && !wrong.has(v) && v > 0) { wrong.add(v); cands.push(o(I(v), 'cuenta-mal')); }
          }
          return { prompt: { key: 'multipleOf', vars: { k: I(k) } }, answer: I(ans), expr: ex('mod', ans, k), data: { k, kind: 0 }, cands, mcOnly: true };
        }
        const n = pick(r, [12, 18, 20, 24, 30, 36, 40, 48, 60]);
        const divs = [] as number[]; for (let i = 2; i < n; i++) if (n % i === 0) divs.push(i);
        const ans = pick(r, divs);
        const cands: Option[] = [o(I(2 * n), 'multiplo-divisor'), o(I(3 * n), 'multiplo-divisor')];
        const seen = new Set<number>([2 * n, 3 * n]);
        while (cands.length < 6) {
          const v = ri(r, 4, n - 1);
          if (n % v !== 0 && !seen.has(v)) { seen.add(v); cands.push(o(I(v), 'cuenta-mal')); }
        }
        return { prompt: { key: 'divisorOf', vars: { n: I(n) } }, answer: I(ans), expr: ex('mod', n, ans), data: { n, kind: 1 }, cands, mcOnly: true };
      });
    },
    explain(q) {
      const d = q.data, a = q.answer.k === 'int' ? q.answer.v : 0;
      return d.kind === 0 ? { steps: [st('ex.mdiv.multiple', { k: I(d.k) }), st('ex.mdiv.mcheck', { a: I(a), k: I(d.k), q: I(a / d.k) })] }
                          : { steps: [st('ex.mdiv.divisor', { n: I(d.n) }), st('ex.mdiv.dcheck', { a: I(a), n: I(d.n), q: I(d.n / a) })] };
    }
  },
  {
    id: 'area-tri', level: 5,
    make(r) {
      let b: number, h: number;
      do { b = ri(r, 3, 14); h = ri(r, 2, 12); } while ((b * h) % 2 !== 0);
      const ans = b * h / 2;
      return { prompt: { key: 'areaTri', vars: { b: I(b), h: I(h) } }, answer: I(ans), expr: ex('/', ex('*', b, h), 2), data: { b, h }, visual: { type: 'trih', b, h, unit: 'cm' }, cands: [
        o(I(b * h), 'area-triangulo'), o(I(b + h), 'perimetro-lados'), o(I(ans + 1), 'cuenta-mal'), o(I(ans - 1), 'cuenta-mal'), o(I(ans + b), 'cuenta-mal')], numShare: 0.5 };
    },
    explain(q) {
      const { b, h } = q.data;
      return { steps: [st('ex.atri.s1'), st('ex.atri.s2', { b: I(b), h: I(h), bh: I(b * h), ans: q.answer })], visual: { type: 'trih', b, h, unit: 'cm' } };
    }
  },
  {
    id: 'digit-value', level: 5,
    make(r) {
      return retry(r, r => {
        const n = ri(r, 1000000, 9999999), s = String(n), pos = ri(r, 0, 6), dg = parseInt(s[6 - pos], 10);
        if (dg === 0 || s.split('').filter(c => c === s[6 - pos]).length !== 1) return null;
        const ans = dg * 10 ** pos;
        const cands = [o(I(dg), 'valor-posicional'), o(I(dg * 10 ** (pos + 1)), 'valor-posicional')];
        if (pos > 0) cands.push(o(I(dg * 10 ** (pos - 1)), 'valor-posicional'));
        if (pos < 5) cands.push(o(I(dg * 10 ** (pos + 2)), 'valor-posicional'));
        return { prompt: { key: 'digitValue', vars: { n: I(n), d: I(dg) } }, answer: I(ans), expr: ex('*', dg, 10 ** pos), data: { n, pos, dg }, cands, mcOnly: pos > 3, numShare: 0.3, visual: { type: 'place', n } };
      });
    },
    explain(q) {
      const { pos, dg, n } = q.data;
      return { steps: [st('ex.dval.s1', { d: I(dg), place: '@place.' + pos }), st('ex.dval.s2', { ans: q.answer })], visual: { type: 'place', n } };
    }
  },

  /* ---------------- Nivel 6 ---------------- */
  {
    id: 'frac-add-diff', level: 6,
    make(r) {
      return retry(r, r => {
        const dens = [2, 3, 4, 5, 6, 8, 10, 12];
        const b = pick(r, dens), d = pick(r, dens);
        if (b === d) return null;
        const a = ri(r, 1, b - 1), c = ri(r, 1, d - 1);
        if (gcd(a, b) !== 1 || gcd(c, d) !== 1) return null;
        const L = lcm(b, d);
        if (L > 40) return null;
        const plus = r() < 0.6 || rCmp(rat(a, b), rat(c, d)) <= 0;
        const num = plus ? a * (L / b) + c * (L / d) : a * (L / b) - c * (L / d);
        if (num <= 0) return null;
        const ans = fracNorm(num, L);
        if (ans.k !== 'frac') return null;
        const cands = [o(F(plus ? a + c : Math.abs(a - c) || 1, b + d), 'frac-den-distinto'), o(F(plus ? a + c : Math.abs(a - c) || 1, L), 'frac-den-distinto'),
          o(fracNorm(num + 1, L), 'cuenta-mal'), o(fracNorm(Math.max(num - 1, 1), L), 'cuenta-mal')];
        return { prompt: { key: plus ? 'add' : 'sub', vars: { a: F(a, b), b: F(c, d) } }, answer: ans, expr: ex(plus ? '+' : '-', fracExpr(a, b), fracExpr(c, d)),
          data: { a, b, c, d, L, num, plus: plus ? 1 : 0 }, pad: 'frac', cands, numShare: 0.35 };
      });
    },
    explain(q) {
      const { a, b, c, d, L, num, plus } = q.data;
      const steps = [st('ex.fdiff.s1', { b: I(b), d: I(d), L: I(L) }), st('ex.fdiff.s2', { f1: F(a, b), g1: F(a * L / b, L), f2: F(c, d), g2: F(c * L / d, L) }),
                     st(plus ? 'ex.fdiff.add' : 'ex.fdiff.sub', { n1: I(a * L / b), n2: I(c * L / d), n: I(num), L: I(L) })];
      if (gcd(num, L) > 1) steps.push(st('ex.fdiff.simp', { f: F(num, L), ans: q.answer }));
      return { steps };
    }
  },
  {
    id: 'dec-mult', level: 6,
    make(r) {
      const a = ri(r, 2, 9) + (r() < 0.4 ? 10 * ri(r, 1, 3) : 0), b = ri(r, 2, 9), u = a * b;
      return { prompt: { key: 'mul', vars: { a: D(a, 1), b: D(b, 1) } }, answer: decNorm(u, 2), expr: ex('*', { dec: a, p: 1 }, { dec: b, p: 1 }), data: { a, b }, pad: 'dec', cands: [
        o(decNorm(u, 1), 'coma-mal-puesta'), o(decNorm(u, 3), 'coma-mal-puesta'), o(I(u), 'coma-mal-puesta'), o(decNorm(a + b, 1), 'suma-en-vez'), o(decNorm(u + 1, 2), 'cuenta-mal')], numShare: 0.5 };
    },
    explain(q) {
      const { a, b } = q.data;
      return { steps: [st('ex.decmul.s1', { a: I(a), k: I(b), u: I(a * b) }), st('ex.decmul.count'), st('ex.decmul.s2', { p: I(2), ans: q.answer })] };
    }
  },
  {
    id: 'percent', level: 6,
    make(r) {
      const p = pick(r, [5, 15, 20, 30, 40, 60, 75]), n = 20 * ri(r, 1, 15), ans = n * p / 100;
      return { prompt: { key: 'pct', vars: { p: I(p), n: I(n) } }, answer: I(ans), expr: ex('pct', p, n), data: { p, n }, cands: [
        o(I(n - ans), 'porcentaje-resto'), o(I(n * p / 10), 'porcentaje-mal'), o(I(p), 'cifra-copiada'), o(I(ans + n / 10), 'cuenta-mal'), o(I(ans + 1), 'cuenta-mal')], numShare: 0.5 };
    },
    explain(q) {
      const { p, n } = q.data;
      return { steps: [st('ex.pct.one', { n: I(n), one: decNorm(n, 2) }), st('ex.pct.times', { p: I(p), ans: q.answer, n: I(n) })] };
    }
  },
  {
    id: 'proportion', level: 6,
    make(r) {
      const item = '@shop.' + pick(r, SHOP), u = ri(r, 2, 9), n1 = ri(r, 2, 5);
      let n2 = ri(r, 2, 10); if (n2 === n1) n2 = n1 + 3;
      const p1 = u * n1, ans = u * n2;
      return { prompt: { key: 'w.prop', vars: { item, n1: I(n1), p1: EUR(p1 * 100), n2: I(n2) } }, answer: EUR(ans * 100), expr: ex('*', ex('/', p1, n1), n2),
        data: { u, n1, n2, p1 }, pad: 'money', cands: [
          o(EUR((p1 + n2 - n1) * 100), 'proporcion-sumar'), o(EUR(p1 * n2 * 100), 'paso-olvidado'), o(EUR(u * 100), 'paso-olvidado'), o(EUR((ans + u) * 100), 'cuenta-mal'), o(EUR((ans - 1) * 100), 'cuenta-mal')], numShare: 0.4 };
    },
    explain(q) {
      const { u, n1, n2, p1 } = q.data;
      return { steps: [st('ex.prop.s1', { p1: EUR(p1 * 100), n1: I(n1), u: EUR(u * 100) }), st('ex.prop.s2', { u: EUR(u * 100), n2: I(n2), ans: q.answer })] };
    }
  },
  {
    id: 'power-root', level: 6,
    make(r): Draft {
      const kind = pick(r, ['sq', 'sq', 'cube', 'p10', 'sqrt', 'sqrt']);
      if (kind === 'sq') {
        const n = ri(r, 2, 15), ans = n * n;
        return { prompt: { key: 'pow', vars: { a: I(n), e: '²' } }, answer: I(ans), expr: ex('pow', n, 2), data: { n, e: 2, kind: 0 }, cands: [
          o(I(2 * n), 'potencia-por'), o(I(ans + n), 'tabla-cercana'), o(I(ans - n), 'tabla-cercana'), o(I((n + 1) * (n + 1)), 'cuenta-mal')], numShare: 0.5 };
      }
      if (kind === 'cube') {
        const n = ri(r, 2, 5), ans = n ** 3;
        return { prompt: { key: 'pow', vars: { a: I(n), e: '³' } }, answer: I(ans), expr: ex('pow', n, 3), data: { n, e: 3, kind: 0 }, cands: [
          o(I(3 * n), 'potencia-por'), o(I(n * n), 'potencia-por'), o(I(ans + n), 'cuenta-mal'), o(I((n + 1) ** 3), 'cuenta-mal')], numShare: 0.5 };
      }
      if (kind === 'p10') {
        const e = ri(r, 2, 6), ans = 10 ** e;
        return { prompt: { key: 'pow', vars: { a: I(10), e: SUP[e] } }, answer: I(ans), expr: ex('pow', 10, e), data: { n: 10, e, kind: 0 }, cands: [
          o(I(10 * e), 'potencia-por'), o(I(10 ** (e + 1)), 'valor-posicional'), o(I(10 ** (e - 1)), 'valor-posicional')], mcOnly: true };
      }
      const n = ri(r, 2, 15), sq = n * n;
      const cands = [o(I(n + 1), 'cuenta-mal'), o(I(n - 1), 'cuenta-mal'), o(I(2 * n), 'cuenta-mal')];
      if (sq % 2 === 0) cands.push(o(I(sq / 2), 'raiz-mitad'));
      return { prompt: { key: 'sqrt', vars: { a: I(sq) } }, answer: I(n), expr: ex('sqrt', sq), data: { n, sq, kind: 1 }, cands, numShare: 0.5 };
    },
    explain(q) {
      const d = q.data;
      if (d.kind === 1) return { steps: [st('ex.sqrt.s1', { a: I(d.sq) }), st('ex.sqrt.s2', { n: I(d.n), a: I(d.sq) })] };
      const factors = Array(d.e).fill(d.n).join(' × ');
      return { steps: [st('ex.pow.s1', { n: I(d.n), e: I(d.e) }), st('ex.pow.s2', { f: factors, ans: q.answer })] };
    }
  },
  {
    id: 'negatives', level: 6,
    make(r) {
      return retry(r, r => {
        const a = ri(r, -12, 12), b = ri(r, 1, 12) * (r() < 0.5 ? -1 : 1), plus = r() < 0.5;
        if (a === 0) return null;
        const ans = plus ? a + b : a - b;
        if (Math.abs(ans) > 24 || (a > 0 && b > 0 && ans > 0)) return null;
        const cands = [o(I(-ans), 'signo-mal'), o(I(ans + 1), 'cuenta-mal'), o(I(ans - 1), 'cuenta-mal'), o(I(plus ? a - b : a + b), plus ? 'resta-en-vez' : 'suma-en-vez'),
          o(I(Math.abs(a) + Math.abs(b)), 'signo-mal')];
        return { prompt: { key: plus ? 'addN' : 'subN', vars: { a: I(a), bP: I(b) } }, answer: I(ans), expr: ex(plus ? '+' : '-', a, b), data: { a, b, plus: plus ? 1 : 0 },
          pad: 'neg', allowNeg: true, cands, numShare: 0.4, visual: { type: 'line', from: Math.min(a, ans, 0) - 1, to: Math.max(a, ans, 0) + 1, marks: [a, ans], hi: ans } };
      });
    },
    explain(q) {
      const { a, b, plus } = q.data;
      const move = plus ? b : -b;
      return { steps: [st('ex.neg.start', { a: I(a) }), st(move > 0 ? 'ex.neg.right' : 'ex.neg.left', { m: I(Math.abs(move)) }), st('ex.neg.end', { ans: q.answer })], visual: q.visual };
    }
  },
  {
    id: 'gcd-lcm', level: 6,
    make(r) {
      return retry(r, r => {
        const a = ri(r, 4, 24), b = ri(r, 4, 24);
        if (a === b || gcd(a, b) === 1 || a % b === 0 || b % a === 0) return null;
        const g = gcd(a, b), l = lcm(a, b);
        if (l > 150) return null;
        if (r() < 0.5) {
          const cands = [o(I(l), 'mcd-mcm'), o(I(Math.min(a, b)), 'cifra-copiada'), o(I(g + 1), 'cuenta-mal')];
          for (let x = g - 1; x > 1; x--) if (g % x === 0) { cands.push(o(I(x), 'divisor-comun')); break; }
          return { prompt: { key: 'gcd', vars: { a: I(a), b: I(b) } }, answer: I(g), expr: ex('gcd', a, b), data: { a, b, g, l, isG: 1 }, cands, numShare: 0.4 };
        }
        const cands = [o(I(g), 'mcd-mcm'), o(I(Math.max(a, b)), 'cifra-copiada'), o(I(2 * l), 'multiplo-comun')];
        if (a * b !== l) cands.push(o(I(a * b), 'multiplo-comun'));
        return { prompt: { key: 'lcm', vars: { a: I(a), b: I(b) } }, answer: I(l), expr: ex('lcm', a, b), data: { a, b, g, l, isG: 0 }, cands, numShare: 0.4 };
      });
    },
    explain(q) {
      const { a, b, g, l, isG } = q.data;
      if (isG) {
        const da: Val[] = []; for (let i = 1; i <= a; i++) if (a % i === 0) da.push(I(i));
        return { steps: [st('ex.gcd.s1', { a: I(a), b: I(b) }), st('ex.gcd.s2', { g: I(g) })], visual: { type: 'chips', items: da, hi: da.findIndex(v => v.k === 'int' && v.v === g) } };
      }
      const ma: Val[] = []; for (let i = 1; i * a <= l; i++) ma.push(I(i * a));
      return { steps: [st('ex.lcm.s1', { a: I(a), b: I(b) }), st('ex.lcm.s2', { l: I(l) })], visual: { type: 'chips', items: ma, hi: ma.length - 1 } };
    }
  },
  {
    id: 'mean', level: 6,
    make(r) {
      return retry(r, r => {
        const k = ri(r, 3, 5), vals = Array.from({ length: k - 1 }, () => ri(r, 2, 20));
        const target = ri(r, 4, 16), last = target * k - vals.reduce((s, v) => s + v, 0);
        if (last < 1 || last > 30) return null;
        vals.push(last);
        const sum = target * k;
        const vars: Record<string, Val> = {}; vals.forEach((v, i) => { vars['v' + (i + 1)] = I(v); });
        const cands = [o(I(sum), 'media-sin-dividir'), o(I(Math.max(...vals)), 'cifra-copiada'), o(I(target + 1), 'cuenta-mal'), o(I(target - 1), 'cuenta-mal')];
        if (sum % (k - 1) === 0) cands.push(o(I(sum / (k - 1)), 'media-mal-contar'));
        const e = vals.slice(1).reduce<import('./core').Expr>((acc, v) => ex('+', acc, v), vals[0]);
        return { prompt: { key: 'mean_' + k, vars }, answer: I(target), expr: ex('/', e, k), data: { k, sum }, cands, numShare: 0.5, visual: { type: 'bars', values: vals } };
      });
    },
    explain(q) {
      const { k, sum } = q.data;
      return { steps: [st('ex.mean.s1', { sum: I(sum) }), st('ex.mean.s2', { sum: I(sum), k: I(k), ans: q.answer })], visual: q.visual };
    }
  },
  {
    id: 'volume', level: 6,
    make(r) {
      const w = ri(r, 2, 10), h = ri(r, 2, 8), d = ri(r, 2, 10), ans = w * h * d;
      return { prompt: { key: 'volume', vars: { w: I(w), h: I(h), d: I(d) } }, answer: I(ans), expr: ex('*', ex('*', w, h), d), data: { w, h, d }, visual: { type: 'box', w, h, d, unit: 'cm' }, cands: [
        o(I(w * d), 'volumen-area'), o(I(w + h + d), 'suma-en-vez'), o(I(2 * (w * h + h * d + w * d)), 'volumen-area'), o(I(ans + w * h), 'cuenta-mal'), o(I(ans - w * d), 'cuenta-mal')], numShare: 0.5 };
    },
    explain(q) {
      const { w, h, d } = q.data;
      return { steps: [st('ex.vol.s1', { w: I(w), d: I(d), base: I(w * d) }), st('ex.vol.s2', { base: I(w * d), h: I(h), ans: q.answer })], visual: q.visual };
    }
  }
];

export const ADVANCED_BY_ID: Record<string, Generator> = Object.fromEntries(ADVANCED.map(g => [g.id, g]));
