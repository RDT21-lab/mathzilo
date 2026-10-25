/* Mathzilo — motor de preguntas y reglas de estrellas (prototipo, niveles 1 a 3).
   Cada pregunta nace de un generador que calcula la respuesta con aritmética entera,
   así que una respuesta marcada como correcta nunca puede ser falsa.
   Cada distractor lleva la etiqueta del error típico que representa; esa etiqueta
   activa la explicación exacta (plantillas con huecos, nada de IA en directo).      */
(function (root) {
  'use strict';

  /* ---------- Utilidades ---------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ri(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function shuffle(r, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function swapDigits(n) { return parseInt(String(n).split('').reverse().join(''), 10); }

  var SKILLS = {
    'sum-20':      { name: 'Sumas hasta 20', level: 1 },
    'sub-20':      { name: 'Restas hasta 20', level: 1 },
    'add-carry':   { name: 'Sumas con llevada', level: 2 },
    'sub-borrow':  { name: 'Restas con llevada', level: 2 },
    'mult-table':  { name: 'Tablas de multiplicar', level: 3 },
    'div-exact':   { name: 'Divisiones exactas', level: 3 }
  };
  var POOL = { 1: ['sum-20', 'sub-20'], 2: ['add-carry', 'sub-borrow'], 3: ['mult-table', 'div-exact'] };
  var NUM_SHARE = { 'sum-20': 0, 'sub-20': 0, 'add-carry': 0.25, 'sub-borrow': 0.25, 'mult-table': 0.5, 'div-exact': 0.5 };

  /* Nombres de los errores típicos (para el panel del padre) */
  var ERROR_NAMES = {
    'olvido-llevada': 'Olvida la llevada',
    'llevada-doble': 'Suma la llevada dos veces',
    'olvido-prestamo': 'Se equivoca al pedir prestada una decena',
    'resta-al-reves': 'Resta al revés las unidades',
    'resta-en-vez': 'Resta en lugar de sumar o al contrario',
    'suma-en-vez': 'Suma en lugar de restar o multiplicar',
    'tabla-cercana': 'Confunde con una tabla vecina',
    'cifras-cambiadas': 'Cambia el orden de las cifras',
    'decena-mal': 'Se equivoca en una decena',
    'cifra-copiada': 'Copia uno de los números',
    'cuenta-mal': 'Se equivoca por poco al contar'
  };

  /* ---------- Generadores ---------- */
  function build(gen, level, text, answer, data, cands) {
    return { gen: gen, level: level, skill: SKILLS[gen].name, text: text, answer: answer, data: data, cands: cands };
  }

  var GENS = {
    'sum-20': function (r) {
      var a, b;
      do { a = ri(r, 6, 9); b = ri(r, 4, 9); } while (a + b < 11);
      var ans = a + b;
      return build('sum-20', 1, a + ' + ' + b, ans, { a: a, b: b }, [
        { v: ans - 1, tag: 'cuenta-mal' }, { v: ans + 1, tag: 'cuenta-mal' },
        { v: Math.abs(a - b), tag: 'resta-en-vez' },
        { v: ans - 10, tag: 'decena-mal' }, { v: ans + 10, tag: 'decena-mal' }
      ]);
    },
    'sub-20': function (r) {
      var a = ri(r, 11, 18);
      var lo = Math.max(3, a - 9), hi = Math.min(9, a - 2);
      var b = ri(r, lo, hi), ans = a - b;
      return build('sub-20', 1, a + ' − ' + b, ans, { a: a, b: b }, [
        { v: a + b, tag: 'suma-en-vez' },
        { v: ans - 1, tag: 'cuenta-mal' }, { v: ans + 1, tag: 'cuenta-mal' },
        { v: Math.abs((a % 10) - b), tag: 'resta-al-reves' },
        { v: ans + 10, tag: 'decena-mal' }
      ]);
    },
    'add-carry': function (r) {
      var a, b;
      do { a = ri(r, 13, 86); b = ri(r, 13, 86); } while ((a % 10) + (b % 10) < 10 || a + b > 99);
      var ans = a + b;
      return build('add-carry', 2, a + ' + ' + b, ans, { a: a, b: b }, [
        { v: ans - 10, tag: 'olvido-llevada' }, { v: ans + 10, tag: 'llevada-doble' },
        { v: ans - 1, tag: 'cuenta-mal' }, { v: ans + 1, tag: 'cuenta-mal' }
      ]);
    },
    'sub-borrow': function (r) {
      var a, b, au, bu;
      do {
        a = ri(r, 31, 95); b = ri(r, 12, a - 5); au = a % 10; bu = b % 10;
      } while (au >= bu);
      var ans = a - b, ad = Math.floor(a / 10), bd = Math.floor(b / 10);
      var cands = [
        { v: (ad - bd) * 10 + (bu - au), tag: 'olvido-prestamo' },
        { v: ans - 1, tag: 'cuenta-mal' }, { v: ans + 1, tag: 'cuenta-mal' },
        { v: ans + 10, tag: 'decena-mal' }, { v: ans - 10, tag: 'decena-mal' }
      ];
      if (a + b <= 99) cands.push({ v: a + b, tag: 'suma-en-vez' });
      return build('sub-borrow', 2, a + ' − ' + b, ans, { a: a, b: b }, cands);
    },
    'mult-table': function (r) {
      var a = ri(r, 3, 9), b = ri(r, 3, 9), ans = a * b;
      var cands = [
        { v: a * (b + 1), tag: 'tabla-cercana' }, { v: a * (b - 1), tag: 'tabla-cercana' },
        { v: (a + 1) * b, tag: 'tabla-cercana' }, { v: (a - 1) * b, tag: 'tabla-cercana' },
        { v: a + b, tag: 'suma-en-vez' },
        { v: ans + 10, tag: 'decena-mal' }, { v: ans - 10, tag: 'decena-mal' }
      ];
      if (ans >= 10) cands.push({ v: swapDigits(ans), tag: 'cifras-cambiadas' });
      return build('mult-table', 3, a + ' × ' + b, ans, { a: a, b: b }, cands);
    },
    'div-exact': function (r) {
      var q = ri(r, 3, 9), b = ri(r, 3, 9), a = q * b;
      return build('div-exact', 3, a + ' ÷ ' + b, q, { a: a, b: b, q: q }, [
        { v: q + 1, tag: 'tabla-cercana' }, { v: q - 1, tag: 'tabla-cercana' },
        { v: b, tag: 'cifra-copiada' }, { v: a - b, tag: 'resta-en-vez' },
        { v: q + 2, tag: 'cuenta-mal' }
      ]);
    }
  };

  /* Elige 3 distractores distintos y devuelve las 4 opciones mezcladas */
  function pickOptions(r, answer, cands) {
    var seen = {}; seen[answer] = 1;
    var uniq = [];
    shuffle(r, cands).forEach(function (c) {
      if (c.v >= 0 && c.v === Math.floor(c.v) && !seen[c.v]) { seen[c.v] = 1; uniq.push(c); }
    });
    var chosen = uniq.slice(0, 3);
    var k = 1;
    while (chosen.length < 3) {
      [answer + k, answer - k].forEach(function (v) {
        if (chosen.length < 3 && v >= 0 && !seen[v]) { seen[v] = 1; chosen.push({ v: v, tag: 'cuenta-mal' }); }
      });
      k++;
    }
    return shuffle(r, chosen.concat([{ v: answer, tag: 'ok' }]));
  }

  function makeQuestion(genId, seed) {
    var r = mulberry32(seed);
    var q = GENS[genId](r);
    q.options = pickOptions(r, q.answer, q.cands);
    q.type = (r() < NUM_SHARE[genId]) ? 'num' : 'mc';
    q.seed = seed;
    return q;
  }

  /* Otra pregunta del mismo tipo (mini-reto tras un fallo) */
  function similar(q, seed) {
    var n = makeQuestion(q.gen, seed), tries = 0;
    while (n.text === q.text && tries < 20) { n = makeQuestion(q.gen, seed + 1000 + tries); tries++; }
    return n;
  }

  function makeTest(level, n, seed) {
    var r = mulberry32(seed), lv = Math.min(Math.max(level, 1), 3);
    var pool = POOL[lv], lower = lv > 1 ? POOL[lv - 1] : null;
    var qs = [], seen = {};
    for (var i = 0; i < n; i++) {
      var ids = (lower && r() < 0.3) ? lower : pool;
      var id = ids[ri(r, 0, ids.length - 1)], q, tries = 0;
      do { q = makeQuestion(id, Math.floor(r() * 1e9)); tries++; } while (seen[q.text] && tries < 40);
      seen[q.text] = 1;
      qs.push(q);
    }
    return qs;
  }

  /* Etiqueta del error a partir de lo que el niño respondió (también en teclado numérico) */
  function tagFor(q, given) {
    if (given === q.answer) return 'ok';
    for (var i = 0; i < q.cands.length; i++) if (q.cands[i].v === given) return q.cands[i].tag;
    return 'cuenta-mal';
  }

  /* ---------- Explicaciones (tono 6-8 años) ---------- */
  function nearProduct(q, v) {
    var a = q.data.a, b = q.data.b;
    var opts = [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b]];
    for (var i = 0; i < opts.length; i++) if (opts[i][0] * opts[i][1] === v) return opts[i];
    return null;
  }
  function chips(items, hiIdx) { return { type: 'chips', items: items, hi: hiIdx }; }

  function explain(q, tag, given) {
    var d = q.data, ans = q.answer, prefix = '', steps = [], visual = null;
    var PRE = {
      'cuenta-mal': 'Casi. Vamos paso a paso.',
      'olvido-llevada': 'Casi. Se te olvidó la que te llevabas.',
      'llevada-doble': 'Casi. La llevada solo se suma una vez.',
      'olvido-prestamo': 'Casi. Cuando pides una decena prestada, la de al lado baja un número.',
      'suma-en-vez': 'Casi. Aquí no se suma.',
      'resta-en-vez': 'Casi. Fíjate en el signo.',
      'resta-al-reves': 'Casi. Las unidades no se restan al revés.',
      'decena-mal': 'Casi. Revisa las decenas.',
      'cifras-cambiadas': 'Casi. Tienes las cifras justo al revés.',
      'cifra-copiada': 'Casi. Ese número ya estaba en la pregunta.',
      'tabla-cercana': 'Casi.'
    };
    prefix = PRE[tag] || PRE['cuenta-mal'];

    if (q.gen === 'sum-20') {
      var need = 10 - d.a, rest = d.b - need;
      if (tag === 'resta-en-vez') prefix = 'Casi. Aquí hay que juntar, no quitar: es una suma.';
      steps = [
        'Completa la decena: a ' + d.a + ' le faltan ' + need + ' para llegar a 10.',
        'Quita esos ' + need + ' de ' + d.b + ': quedan ' + rest + '.',
        '10 + ' + rest + ' = ' + ans + '. ¡Ese es el resultado!'
      ];
      visual = { type: 'frame', a: d.a, b: d.b };
    } else if (q.gen === 'sub-20') {
      var u = d.a - 10, left = d.b - u;
      if (tag === 'suma-en-vez') prefix = 'Casi. Aquí hay que quitar, no juntar: es una resta.';
      steps = [
        'Primero quita hasta llegar a 10: ' + d.a + ' − ' + u + ' = 10.',
        'Todavía te faltan por quitar ' + left + ' (porque ' + d.b + ' − ' + u + ' = ' + left + ').',
        '10 − ' + left + ' = ' + ans + '. ¡Ese es el resultado!'
      ];
      var back = []; for (var s = d.a; s >= ans; s--) back.push(s);
      visual = chips(back, back.length - 1);
    } else if (q.gen === 'add-carry') {
      var au = d.a % 10, bu = d.b % 10, ad = Math.floor(d.a / 10), bd = Math.floor(d.b / 10), us = au + bu;
      steps = [
        'Empieza por las unidades: ' + au + ' + ' + bu + ' = ' + us + '.',
        'Escribe el ' + (us % 10) + ' y súbete 1 a las decenas.',
        'Ahora las decenas: ' + ad + ' + ' + bd + ' + 1 = ' + (ad + bd + 1) + '.',
        'Junta todo: ¡' + ans + '!'
      ];
      visual = { type: 'columns', op: '+', a: d.a, b: d.b, carry: true, ans: ans };
    } else if (q.gen === 'sub-borrow') {
      var au2 = d.a % 10, bu2 = d.b % 10, ad2 = Math.floor(d.a / 10), bd2 = Math.floor(d.b / 10);
      if (tag === 'olvido-prestamo') prefix = 'Casi. Al pedir una decena prestada, las decenas de ' + d.a + ' bajan a ' + (ad2 - 1) + '.';
      steps = [
        'En las unidades no puedes quitar ' + bu2 + ' a ' + au2 + '.',
        'Pide una decena prestada: ' + au2 + ' se convierte en ' + (au2 + 10) + '.',
        (au2 + 10) + ' − ' + bu2 + ' = ' + (au2 + 10 - bu2) + '.',
        'Ahora quedan ' + (ad2 - 1) + ' decenas: ' + (ad2 - 1) + ' − ' + bd2 + ' = ' + (ad2 - 1 - bd2) + '.',
        'Junta todo: ¡' + ans + '!'
      ];
      visual = { type: 'columns', op: '-', a: d.a, b: d.b, borrow: true, ans: ans };
    } else if (q.gen === 'mult-table') {
      var np = tag === 'tabla-cercana' ? nearProduct(q, given) : null;
      if (np) prefix = 'Casi. ' + given + ' es el resultado de ' + np[0] + ' × ' + np[1] + ', no de ' + d.a + ' × ' + d.b + '.';
      if (tag === 'suma-en-vez') prefix = 'Casi. Aquí se multiplica: ' + d.a + ' × ' + d.b + ' no es ' + d.a + ' + ' + d.b + '.';
      steps = [
        'Cuenta de ' + d.b + ' en ' + d.b + ', ' + d.a + ' veces.',
        'Así llegas a ' + ans + '. ¡' + d.a + ' × ' + d.b + ' = ' + ans + '!'
      ];
      var sk = []; for (var m = 1; m <= d.a; m++) sk.push(m * d.b);
      visual = chips(sk, sk.length - 1);
    } else if (q.gen === 'div-exact') {
      if (tag === 'tabla-cercana') prefix = 'Casi. ' + given + ' × ' + d.b + ' = ' + (given * d.b) + ', y necesitamos ' + d.a + '.';
      steps = [
        'Piensa: ¿qué número por ' + d.b + ' da ' + d.a + '?',
        'Cuenta de ' + d.b + ' en ' + d.b + ' hasta llegar a ' + d.a + ': lo consigues en ' + ans + ' saltos.',
        'Entonces ' + d.a + ' ÷ ' + d.b + ' = ' + ans + '. ¡Lo tienes!'
      ];
      var sk2 = []; for (var m2 = 1; m2 <= ans; m2++) sk2.push(m2 * d.b);
      visual = chips(sk2, sk2.length - 1);
    }
    return { lead: 'Casi. ¿Vemos qué pasó?', prefix: prefix, steps: steps, visual: visual };
  }

  /* ---------- Estrellas y rachas ---------- */
  var DEFAULT_RULES = {
    passPct: 70,
    perCorrect: 1,
    passBonus: { 10: 2, 15: 3, 20: 4 },
    perfect: 3,
    streakBonus: { 3: 3, 7: 7, 14: 15, 30: 40 },
    maxLen: 20
  };

  /* st = {doneToday, streakToday, streak}; res = {correct, total, fast} */
  function scoreTest(rules, st, res) {
    var pct = res.correct / res.total * 100;
    var passed = pct >= rules.passPct;
    var first = !st.doneToday;
    var items = [];
    if (first) {
      items.push({ id: 'aciertos', n: res.correct, stars: res.correct * rules.perCorrect });
      if (passed && !res.fast) {
        items.push({ id: 'superado', stars: rules.passBonus[res.total] || 0 });
        if (res.correct === res.total) items.push({ id: 'perfecto', stars: rules.perfect });
      }
    }
    var newStreak = st.streak, extended = false;
    if (passed && !st.streakToday) {
      newStreak = st.streak + 1; extended = true;
      var sb = rules.streakBonus[newStreak];
      if (sb && !res.fast) items.push({ id: 'racha', stars: sb, days: newStreak });
    }
    var total = 0;
    items.forEach(function (it) { total += it.stars; });
    return { passed: passed, pct: pct, first: first, practice: !first, items: items, total: total,
             newStreak: newStreak, streakExtended: extended, fast: !!res.fast };
  }

  var api = {
    mulberry32: mulberry32, SKILLS: SKILLS, POOL: POOL, ERROR_NAMES: ERROR_NAMES, GENS: GENS,
    makeQuestion: makeQuestion, makeTest: makeTest, similar: similar, tagFor: tagFor, explain: explain,
    DEFAULT_RULES: DEFAULT_RULES, scoreTest: scoreTest
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarEngine = api;
})(typeof window !== 'undefined' ? window : this);
