/* Generadores de los niveles 1 a 3. Cada uno calcula la respuesta con enteros, devuelve el árbol
   de la operación (para el banco de pruebas) y distractores con la etiqueta de su error típico.  */
import { ex, I, F, T, S, pick, ri, shuffle, digitsReversed, type Draft, type Option, type Val } from './core';
import { st, type Generator } from './types';

const o = (v: Val, tag: string): Option => ({ v, tag });
const tens = (n: number) => Math.floor(n / 10), units = (n: number) => n % 10;
export const NAMES = ['Leo', 'Mia', 'Noa', 'Sami', 'Alex', 'Lina', 'Teo', 'Ada'];
export const ITEMS = ['marbles', 'pencils', 'stickers', 'cookies', 'cards', 'books'];

function chipsUpTo(step: number, count: number): Val[] { const a: Val[] = []; for (let i = 1; i <= count; i++) a.push(I(i * step)); return a; }

export const BASIC: Generator[] = [
  /* ---------------- Nivel 1 ---------------- */
  {
    id: 'sum-20', level: 1,
    make(r) {
      let a, b;
      do { a = ri(r, 6, 9); b = ri(r, 4, 9); } while (a + b < 11);
      const ans = a + b;
      return { prompt: { key: 'add', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('+', a, b), data: { a, b }, cands: [
        o(I(ans - 1), 'cuenta-mal'), o(I(ans + 1), 'cuenta-mal'), o(I(Math.abs(a - b)), 'resta-en-vez'),
        o(I(ans - 10), 'decena-mal'), o(I(ans + 10), 'decena-mal')], numShare: 0.2 };
    },
    explain(q) {
      const { a, b } = q.data, need = 10 - a, rest = b - need;
      return { steps: [st('ex.sum20.s1', { a: I(a), need: I(need) }), st('ex.sum20.s2', { need: I(need), b: I(b), rest: I(rest) }), st('ex.sum20.s3', { rest: I(rest), ans: q.answer })],
               visual: { type: 'frame', a, b } };
    }
  },
  {
    id: 'sub-20', level: 1,
    make(r) {
      const a = ri(r, 11, 18), b = ri(r, Math.max(3, a - 9), Math.min(9, a - 2)), ans = a - b;
      return { prompt: { key: 'sub', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('-', a, b), data: { a, b }, cands: [
        o(I(a + b), 'suma-en-vez'), o(I(ans - 1), 'cuenta-mal'), o(I(ans + 1), 'cuenta-mal'),
        o(I(Math.abs(units(a) - b)), 'resta-al-reves'), o(I(ans + 10), 'decena-mal')], numShare: 0.2 };
    },
    explain(q) {
      const { a, b } = q.data, u = a - 10, left = b - u, ans = a - b;
      const back: Val[] = []; for (let s = a; s >= ans; s--) back.push(I(s));
      return { steps: [st('ex.sub20.s1', { a: I(a), u: I(u) }), st('ex.sub20.s2', { left: I(left), b: I(b), u: I(u) }), st('ex.sub20.s3', { left: I(left), ans: I(ans) })],
               visual: { type: 'chips', items: back, hi: back.length - 1 } };
    }
  },
  {
    id: 'add-100', level: 1,
    make(r) {
      let a, b;
      do { a = ri(r, 11, 78); b = ri(r, 10, 60); } while (units(a) + units(b) > 9 || a + b > 99);
      const ans = a + b;
      return { prompt: { key: 'add', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('+', a, b), data: { a, b }, cands: [
        o(I(ans + 10), 'decena-mal'), o(I(ans - 10), 'decena-mal'), o(I(ans + 1), 'cuenta-mal'), o(I(ans - 1), 'cuenta-mal'),
        o(I(Math.abs(a - b)), 'resta-en-vez'), o(I(digitsReversed(ans)), 'cifras-cambiadas')], numShare: 0.35 };
    },
    explain(q) {
      const { a, b } = q.data;
      return { steps: [st('ex.add100.s1', { au: I(units(a)), bu: I(units(b)), u: I(units(a) + units(b)) }),
                       st('ex.add100.s2', { at: I(tens(a)), bt: I(tens(b)), t: I(tens(a) + tens(b)) }), st('ex.add100.s3', { ans: q.answer })],
               visual: { type: 'columns', op: '+', a, b, ans: a + b } };
    }
  },
  {
    id: 'sub-100', level: 1,
    make(r) {
      let a, b;
      do { a = ri(r, 25, 99); b = ri(r, 10, a - 10); } while (units(a) < units(b));
      const ans = a - b;
      return { prompt: { key: 'sub', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('-', a, b), data: { a, b }, cands: [
        o(I(ans + 10), 'decena-mal'), o(I(ans - 10), 'decena-mal'), o(I(ans + 1), 'cuenta-mal'), o(I(ans - 1), 'cuenta-mal'),
        o(I(a + b), 'suma-en-vez'), o(I(digitsReversed(ans)), 'cifras-cambiadas')], numShare: 0.35 };
    },
    explain(q) {
      const { a, b } = q.data;
      return { steps: [st('ex.sub100.s1', { au: I(units(a)), bu: I(units(b)), u: I(units(a) - units(b)) }),
                       st('ex.sub100.s2', { at: I(tens(a)), bt: I(tens(b)), t: I(tens(a) - tens(b)) }), st('ex.sub100.s3', { ans: q.answer })],
               visual: { type: 'columns', op: '-', a, b, ans: a - b } };
    }
  },
  {
    id: 'compare-100', level: 1,
    make(r) {
      const a = ri(r, 10, 99);
      let b: number;
      const mode = r();
      if (mode < 0.15) b = a;
      else if (mode < 0.55) b = digitsReversed(a) !== a && digitsReversed(a) >= 10 ? digitsReversed(a) : a + ri(r, 1, 9) * (r() < 0.5 ? 1 : -1);
      else b = a + ri(r, 1, 9) * (r() < 0.5 ? 1 : -1);
      if (b < 1 || b > 99) b = a > 50 ? a - 7 : a + 7;
      const s = a < b ? '<' : a > b ? '>' : '=';
      const other = s === '<' ? '>' : s === '>' ? '<' : null;
      const cands = other ? [o(S(other), 'comparar-al-reves'), o(S('='), 'comparar-igual')] : [o(S('<'), 'comparar-igual'), o(S('>'), 'comparar-igual')];
      return { prompt: { key: 'cmp', vars: { a: I(a), b: I(b) } }, answer: S(s), expr: ex('cmp', a, b), data: { a, b }, cands, mcOnly: true };
    },
    explain(q) {
      const { a, b } = q.data;
      const sameT = tens(a) === tens(b);
      return { steps: [st(sameT ? 'ex.cmp.same' : 'ex.cmp.tens', { at: I(tens(a)), bt: I(tens(b)), au: I(units(a)), bu: I(units(b)) }), st('ex.cmp.mouth'),
                       st('ex.cmp.end', { a: I(a), b: I(b), s: q.answer })] };
    }
  },
  {
    id: 'series', level: 1,
    make(r) {
      const step = pick(r, [1, 2, 5, 10, 3]), up = r() < 0.7;
      const start = up ? ri(r, 0, 40) : ri(r, 4 * step + 2, 4 * step + 50);
      const t = [0, 1, 2, 3].map(i => start + (up ? i : -i) * step);
      const ans = start + (up ? 4 : -4) * step;
      const last = t[3];
      return { prompt: { key: 'series', vars: { t1: I(t[0]), t2: I(t[1]), t3: I(t[2]), t4: I(t[3]) } }, answer: I(ans),
        expr: ex(up ? '+' : '-', start, ex('*', 4, step)), data: { step, up: up ? 1 : 0, last }, cands: [
          o(I(up ? last + 2 * step : last - 2 * step), 'serie-paso'), o(I(up ? last + 1 : last - 1), 'serie-paso'),
          o(I(up ? last - step : last + step), 'serie-sentido'), o(I(ans + 1), 'cuenta-mal'), o(I(ans - 1), 'cuenta-mal')], numShare: 0.3 };
    },
    explain(q) {
      const { step, up, last } = q.data;
      return { steps: [st(up ? 'ex.series.up' : 'ex.series.down', { step: I(step) }), st(up ? 'ex.series.nextUp' : 'ex.series.nextDown', { last: I(last), step: I(step), ans: q.answer })] };
    }
  },
  {
    id: 'double-half', level: 1,
    make(r) {
      if (r() < 0.55) {
        const n = ri(r, 2, 10), ans = 2 * n;
        return { prompt: { key: 'double', vars: { a: I(n) } }, answer: I(ans), expr: ex('*', 2, n), data: { n, dbl: 1 }, cands: [
          o(I(n + 2), 'suma-en-vez'), o(I(n % 2 === 0 ? n / 2 : n + 1), 'doble-mitad'), o(I(ans + 1), 'cuenta-mal'), o(I(ans - 1), 'cuenta-mal'), o(I(ans + 2), 'cuenta-mal')], numShare: 0.3 };
      }
      const n = 2 * ri(r, 2, 10), ans = n / 2;
      return { prompt: { key: 'half', vars: { a: I(n) } }, answer: I(ans), expr: ex('/', n, 2), data: { n, dbl: 0 }, cands: [
        o(I(n * 2), 'doble-mitad'), o(I(n - 2), 'resta-en-vez'), o(I(ans + 1), 'cuenta-mal'), o(I(ans - 1), 'cuenta-mal'), o(I(ans + 2), 'cuenta-mal')], numShare: 0.3 };
    },
    explain(q) {
      const { n, dbl } = q.data;
      return dbl ? { steps: [st('ex.dh.double', { n: I(n), ans: q.answer })], visual: { type: 'frame', a: n, b: n } }
                 : { steps: [st('ex.dh.half', { n: I(n), ans: q.answer }), st('ex.dh.check', { ans: q.answer, n: I(n) })] };
    }
  },
  {
    id: 'clock', level: 1,
    make(r) {
      const h = ri(r, 1, 12), m = pick(r, [0, 30]);
      const nh = h % 12 + 1, ph = (h + 10) % 12 + 1;
      const cands = m === 0
        ? [o(T(12, h * 5 <= 45 && [15, 30, 45].includes(h * 5) ? h * 5 : 0), 'hora-agujas'), o(T(h, 30), 'hora-media'), o(T(nh, 0), 'cuenta-mal'), o(T(ph, 0), 'cuenta-mal')]
        : [o(T(nh, 30), 'hora-media'), o(T(h, 0), 'hora-media'), o(T(6, h * 5 % 60 === 15 || h * 5 % 60 === 45 ? h * 5 % 60 : 0), 'hora-agujas'), o(T(ph, 30), 'cuenta-mal')];
      return { prompt: { key: 'clock', vars: {} }, answer: T(h, m), expr: ex('+', ex('*', h, 60), m), data: { h, m }, cands, mcOnly: true, visual: { type: 'clock', h, m } };
    },
    explain(q) {
      const { h, m } = q.data;
      return { steps: [st('ex.clock.short', { h: I(h) }), st(m ? 'ex.clock.half' : 'ex.clock.oclock'), st('ex.clock.end', { t: q.answer })], visual: { type: 'clock', h, m } };
    }
  },

  /* ---------------- Nivel 2 ---------------- */
  {
    id: 'add-carry', level: 2,
    make(r) {
      let a, b;
      do { a = ri(r, 13, 86); b = ri(r, 13, 86); } while (units(a) + units(b) < 10 || a + b > 99);
      const ans = a + b;
      return { prompt: { key: 'add', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('+', a, b), data: { a, b }, cands: [
        o(I(ans - 10), 'olvido-llevada'), o(I(ans + 10), 'llevada-doble'), o(I(ans - 1), 'cuenta-mal'), o(I(ans + 1), 'cuenta-mal')], numShare: 0.3 };
    },
    explain(q) {
      const { a, b } = q.data, us = units(a) + units(b);
      return { steps: [st('ex.carry.s1', { au: I(units(a)), bu: I(units(b)), us: I(us) }), st('ex.carry.s2', { w: I(us % 10) }),
                       st('ex.carry.s3', { at: I(tens(a)), bt: I(tens(b)), t: I(tens(a) + tens(b) + 1) }), st('ex.end', { ans: q.answer })],
               visual: { type: 'columns', op: '+', a, b, ans: a + b } };
    }
  },
  {
    id: 'sub-borrow', level: 2,
    make(r) {
      let a, b;
      do { a = ri(r, 31, 95); b = ri(r, 12, a - 5); } while (units(a) >= units(b));
      const ans = a - b;
      const cands = [o(I((tens(a) - tens(b)) * 10 + (units(b) - units(a))), 'olvido-prestamo'), o(I(ans - 1), 'cuenta-mal'), o(I(ans + 1), 'cuenta-mal'),
        o(I(ans + 10), 'olvido-prestamo'), o(I(ans - 10), 'decena-mal')];
      if (a + b <= 99) cands.push(o(I(a + b), 'suma-en-vez'));
      return { prompt: { key: 'sub', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('-', a, b), data: { a, b }, cands, numShare: 0.3 };
    },
    explain(q) {
      const { a, b } = q.data, au = units(a), bu = units(b), at = tens(a), bt = tens(b);
      return { steps: [st('ex.borrow.s1', { au: I(au), bu: I(bu) }), st('ex.borrow.s2', { au: I(au), au10: I(au + 10) }),
                       st('ex.borrow.s3', { au10: I(au + 10), bu: I(bu), u: I(au + 10 - bu) }), st('ex.borrow.s4', { t1: I(at - 1), bt: I(bt), t: I(at - 1 - bt) }), st('ex.end', { ans: q.answer })],
               visual: { type: 'columns', op: '-', a, b, ans: a - b } };
    }
  },
  {
    id: 'tables-2-5-10', level: 2,
    make(r) {
      const a = pick(r, [2, 5, 10]), b = ri(r, 2, 10), ans = a * b;
      return { prompt: { key: 'mul', vars: { a: I(b), b: I(a) } }, answer: I(ans), expr: ex('*', b, a), data: { a, b }, cands: [
        o(I(a * (b + 1)), 'tabla-cercana'), o(I(a * (b - 1)), 'tabla-cercana'), o(I(a + b), 'suma-en-vez'), o(I(ans + 10), 'decena-mal'), o(I(ans - 1), 'cuenta-mal')], numShare: 0.4 };
    },
    explain(q) {
      const { a, b } = q.data, sk = chipsUpTo(a, b);
      return { steps: [st('ex.skip.s1', { a: I(a), b: I(b) }), st('ex.skip.s2', { ans: q.answer })], visual: { type: 'chips', items: sk, hi: sk.length - 1 } };
    }
  },
  {
    id: 'double-half-100', level: 2,
    make(r) {
      if (r() < 0.5) {
        const n = ri(r, 11, 49), ans = 2 * n;
        return { prompt: { key: 'double', vars: { a: I(n) } }, answer: I(ans), expr: ex('*', 2, n), data: { n, dbl: 1 }, cands: [
          o(I(ans - 10), 'olvido-llevada'), o(I(tens(n) * 20 + units(n)), 'cuenta-mal'), o(I(n % 2 ? n + 1 : n / 2), 'doble-mitad'), o(I(ans + 10), 'decena-mal'), o(I(ans + 1), 'cuenta-mal')], numShare: 0.4 };
      }
      const n = 2 * ri(r, 11, 49), ans = n / 2;
      return { prompt: { key: 'half', vars: { a: I(n) } }, answer: I(ans), expr: ex('/', n, 2), data: { n, dbl: 0 }, cands: [
        o(I(n * 2), 'doble-mitad'), o(I(ans + 5), 'cuenta-mal'), o(I(ans - 5), 'decena-mal'), o(I(ans + 10), 'decena-mal'), o(I(ans + 1), 'cuenta-mal')], numShare: 0.4 };
    },
    explain(q) {
      const { n, dbl } = q.data;
      if (dbl) return { steps: [st('ex.dh100.d1', { n: I(n), t: I(tens(n) * 10), u: I(units(n)) }), st('ex.dh100.d2', { t2: I(tens(n) * 20), u2: I(units(n) * 2), ans: q.answer })] };
      const t = tens(n) * 10, u = units(n);
      const evenT = tens(n) % 2 === 0;
      return { steps: evenT ? [st('ex.dh100.h1', { n: I(n), t: I(t), u: I(u) }), st('ex.dh100.h2', { th: I(t / 2), uh: I(u / 2), ans: q.answer })]
                            : [st('ex.dh100.h1', { n: I(n), t: I(t - 10), u: I(u + 10) }), st('ex.dh100.h2', { th: I((t - 10) / 2), uh: I((u + 10) / 2), ans: q.answer })] };
    }
  },
  {
    id: 'coins', level: 2,
    make(r) {
      const set = [1, 2, 5, 10, 20, 50];
      let coins: number[];
      do { coins = Array.from({ length: ri(r, 2, 4) }, () => pick(r, set)).sort((x, y) => y - x); } while (coins.reduce((s, c) => s + c, 0) > 100);
      const total = coins.reduce((s, c) => s + c, 0);
      const e = coins.slice(1).reduce<import('./core').Expr>((acc, c) => ex('+', acc, c), coins[0]);
      return { prompt: { key: 'coins', vars: {} }, answer: I(total), expr: e, data: { total, n: coins.length }, visual: { type: 'coins', coins }, cands: [
        o(I(coins.length), 'moneda-mal'), o(I(total - coins[coins.length - 1]), 'cuenta-mal'), o(I(total + 10), 'decena-mal'), o(I(total - 10), 'decena-mal'), o(I(total + 5), 'cuenta-mal')], numShare: 0.3 };
    },
    explain(q) {
      const c = (q.visual as { coins: number[] }).coins;
      let acc = 0;
      const items: Val[] = c.map(x => { acc += x; return I(acc); });
      return { steps: [st('ex.coins.s1', { big: I(c[0]) }), st('ex.coins.s2'), st('ex.coins.s3', { ans: q.answer })], visual: { type: 'chips', items, hi: items.length - 1 } };
    }
  },
  {
    id: 'place-1000', level: 2,
    make(r) {
      const h = ri(r, 1, 9), t = ri(r, 0, 9), u = ri(r, 1, 9), ans = h * 100 + t * 10 + u;
      const order = r() < 0.4 ? 'mixed' : 'std';
      return { prompt: { key: order === 'std' ? 'place3' : 'place3mix', vars: { h: I(h), t: I(t), u: I(u) } }, answer: I(ans),
        expr: ex('+', ex('*', h, 100), ex('+', ex('*', t, 10), u)), data: { h, t, u }, visual: { type: 'place', n: ans }, cands: [
          o(I(h + t + u), 'valor-posicional'), o(I(u * 100 + h * 10 + t), 'valor-posicional'), o(I(digitsReversed(ans)), 'cifras-cambiadas'),
          o(I(h * 100 + u * 10 + t), 'valor-posicional'), o(I(ans + 10), 'decena-mal'), o(I(ans + 100), 'decena-mal')], numShare: 0.4 };
    },
    explain(q) {
      const { h, t, u } = q.data;
      return { steps: [st('ex.place.s1'), st('ex.place.s3', { h: I(h), t: I(t), u: I(u), ans: q.answer })], visual: { type: 'place', n: h * 100 + t * 10 + u } };
    }
  },
  {
    id: 'clock-quarter', level: 2,
    make(r) {
      const h = ri(r, 1, 12), m = pick(r, [15, 45, 15, 45, 30]);
      const nh = h % 12 + 1, ph = (h + 10) % 12 + 1;
      const cands = [o(T(h, m === 15 ? 45 : m === 45 ? 15 : 0), 'cuarto-mal'), o(T(nh, m), 'hora-media'), o(T(ph, m), 'hora-media'),
        o(T(3, 0), 'hora-agujas'), o(T(9, 0), 'hora-agujas')];
      return { prompt: { key: 'clock', vars: {} }, answer: T(h, m), expr: ex('+', ex('*', h, 60), m), data: { h, m }, cands, mcOnly: true, visual: { type: 'clock', h, m } };
    },
    explain(q) {
      const { h, m } = q.data;
      return { steps: [st('ex.clock.short', { h: I(h) }), st(m === 15 ? 'ex.clock.q15' : m === 45 ? 'ex.clock.q45' : 'ex.clock.half'), st('ex.clock.end', { t: q.answer })],
               visual: { type: 'clock', h, m } };
    }
  },

  /* ---------------- Nivel 3 ---------------- */
  {
    id: 'mult-table', level: 3,
    make(r) {
      const a = ri(r, 3, 9), b = ri(r, 3, 9), ans = a * b;
      const cands = [o(I(a * (b + 1)), 'tabla-cercana'), o(I(a * (b - 1)), 'tabla-cercana'), o(I((a + 1) * b), 'tabla-cercana'), o(I((a - 1) * b), 'tabla-cercana'),
        o(I(a + b), 'suma-en-vez'), o(I(ans + 10), 'decena-mal'), o(I(ans - 10), 'decena-mal')];
      if (ans >= 10) cands.push(o(I(digitsReversed(ans)), 'cifras-cambiadas'));
      return { prompt: { key: 'mul', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('*', a, b), data: { a, b }, cands, numShare: 0.5 };
    },
    explain(q, tag, given) {
      const { a, b } = q.data, sk = chipsUpTo(b, a);
      let vars: Record<string, Val> | undefined;
      if (tag === 'tabla-cercana' && given && given.k === 'int') {
        for (const [x, y] of [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b]]) if (x * y === given.v) vars = { x: I(x), y: I(y) };
      }
      return { steps: [st('ex.mult.s1', { a: I(a), b: I(b) }), st('ex.mult.s2', { a: I(a), b: I(b), ans: q.answer })], visual: { type: 'chips', items: sk, hi: sk.length - 1 }, vars };
    }
  },
  {
    id: 'mult-1digit', level: 3,
    make(r) {
      const a = ri(r, 12, 99), b = ri(r, 2, 9), ans = a * b;
      const noCarry = tens(a) * b * 10 + (units(a) * b) % 10;
      return { prompt: { key: 'mul', vars: { a: I(a), b: I(b) } }, answer: I(ans), expr: ex('*', a, b), data: { a, b }, cands: [
        o(I(noCarry), 'olvido-llevada'), o(I(tens(a) * b * 10 + units(a)), 'mult-parcial'), o(I(tens(a) * b + units(a) * b), 'valor-posicional'),
        o(I(ans + 10), 'decena-mal'), o(I(ans - 10), 'decena-mal'), o(I(a + b), 'suma-en-vez')], numShare: 0.5 };
    },
    explain(q) {
      const { a, b } = q.data;
      return { steps: [st('ex.m1.s1', { au: I(units(a)), b: I(b), p1: I(units(a) * b) }), st('ex.m1.s2', { t: I(tens(a) * 10), b: I(b), p2: I(tens(a) * 10 * b) }),
                       st('ex.m1.s3', { p1: I(units(a) * b), p2: I(tens(a) * 10 * b), ans: q.answer })], visual: { type: 'mulcols', a, b } };
    }
  },
  {
    id: 'div-exact', level: 3,
    make(r) {
      const qn = ri(r, 3, 9), b = ri(r, 3, 9), a = qn * b;
      return { prompt: { key: 'div', vars: { a: I(a), b: I(b) } }, answer: I(qn), expr: ex('/', a, b), data: { a, b, q: qn }, cands: [
        o(I(qn + 1), 'tabla-cercana'), o(I(qn - 1), 'tabla-cercana'), o(I(b), 'cifra-copiada'), o(I(a - b), 'resta-en-vez'), o(I(qn + 2), 'cuenta-mal')], numShare: 0.5 };
    },
    explain(q, tag, given) {
      const { a, b, q: qn } = q.data, sk = chipsUpTo(b, qn);
      const vars = tag === 'tabla-cercana' && given && given.k === 'int' ? { x: given, y: I(b), p: I(given.v * b) } : undefined;
      return { steps: [st('ex.div.s1', { a: I(a), b: I(b) }), st('ex.div.s2', { a: I(a), b: I(b), ans: q.answer }), st('ex.div.s3', { a: I(a), b: I(b), ans: q.answer })],
               visual: { type: 'chips', items: sk, hi: sk.length - 1 }, vars };
    }
  },
  {
    id: 'frac-of', level: 3,
    make(r) {
      const d = pick(r, [2, 3, 4]), k = ri(r, 2, 10), n = d * k;
      const cands = [o(I(n * d), 'fraccion-mal'), o(I(n - d), 'resta-en-vez'), o(I(k + 1), 'cuenta-mal'), o(I(k - 1), 'cuenta-mal')];
      if (d !== 2 && n % 2 === 0) cands.push(o(I(n / 2), 'fraccion-mal'));
      return { prompt: { key: 'fracOf', vars: { f: F(1, d), n: I(n) } }, answer: I(k), expr: ex('*', { frac: [1, d] }, n), data: { d, n }, cands, numShare: 0.4 };
    },
    explain(q) {
      const { d, n } = q.data;
      return { steps: [st('ex.fracof.s1', { n: I(n), d: I(d) }), st('ex.fracof.s2', { n: I(n), d: I(d), ans: q.answer })], visual: { type: 'pie', n: 1, d } };
    }
  },
  {
    id: 'frac-pie', level: 3,
    make(r) {
      const d = pick(r, [2, 3, 4, 4, 3]), n = ri(r, 1, d - 1);
      const cands = [o(F(d - n, d), 'fraccion-al-reves'), o(F(n, d + 1), 'fraccion-partes'), o(F(d, n), 'fraccion-partes'), o(F(n + 1, d), 'cuenta-mal')];
      if (d - n !== n) cands.push(o(F(n, d - n), 'fraccion-partes'));
      return { prompt: { key: 'fracPie', vars: {} }, answer: F(n, d), expr: { frac: [n, d] }, data: { n, d }, cands, mcOnly: true, visual: { type: 'pie', n, d } };
    },
    explain(q) {
      const { n, d } = q.data;
      return { steps: [st('ex.fracpie.s1', { d: I(d) }), st('ex.fracpie.s2', { n: I(n) }), st('ex.fracpie.s3', { f: q.answer })], visual: { type: 'pie', n, d } };
    }
  },
  {
    id: 'word-1', level: 3,
    make(r) {
      const name = pick(r, NAMES), item = '@items.' + pick(r, ITEMS), kind = pick(r, ['join', 'take', 'groups', 'share']);
      if (kind === 'join') {
        const a = ri(r, 12, 60), b = ri(r, 8, 35), ans = a + b;
        return { prompt: { key: 'w.join', vars: { name, item, a: I(a), b: I(b) } }, answer: I(ans), expr: ex('+', a, b), data: { a, b, kind: 0 }, cands: [
          o(I(Math.abs(a - b)), 'resta-en-vez'), o(I(ans + 10), 'decena-mal'), o(I(ans - 10), 'olvido-llevada'), o(I(ans + 1), 'cuenta-mal')], numShare: 0.5 };
      }
      if (kind === 'take') {
        const a = ri(r, 25, 90), b = ri(r, 6, a - 8), ans = a - b;
        return { prompt: { key: 'w.take', vars: { name, item, a: I(a), b: I(b) } }, answer: I(ans), expr: ex('-', a, b), data: { a, b, kind: 1 }, cands: [
          o(I(a + b), 'suma-en-vez'), o(I(ans + 10), 'olvido-prestamo'), o(I(ans - 10), 'decena-mal'), o(I(ans + 1), 'cuenta-mal')], numShare: 0.5 };
      }
      if (kind === 'groups') {
        const a = ri(r, 3, 9), b = ri(r, 3, 9), ans = a * b;
        return { prompt: { key: 'w.groups', vars: { name, item, a: I(a), b: I(b) } }, answer: I(ans), expr: ex('*', a, b), data: { a, b, kind: 2 }, cands: [
          o(I(a + b), 'suma-en-vez'), o(I(a * (b + 1)), 'tabla-cercana'), o(I(a * (b - 1)), 'tabla-cercana'), o(I(ans + 10), 'decena-mal')], numShare: 0.5 };
      }
      const b = ri(r, 2, 9), qn = ri(r, 2, 9), a = b * qn;
      return { prompt: { key: 'w.share', vars: { name, item, a: I(a), b: I(b) } }, answer: I(qn), expr: ex('/', a, b), data: { a, b, kind: 3 }, cands: [
        o(I(a - b), 'resta-en-vez'), o(I(a * b), 'suma-en-vez'), o(I(qn + 1), 'tabla-cercana'), o(I(qn - 1), 'tabla-cercana'), o(I(b), 'cifra-copiada')], numShare: 0.5 };
    },
    explain(q) {
      const { a, b, kind } = q.data;
      const k = ['join', 'take', 'groups', 'share'][kind];
      return { steps: [st('ex.w1.' + k), st('ex.w1.' + k + 'Op', { a: I(a), b: I(b), ans: q.answer })] };
    }
  },
  {
    id: 'perimeter', level: 3,
    make(r) {
      if (r() < 0.65) {
        const sq = r() < 0.3, w = ri(r, 3, 12), h = sq ? w : ri(r, 2, 9);
        if (!sq && h === w) return BASIC_BY_ID['perimeter'].make(r);
        const ans = 2 * (w + h);
        return { prompt: { key: sq ? 'perimSq' : 'perimRect', vars: { w: I(w), h: I(h) } }, answer: I(ans), expr: ex('*', 2, ex('+', w, h)), data: { w, h, tri: 0 },
          visual: { type: 'rect', w, h, unit: 'cm', show: 'sides' }, cands: [
            o(I(w + h), 'perimetro-lados'), o(I(w * h), 'area-perimetro'), o(I(2 * w + h), 'perimetro-lados'), o(I(ans + 2), 'cuenta-mal'), o(I(ans - 2), 'cuenta-mal')], numShare: 0.5 };
      }
      let a, b, c;
      do { a = ri(r, 3, 12); b = ri(r, 3, 12); c = ri(r, 3, 12); } while (a + b <= c || a + c <= b || b + c <= a);
      const ans = a + b + c;
      return { prompt: { key: 'perimTri', vars: { a: I(a), b: I(b), c: I(c) } }, answer: I(ans), expr: ex('+', ex('+', a, b), c), data: { a, b, c, tri: 1 },
        visual: { type: 'tri', a, b, c, unit: 'cm' }, cands: [
          o(I(a + b), 'perimetro-lados'), o(I(b + c), 'perimetro-lados'), o(I(a * b), 'area-perimetro'), o(I(ans + 1), 'cuenta-mal'), o(I(ans + 10), 'decena-mal')], numShare: 0.5 };
    },
    explain(q) {
      const d = q.data;
      if (d.tri) return { steps: [st('ex.perim.what'), st('ex.perim.tri', { a: I(d.a), b: I(d.b), c: I(d.c), ans: q.answer })] };
      return { steps: [st('ex.perim.what'), st('ex.perim.rect', { w: I(d.w), h: I(d.h), ans: q.answer })], visual: { type: 'rect', w: d.w, h: d.h, unit: 'cm', show: 'sides' } };
    }
  },
  {
    id: 'place-10000', level: 3,
    make(r) {
      const th = ri(r, 1, 9), h = ri(r, 0, 9), t = ri(r, 0, 9), u = ri(r, 0, 9);
      if (h === 0 && t === 0 && u === 0) return BASIC_BY_ID['place-10000'].make(r);
      const ans = th * 1000 + h * 100 + t * 10 + u;
      const parts = shuffle(r, [['th', th], ['h', h], ['t', t], ['u', u]].filter(p => p[1] !== 0)) as [string, number][];
      const vars: Record<string, Val | string | number> = {};
      parts.forEach((p, i) => { vars['l' + (i + 1)] = '@pv.' + p[0]; vars['v' + (i + 1)] = I(p[1]); });
      return { prompt: { key: 'place4_' + parts.length, vars }, answer: I(ans), expr: ex('+', ex('*', th, 1000), ex('+', ex('*', h, 100), ex('+', ex('*', t, 10), u))),
        data: { th, h, t, u }, visual: { type: 'place', n: ans }, cands: [
          o(I(th + h + t + u), 'valor-posicional'), o(I(th * 100 + h * 10 + t), 'valor-posicional'), o(I(ans + 1000), 'decena-mal'), o(I(ans - 100), 'decena-mal'),
          o(I(parts.reduce((s, p) => s * 10 + p[1], 0)), 'valor-posicional')], numShare: 0.5 };
    },
    explain(q) {
      const { th, h, t, u } = q.data;
      return { steps: [st('ex.place.s1'), st('ex.place.s4', { th: I(th), h: I(h), t: I(t), u: I(u), ans: q.answer })], visual: { type: 'place', n: q.answer.k === 'int' ? q.answer.v : 0 } };
    }
  }
];

export const BASIC_BY_ID: Record<string, Generator> = Object.fromEntries(BASIC.map(g => [g.id, g]));
export type { Draft };
