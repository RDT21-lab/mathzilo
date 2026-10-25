// StarMath — pruebas del motor de preguntas.
// Cada generador pasa 10.000 semillas con una comprobación independiente de la respuesta.
// Uso: node test_engine.js <engine.js>
const path = require('path');
const E = require(path.resolve(process.argv[2]));

let fails = 0, checks = 0;
function fail(msg) { fails++; if (fails <= 25) console.log('FALLO:', msg); }
function check(cond, msg) { checks++; if (!cond) fail(msg); }

// Segundo camino de cálculo, distinto del de los generadores
function indep(text) {
  const m = text.match(/^(\d+) (\+|−|×|÷) (\d+)$/);
  const a = BigInt(m[1]), b = BigInt(m[3]);
  switch (m[2]) {
    case '+': { let s = 0n, x = a, y = b, k = 1n, carry = 0n;       // suma por columnas
      while (x > 0n || y > 0n || carry > 0n) { const t = x % 10n + y % 10n + carry; s += (t % 10n) * k; carry = t / 10n; x /= 10n; y /= 10n; k *= 10n; }
      return Number(s); }
    case '−': { let s = 0n, x = a, y = b, k = 1n, borrow = 0n;  // resta por columnas con préstamo
      while (x > 0n || y > 0n) { let t = x % 10n - y % 10n - borrow; if (t < 0n) { t += 10n; borrow = 1n; } else borrow = 0n; s += t * k; x /= 10n; y /= 10n; k *= 10n; }
      return Number(s); }
    case '×': { let s = 0n; for (let i = 0n; i < b; i++) s += a; return Number(s); } // suma repetida
    case '÷': { let q = 0n, r = a; while (r >= b) { r -= b; q++; } return r === 0n ? Number(q) : NaN; } // resta repetida
  }
}

const N = 10000;
for (const gen of Object.keys(E.GENS)) {
  let tagsSeen = {};
  for (let seed = 1; seed <= N; seed++) {
    const q = E.makeQuestion(gen, seed);
    const label = gen + ' semilla ' + seed + ' (' + q.text + ')';
    // 1. la respuesta coincide con el cálculo independiente
    check(indep(q.text) === q.answer, label + ': respuesta ' + q.answer + ' distinta de ' + indep(q.text));
    // 2. exactamente 4 opciones, distintas, una sola correcta, enteras y no negativas
    const vals = q.options.map(o => o.v);
    check(q.options.length === 4, label + ': no hay 4 opciones');
    check(new Set(vals).size === 4, label + ': opciones repetidas ' + vals);
    check(vals.filter(v => v === q.answer).length === 1, label + ': no hay una sola correcta');
    check(vals.every(v => Number.isInteger(v) && v >= 0), label + ': opción no válida ' + vals);
    check(q.options.filter(o => o.tag === 'ok').length === 1 && q.options.find(o => o.tag === 'ok').v === q.answer, label + ': etiqueta ok mal puesta');
    // 3. cada distractor tiene explicación con pasos, que termina con el resultado correcto
    for (const o of q.options) {
      if (o.tag === 'ok') continue;
      tagsSeen[o.tag] = (tagsSeen[o.tag] || 0) + 1;
      const ex = E.explain(q, o.tag, o.v);
      check(ex && ex.steps.length >= 2 && ex.prefix.length > 3, label + ': sin explicación para ' + o.tag);
      check(ex.steps.join(' ').includes(String(q.answer)), label + ': la explicación no menciona el resultado ' + q.answer);
      check(E.tagFor(q, o.v) === o.tag || q.cands.some(c => c.v === o.v), label + ': etiqueta no recuperable');
    }
    // 4. determinismo: misma semilla, misma pregunta
    if (seed % 500 === 0) check(JSON.stringify(E.makeQuestion(gen, seed)) === JSON.stringify(q), label + ': no es determinista');
    // 5. reglas de nivel
    const a = +q.text.split(' ')[0], b = +q.text.split(' ')[2];
    if (gen === 'sum-20') check(q.answer <= 18 && a < 10 && a + b > 10, label + ': no cruza la decena');
    if (gen === 'sub-20') check(a <= 18 && a - b < 10 && a - b >= 2, label + ': resta fuera de rango');
    if (gen === 'add-carry') check(a % 10 + b % 10 >= 10 && q.answer <= 99, label + ': sin llevada o resultado >99');
    if (gen === 'sub-borrow') check(a % 10 < b % 10 && q.answer >= 5, label + ': sin préstamo');
    if (gen === 'mult-table') check(a >= 3 && a <= 9 && b >= 3 && b <= 9, label + ': factores fuera de la tabla');
    if (gen === 'div-exact') check(a % b === 0 && q.answer >= 3 && q.answer <= 9, label + ': división no exacta');
  }
  console.log(gen.padEnd(11), N, 'semillas · errores típicos usados:', JSON.stringify(tagsSeen));
}

// Tests completos: sin enunciados repetidos y con mezcla 70/30 de niveles
for (const level of [1, 2, 3, 4]) for (const n of [10, 15, 20]) {
  let dup = 0, lower = 0, total = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const qs = E.makeTest(level, n, seed);
    check(qs.length === n, 'test de ' + n + ' con ' + qs.length);
    dup += n - new Set(qs.map(q => q.text)).size;
    qs.forEach(q => { total++; if (q.level < Math.min(level, 3)) lower++; });
  }
  check(dup === 0, 'enunciados repetidos en tests de nivel ' + level + ': ' + dup);
  console.log('nivel', level, 'tests de', n, '· repetidos', dup, '· repaso', total ? Math.round(lower / total * 100) + '%' : '-');
}

// Reglas de estrellas
const R = E.DEFAULT_RULES;
function eq(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), msg + ' → obtenido ' + JSON.stringify(a)); }
let s = E.scoreTest(R, { doneToday: false, streakToday: false, streak: 13 }, { correct: 8, total: 10 });
eq([s.total, s.passed, s.newStreak, s.items.map(i => i.id)], [8 + 2 + 15, true, 14, ['aciertos', 'superado', 'racha']], '8/10 con racha 13→14');
s = E.scoreTest(R, { doneToday: false, streakToday: false, streak: 3 }, { correct: 10, total: 10 });
eq([s.total, s.newStreak], [10 + 2 + 3, 4], '10/10 perfecto');
s = E.scoreTest(R, { doneToday: false, streakToday: false, streak: 5 }, { correct: 6, total: 10 });
eq([s.passed, s.total, s.newStreak], [false, 6, 5], '6/10 no supera: solo estrellas por acierto, racha igual');
s = E.scoreTest(R, { doneToday: true, streakToday: true, streak: 31 }, { correct: 9, total: 10 });
eq([s.practice, s.total, s.newStreak], [true, 0, 31], 'práctica libre: 0 estrellas, racha igual');
s = E.scoreTest(R, { doneToday: true, streakToday: false, streak: 6 }, { correct: 9, total: 10 });
eq([s.total, s.newStreak], [7, 7], 'práctica que supera tras un primer fallo: extiende la racha y cobra solo el bonus de racha del día 7');
s = E.scoreTest(R, { doneToday: true, streakToday: false, streak: 6 }, { correct: 9, total: 10 });
eq(s.items.map(i => i.id), ['racha'], 'ese día solo suma el bonus de racha de 7');
s = E.scoreTest(R, { doneToday: false, streakToday: false, streak: 13 }, { correct: 10, total: 10, fast: true });
eq([s.total, s.newStreak], [10, 14], 'test rápido: sin bonus pero con estrellas por acierto y racha');
s = E.scoreTest(R, { doneToday: false, streakToday: false, streak: 0 }, { correct: 7, total: 10 });
eq(s.passed, true, '70 % exacto cuenta como superado');
s = E.scoreTest(R, { doneToday: false, streakToday: false, streak: 0 }, { correct: 14, total: 20 });
eq(s.passed, true, '14/20 = 70 % supera');

console.log('\n' + checks + ' comprobaciones, ' + fails + ' fallos');
process.exit(fails ? 1 : 0);
