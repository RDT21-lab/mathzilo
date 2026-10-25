/* Mathzilo — prototipo clicable de la fase 1.
   6 pantallas del niño (tablet 1024×680) y 4 del padre (móvil 390×800), todo en memoria.
   render() reconstruye #app a partir del estado S; los clics llegan por delegación (data-act)
   y fit() escala el dispositivo con transform para que quepa en cualquier pantalla.            */
(function () {
  'use strict';
  var M = window.StarMascots, E = window.StarEngine, A = window.SM_ASSETS || {};
  var DEV = { tablet: { w: 1024, h: 680 }, phone: { w: 390, h: 800 } };
  var KID_SCREENS = [['perfiles', 'Perfiles'], ['inicio', 'Inicio'], ['longitud', 'Elegir test'], ['pregunta', 'Pregunta'],
                     ['explicacion', 'Explicación'], ['resultado', 'Resultado'], ['mascota', 'Mascota']];
  var PARENT_SCREENS = [['pin', 'PIN'], ['panel', 'Panel'], ['canje', 'Canjear'], ['ajustes', 'Ajustes']];
  var DEMO_PIN = '1234';
  var PRAISE = ['¡Bien pensado!', '¡Eso es!', '¡Buen trabajo!', '¡Lo has calculado genial!', '¡Muy bien!', '¡Sigue así!'];

  /* ---------- Utilidades ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function today(off) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + (off || 0)); return d; }
  function fmtDay(d) { return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function dayLetter(d) { return 'DLMXJVS'.charAt(d.getDay()); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  var uid = 100;
  function nextId() { return 'e' + (uid++); }

  var ICONS = {
    star: '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor"/>',
    shield: '<path d="M12 2.5l8 3v6c0 5-3.4 8.8-8 10.5-4.6-1.7-8-5.5-8-10.5v-6z" fill="currentColor"/>',
    flame: '<path d="M12 2.5c.6 3.6 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.4 2.6-6.6.9 1.2 1.4 2.6 1.4 4 1.4-2 2-5 1.5-8.4z" fill="currentColor"/>',
    back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    users: '<circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.4 3.4 0 0 1 0 6.4M18.2 14.8c1.8.7 3 2.4 3.3 5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
    del: '<path d="M9 5.5h11v13H9l-6-6.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    gift: '<rect x="3.5" y="8.5" width="17" height="5" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M5.5 13.5v7h13v-7M12 8.5v12M12 8.5c-1.5-4-6-4.5-6-1.8 0 1.6 3 1.8 6 1.8zm0 0c1.5-4 6-4.5 6-1.8 0 1.6-3 1.8-6 1.8z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
    gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    arrow: '<path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  function ic(name, size, cls) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 24) + '" height="' + (size || 24) + '" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + ICONS[name] + '</svg>';
  }
  function mascot(kid, emo, opts) {
    opts = opts || {};
    var stage = opts.stage || M.stageFor(kid.best);
    return '<div class="mascot' + (opts.cls ? ' ' + opts.cls : '') + '">' +
      M.svg(kid.kind, stage, emo || 'contenta', { title: kid.petName + ' · ' + M.STAGES[stage - 1].name }) + '</div>';
  }
  function logo() { return '<span class="mk">' + (A.mark || '') + '</span><span class="wm">' + (A.wordmark || '<b>Mathzilo</b>') + '</span>'; }

  /* ---------- Estado de demostración ---------- */
  function seedLedger(kid, list) { list.forEach(function (e) { S.ledger.push({ id: nextId(), kid: kid, day: e[0], type: e[1], amount: e[2], note: e[3] }); }); }
  var S = {
    device: 'tablet', screen: 'perfiles', kidId: 'k1', fresh: true,
    rules: clone(E.DEFAULT_RULES),
    kids: [
      { id: 'k1', name: 'Lucía', kind: 'zorro', petName: 'Chispa', level: 1, maxLen: 15, streak: 6, best: 6, shields: 0,
        doneToday: false, streakToday: false, rested: 0, week: ['done', 'done', 'done', 'done', 'done', 'done'],
        recent: [80, 90, 70, 100, 90], avgSec: 7.8, mastery: { 'sum-20': 82, 'sub-20': 61 }, errors: { 'cuenta-mal': 4, 'resta-en-vez': 2 } },
      { id: 'k2', name: 'Mateo', kind: 'robot', petName: 'Bip', level: 2, maxLen: 20, streak: 22, best: 30, shields: 2,
        doneToday: false, streakToday: false, rested: 0, week: ['done', 'shield', 'done', 'done', 'done', 'done'],
        recent: [92, 95, 100, 90, 94], avgSec: 6.1, mastery: { 'add-carry': 93, 'sub-borrow': 88, 'sum-20': 98, 'sub-20': 96 }, errors: { 'olvido-prestamo': 3, 'cuenta-mal': 1 } },
      { id: 'k3', name: 'Sara', kind: 'zorro', petName: 'Nova', level: 3, maxLen: 20, streak: 0, best: 12, shields: 0,
        doneToday: false, streakToday: false, rested: 12, week: ['done', 'done', 'miss', 'miss', 'miss', 'miss'],
        recent: [60, 75, 45, 40, 48], avgSec: 9.4, mastery: { 'mult-table': 58, 'div-exact': 41, 'add-carry': 85, 'sub-borrow': 72 }, errors: { 'tabla-cercana': 7, 'cifra-copiada': 2, 'olvido-llevada': 1 } }
    ],
    rewards: [
      { id: 'r1', name: 'Helado', cost: 40, note: 'El sábado después del parque' },
      { id: 'r2', name: 'Elegir la peli del viernes', cost: 60, note: '' },
      { id: 'r3', name: 'Libro nuevo', cost: 120, note: 'De la librería del barrio' },
      { id: 'r4', name: 'Excursión al planetario', cost: 250, note: '' }
    ],
    equivalence: '',
    ledger: [],
    test: null, result: null,
    toast: null, sheet: null, preview: null, emo: 'contenta',
    pin: { entry: '', err: '', tries: 0, lockedUntil: 0, shake: false }, authed: false, lastParent: 0,
    openKid: 'k3', redeem: { kid: 'k1', reward: null, custom: '', reason: '' }, confirm: null,
    dayStart: 4, shieldsOn: true, lang: 'es'
  };
  seedLedger('k1', [[-6, 'test', 9, 'Test de 10 · 8/10'], [-5, 'test', 7, 'Test de 10 · 7/10'], [-4, 'racha', 3, 'Racha de 3 días'],
                    [-4, 'test', 5, 'Test de 10 · 5/10 (práctica: no aprobado)'], [-3, 'test', 10, 'Test de 10 · 8/10'], [-1, 'test', 0, 'Práctica libre']]);
  seedLedger('k2', [[-30, 'test', 120, 'Estrellas de septiembre'], [-9, 'canje', -40, 'Helado'], [-7, 'racha', 15, 'Racha de 14 días'],
                    [-3, 'test', 19, 'Test de 15 · 15/15'], [-2, 'test', 22, 'Test de 20 · 18/20'], [-1, 'test', 14, 'Test de 10 · 10/10'], [-1, 'ajuste', 10, 'Corrección: canje duplicado']]);
  seedLedger('k3', [[-20, 'test', 70, 'Estrellas de septiembre'], [-6, 'test', 12, 'Test de 15 · 11/15'], [-5, 'test', 13, 'Test de 15 · 12/15']]);
  S.ledger = S.ledger.filter(function (e) { return e.amount !== 0; });

  function kid(id) { id = id || S.kidId; for (var i = 0; i < S.kids.length; i++) if (S.kids[i].id === id) return S.kids[i]; return S.kids[0]; }
  function balance(id) { var b = 0; S.ledger.forEach(function (e) { if (e.kid === id) b += e.amount; }); return b; }
  function nextGoal(k) {
    var bal = balance(k.id), best = null;
    S.rewards.forEach(function (r) { if (r.cost > bal && (!best || r.cost < best.cost)) best = r; });
    return best || S.rewards.slice().sort(function (a, b) { return b.cost - a.cost; })[0];
  }
  function suggestion(k) {
    var r = k.recent;
    if (r.length >= 5 && r.slice(-5).every(function (p) { return p >= 90; }) && k.level < 6) return { dir: 'up', text: k.name + ' lleva 5 tests seguidos con un 90 % o más. ¿Subir a nivel ' + (k.level + 1) + '?' };
    if (r.length >= 3 && r.slice(-3).every(function (p) { return p < 50; }) && k.level > 1) return { dir: 'down', text: k.name + ' lleva 3 tests por debajo del 50 %. ¿Bajar a nivel ' + (k.level - 1) + ' unos días?' };
    return null;
  }
  function go(screen) {
    if (screen !== S.screen) S.fresh = true;
    S.screen = screen; S.sheet = null; S.preview = null;
  }
  function toast(msg) {
    S.toast = msg; var t = msg;
    setTimeout(function () { if (S.toast === t) { S.toast = null; render(); } }, 2600);
  }

  /* ---------- Test ---------- */
  function startTest(n) {
    var k = kid();
    S.test = { n: n, qs: E.makeTest(k.level, n, Date.now() % 1e9), i: 0, phase: 'ask', sel: null, entry: '',
               correct: 0, answers: [], shownAt: Date.now(), quick: 0, fast: false, mini: null, warned: false,
               practice: k.doneToday };
    S.result = null;
    go('pregunta');
  }
  function curQ() { var t = S.test; return t.phase.indexOf('mini') === 0 ? t.mini : t.qs[t.i]; }
  function givenValue() {
    var t = S.test, q = curQ();
    if (q.type === 'num') return t.entry === '' ? null : parseInt(t.entry, 10);
    return t.sel === null ? null : q.options[t.sel].v;
  }
  function check() {
    var t = S.test, q = curQ(), v = givenValue();
    if (v === null) return;
    t.given = v;
    var ok = v === q.answer;
    if (t.phase === 'mini') { t.phase = ok ? 'miniok' : 'minifail'; return; }
    var ms = Date.now() - t.shownAt;
    t.quick = ms < 2000 ? t.quick + 1 : 0;
    if (t.quick >= 3 && !t.fast) { t.fast = true; toast(kid().petName + ': ¡Lee con calma! Hoy este test no da bonus.'); }
    var tag = E.tagFor(q, v);
    t.answers.push({ gen: q.gen, ok: ok, tag: tag, ms: ms });
    if (ok) { t.correct++; t.phase = 'ok'; t.praise = PRAISE[(t.i + t.correct) % PRAISE.length]; }
    else { t.phase = 'fail'; t.tag = tag; t.expl = E.explain(q, tag, v); }
  }
  function nextQ() {
    var t = S.test;
    t.sel = null; t.entry = ''; t.given = null;
    if (t.i + 1 >= t.qs.length) { finishTest(); return; }
    t.i++; t.phase = 'ask'; t.shownAt = Date.now();
  }
  function finishTest() {
    var t = S.test, k = kid();
    var r = E.scoreTest(S.rules, { doneToday: k.doneToday, streakToday: k.streakToday, streak: k.streak },
                        { correct: t.correct, total: t.n, fast: t.fast });
    var stageBefore = M.stageFor(k.best);
    var label = 'Test de ' + t.n + ' · ' + t.correct + '/' + t.n;
    r.items.forEach(function (it) {
      if (!it.stars) return;
      var note = it.id === 'racha' ? 'Racha de ' + it.days + ' días' : it.id === 'perfecto' ? label + ' · perfecto' : it.id === 'superado' ? label + ' · aprobado' : label;
      S.ledger.push({ id: nextId(), kid: k.id, day: 0, type: it.id === 'racha' ? 'racha' : 'test', amount: it.stars, note: note });
    });
    k.doneToday = true;
    var gotShield = false;
    if (r.streakExtended) {
      k.streak = r.newStreak; k.streakToday = true; k.rested = 0;
      k.best = Math.max(k.best, k.streak);
      if (S.shieldsOn && k.streak % 7 === 0 && k.shields < 2) { k.shields++; gotShield = true; }
    }
    k.recent.push(Math.round(r.pct)); if (k.recent.length > 10) k.recent.shift();
    t.answers.forEach(function (a) {
      var m = k.mastery[a.gen] == null ? 50 : k.mastery[a.gen];
      k.mastery[a.gen] = Math.max(0, Math.min(100, m + (a.ok ? 4 : -6)));
      if (!a.ok) k.errors[a.tag] = (k.errors[a.tag] || 0) + 1;
    });
    k.lastTest = { n: t.n, correct: t.correct };
    r.stageBefore = stageBefore; r.stageAfter = M.stageFor(k.best); r.gotShield = gotShield;
    r.correct = t.correct; r.n = t.n;
    S.result = r;
    go('resultado');
  }
  /* Para saltar directamente a una pantalla desde la barra de demostración */
  function ensureTest(phase) {
    if (!S.test || S.test.done) startTest(10);
    var t = S.test, q = t.qs[t.i];
    if (phase === 'fail') {
      var wrong = q.options.filter(function (o) { return o.tag !== 'ok'; })[0];
      t.phase = 'fail'; t.given = wrong.v; t.tag = wrong.tag; t.expl = E.explain(q, wrong.tag, wrong.v);
    } else if (t.phase !== 'ask') { t.phase = 'ask'; t.sel = null; t.entry = ''; }
  }
  function fakeResult() {
    var k = kid();
    startTest(10);
    S.test.correct = 9; S.test.i = 9;
    S.test.answers = S.test.qs.map(function (q, i) { return { gen: q.gen, ok: i !== 3, tag: i === 3 ? 'cuenta-mal' : 'ok', ms: 6000 }; });
    finishTest();
    return k;
  }

  /* ---------- Pantallas del niño ---------- */
  function topKid(left, showRight) {
    var k = kid();
    var right = showRight === false ? '' :
      '<button class="pill gold" data-act="sheet" data-v="stars" aria-label="Mis estrellas">' + ic('star', 22) + balance(k.id) + '</button>' +
      '<button class="icon-btn" data-act="go" data-v="perfiles" aria-label="Cambiar de perfil">' + ic('users', 26) + '</button>';
    return '<div class="top"><div class="l">' + (left || '<div class="brand-in">' + logo() + '</div>') + '</div><div class="r">' + right + '</div></div>';
  }
  function backBtn(to, label) { return '<button class="icon-btn" data-act="go" data-v="' + to + '" aria-label="' + (label || 'Volver') + '">' + ic('back', 26) + '</button>'; }
  function anim(cls, i) { return S.fresh ? ' ' + cls + ' d' + (i || 0) : ''; }

  function scrPerfiles() {
    var cards = S.kids.map(function (k, i) {
      var st = k.streak > 0 ? '<span class="chip">' + ic('flame', 16, 'gold') + plural(k.streak, 'día', 'días') + '</span>' : '<span class="chip">' + ic('flame', 16) + 'Racha nueva</span>';
      return '<button class="pcard' + anim('pop', i) + '" data-act="pick" data-v="' + k.id + '" aria-label="Jugar como ' + esc(k.name) + '">' +
        mascot(k, 'contenta', { cls: 'pm' }).replace('class="mascot pm"', 'class="mascot pm" style="width:190px;height:190px"') +
        '<span class="nm">' + esc(k.name) + '</span>' +
        '<span class="row"><span class="chip">Nivel ' + k.level + '</span>' + st + '<span class="chip gold">' + ic('star', 16) + balance(k.id) + '</span></span></button>';
    }).join('');
    return '<div class="tscr">' + topKid(null, false) +
      '<h1 class="ttl">¿Quién va a jugar?</h1><p class="sub">Toca tu tarjeta para empezar.</p>' +
      '<div class="pcards">' + cards + '</div></div>';
  }

  function weekDots(k) {
    var html = '';
    for (var i = 0; i < 7; i++) {
      var d = today(i - 6), st = i < 6 ? k.week[i] : (k.doneToday && k.streakToday ? 'done' : 'today');
      var inner = st === 'done' ? ic('check', 22) : st === 'shield' ? ic('shield', 20) : '';
      var lbl = st === 'done' ? 'hecho' : st === 'shield' ? 'escudo usado' : st === 'today' ? 'hoy, pendiente' : 'sin test';
      html += '<div class="day"><span class="dot ' + st + '" aria-label="' + fmtDay(d) + ': ' + lbl + '">' + inner + '</span>' + (i === 6 ? 'Hoy' : dayLetter(d)) + '</div>';
    }
    return html;
  }
  function scrInicio() {
    var k = kid(), stage = M.stageFor(k.best), bal = balance(k.id), goal = nextGoal(k);
    var msg;
    if (k.doneToday) msg = '¡Reto de hoy hecho, ' + esc(k.name) + '! Si quieres, practicamos más.';
    else if (k.rested) msg = 'Tu racha de ' + k.rested + ' días descansa. ¡Empieza otra hoy!';
    else if (k.streak === 6) msg = '¡Hola, ' + esc(k.name) + '! Hoy puedes llegar a 7 días de racha.';
    else msg = '¡Hola, ' + esc(k.name) + '! Soy ' + esc(k.petName) + '. ¿Hacemos el reto de hoy?';
    var shields = '';
    for (var s = 0; s < 2; s++) shields += ic('shield', 22, 'sh' + (s < k.shields ? '' : ' off'));
    var pct = goal ? Math.min(100, Math.round(bal / goal.cost * 100)) : 0;
    var goalTxt = !goal ? 'Pide a tu familia que publique un premio.' :
      bal >= goal.cost ? '¡Ya tienes estrellas para «' + esc(goal.name) + '»! Pídeselo a tu familia.' :
      'Meta: ' + esc(goal.name) + ' · te faltan ' + (goal.cost - bal) + ' ★';
    return '<div class="tscr">' + topKid() +
      '<div class="home">' +
        '<div class="stagepane">' +
          '<div class="bubble' + anim('rise') + '">' + msg + '</div>' +
          '<div class="planet"></div>' + mascot(k, k.doneToday ? 'animando' : 'contenta') +
          '<button class="pill nametag" data-act="go" data-v="mascota" aria-label="Ver a ' + esc(k.petName) + '">' + esc(k.petName) + ' · <span class="gold">' + M.STAGES[stage - 1].name + '</span></button>' +
        '</div>' +
        '<div class="rcol">' +
          '<section class="card streak' + anim('rise', 1) + '" aria-label="Racha">' +
            '<div class="hd">' + ic('flame', 44, 'gold') + '<span class="big">' + k.streak + '</span><div><b style="font-size:20px">' + (k.streak === 1 ? 'día de racha' : 'días de racha') + '</b><div class="muted">Récord: ' + plural(k.best, 'día', 'días') + '</div></div></div>' +
            '<div class="week">' + weekDots(k) + '</div>' +
            '<div class="shields">' + shields + '<span>' + (k.shields ? 'Escudos: ' + k.shields + ' de 2. Protegen un día sin test.' : 'Consigue un escudo con 7 días seguidos.') + '</span></div>' +
          '</section>' +
          '<button class="card starscard' + anim('rise', 2) + '" data-act="sheet" data-v="stars" style="border:0;text-align:left;cursor:pointer;font:inherit;color:inherit">' +
            '<div class="hd"><span class="num">' + bal + '</span><b style="font-size:22px">estrellas</b></div>' +
            '<div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
            '<span class="muted">' + goalTxt + '</span>' +
          '</button>' +
          '<div class="cta">' + (k.doneToday
            ? '<button class="btn btn-line" data-act="go" data-v="longitud">Practicar (sin estrellas)</button>'
            : '<button class="btn btn-gold" data-act="go" data-v="longitud">' + ic('play', 30) + 'Empezar</button>') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function scrLongitud() {
    var k = kid(), practice = k.doneToday;
    var cards = [10, 15, 20].map(function (n, i) {
      var dis = n > k.maxLen;
      return '<button class="lencard' + anim('pop', i) + '" data-act="start" data-v="' + n + '"' + (dis ? ' disabled aria-disabled="true"' : '') + '>' +
        '<span class="n">' + n + '</span><span class="u">preguntas</span>' +
        '<span class="muted">' + (dis ? 'Tu familia lo ha limitado' : 'Unos ' + Math.round(n * 0.5) + ' minutos') + '</span>' +
        (practice || dis ? '' : '<span class="chip gold">' + ic('star', 16) + '+' + S.rules.passBonus[n] + ' si apruebas</span>') +
        '</button>';
    }).join('');
    return '<div class="tscr">' + topKid('<div class="brand-in">' + backBtn('inicio') + '</div>') +
      '<h1 class="ttl">¿Cuántas preguntas hoy?</h1>' +
      '<div class="lens">' + cards + '</div>' +
      '<p class="note">' + (practice ? 'Hoy ya ganaste tus estrellas. Esto es práctica libre.' : 'Apruebas con un ' + S.rules.passPct + ' % de aciertos. Cada acierto es una estrella.') + '</p></div>';
  }

  function visual(v) {
    if (!v) return '';
    if (v.type === 'chips') {
      return '<div class="chips">' + v.items.map(function (n, i) { return '<span class="chipn' + (i === v.hi ? ' hi' : '') + '">' + n + '</span>'; }).join('') + '</div>';
    }
    if (v.type === 'frame') {
      var need = 10 - v.a, f1 = '', f2 = '';
      for (var i = 0; i < 10; i++) f1 += '<i class="fd ' + (i < v.a ? 'a' : 'b') + '"></i>';
      for (var j = 0; j < 10; j++) f2 += '<i class="fd' + (j < v.b - need ? ' b' : '') + '"></i>';
      return '<div class="frames" aria-hidden="true"><div class="frame">' + f1 + '</div><div class="frame">' + f2 + '</div></div>';
    }
    if (v.type === 'columns') {
      var at = Math.floor(v.a / 10), au = v.a % 10, bt = Math.floor(v.b / 10), bu = v.b % 10;
      var rt = Math.floor(v.ans / 10), ru = v.ans % 10;
      var row0 = v.carry ? '<span></span><span class="cy">1</span><span></span>' : '<span></span><span class="cy">' + (at - 1) + '</span><span class="cy">+10</span>';
      var row1 = '<span></span>' + (v.borrow ? '<s>' + at + '</s>' : '<span>' + at + '</span>') + '<span>' + (v.borrow ? '<small>1</small>' : '') + au + '</span>';
      return '<div class="cols" aria-hidden="true">' + row0 + row1 +
        '<span>' + (v.op === '+' ? '+' : '−') + '</span><span>' + bt + '</span><span>' + bu + '</span>' +
        '<i class="rule"></i><span></span><span class="rs">' + (rt || '') + '</span><span class="rs">' + ru + '</span></div>';
    }
    return '';
  }
  function scrPregunta() {
    var t = S.test, k = kid(), q = curQ(), isMini = t.phase.indexOf('mini') === 0;
    var feedback = t.phase === 'ok' || t.phase === 'fail' || t.phase === 'miniok' || t.phase === 'minifail';
    var prog = '';
    for (var i = 0; i < t.n; i++) prog += '<i class="' + (i < t.i || (i === t.i && feedback && !isMini) ? 'done' : i === t.i ? 'cur' : '') + '"></i>';
    var head = '<div class="top"><div class="l">' + '<button class="icon-btn" data-act="pause" aria-label="Pausar y salir">' + ic('x', 24) + '</button></div>' +
      '<div class="prog" aria-hidden="true">' + prog + '</div><div class="count">Pregunta ' + (t.i + 1) + ' de ' + t.n + '</div></div>';
    var banner = isMini ? '<div class="minibanner">Mini-reto: una parecida para comprobarlo. No da estrellas, es para ti.</div>'
      : (t.practice ? '<div class="minibanner">Práctica libre: hoy ya ganaste tus estrellas.</div>' : '');
    var emo = t.phase === 'ok' || t.phase === 'miniok' ? 'animando' : feedback ? 'pensando' : 'contenta';
    var qtext = feedback ? esc(q.text) + ' = <span class="ans">' + q.answer + '</span>' : esc(q.text) + ' = ?';
    var gave = (t.phase === 'fail' || t.phase === 'minifail') ? '<div class="gave cmp"><span class="chip bad">Tu respuesta: ' + t.given + '</span><span class="chip good">Correcta: ' + q.answer + '</span></div>' : '';
    var left = '<div class="qcard"><span class="chip skill">' + esc(q.skill) + '</span>' +
      '<div class="qtext" aria-live="polite">' + qtext + '</div>' + gave + mascot(k, emo) + '</div>';
    var right;
    if (t.phase === 'ok') {
      right = '<div class="fbcard ok"><div class="big">' + ic('check', 44) + ' ' + t.praise + '</div>' +
        (t.practice ? '<p class="muted">Práctica: suma para tu dominio, no estrellas.</p>' : '<div class="stars-plus">+' + S.rules.perCorrect + ' ★</div>') +
        '<p>' + esc(k.petName) + ': «Has hecho bien el cálculo.»</p>' +
        '<button class="btn btn-gold" data-act="next">' + (t.i + 1 >= t.n ? 'Ver resultado' : 'Siguiente') + ic('arrow', 26) + '</button></div>';
    } else if (t.phase === 'fail') {
      var x = t.expl;
      right = '<div class="fbcard"><h3>' + esc(x.lead) + '</h3><p>' + esc(x.prefix) + '</p>' +
        '<div class="vis">' + visual(x.visual) + '</div>' +
        '<ol class="steps">' + x.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
        '<button class="btn btn-ok" data-act="understood">¡Entendido!</button></div>';
    } else if (t.phase === 'miniok') {
      right = '<div class="fbcard ok"><div class="big">' + ic('check', 44) + ' ¡Lo has pillado!</div><p>Ya sabes hacer este tipo de cuenta.</p>' +
        '<button class="btn btn-gold" data-act="next">' + (t.i + 1 >= t.n ? 'Ver resultado' : 'Seguimos') + ic('arrow', 26) + '</button></div>';
    } else if (t.phase === 'minifail') {
      right = '<div class="fbcard ok"><h3>Vamos a seguir practicando</h3><p>Era ' + q.answer + '. Lo verás otra vez en otro test, ¡y saldrá mejor!</p>' +
        '<button class="btn btn-gold" data-act="next">' + (t.i + 1 >= t.n ? 'Ver resultado' : 'Seguimos') + ic('arrow', 26) + '</button></div>';
    } else if (q.type === 'num') {
      var keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="nk" data-act="key" data-v="' + n + '">' + n + '</button>'; }).join('') +
        '<button class="nk del" data-act="key" data-v="del" aria-label="Borrar">' + ic('del', 30) + '</button><button class="nk" data-act="key" data-v="0">0</button><span></span>';
      right = '<div class="answers"><div class="numdisplay' + (t.entry ? '' : ' empty') + '" aria-live="polite">' + (t.entry || 'Escribe') + '</div>' +
        '<div class="numpad">' + keys + '</div>' +
        '<button class="btn btn-gold" data-act="check"' + (t.entry ? '' : ' disabled') + '>Comprobar</button></div>';
    } else {
      right = '<div class="answers"><div class="opts">' + q.options.map(function (o, i) {
        return '<button class="opt" data-act="opt" data-v="' + i + '" aria-pressed="' + (t.sel === i) + '">' + o.v + '</button>';
      }).join('') + '</div><button class="btn btn-gold" data-act="check"' + (t.sel === null ? ' disabled' : '') + '>Comprobar</button></div>';
    }
    return '<div class="tscr">' + head + banner + '<div class="qgrid">' + left + right + '</div></div>';
  }

  function donut(pct, passed) {
    var r = 44, c = 2 * Math.PI * r, len = c * pct / 100;
    return '<svg class="donut" width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="' + Math.round(pct) + ' % de aciertos">' +
      '<circle cx="56" cy="56" r="' + r + '" fill="none" stroke="#22397c" stroke-width="12"/>' +
      '<circle cx="56" cy="56" r="' + r + '" fill="none" stroke="' + (passed ? '#3DDC97' : '#FF8A5B') + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + len.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 56 56)"/>' +
      '<text x="56" y="63" text-anchor="middle" font-size="24" font-weight="800" fill="#F7F7FA" font-family="Lexend, system-ui, sans-serif">' + Math.round(pct) + '%</text></svg>';
  }
  function scrResultado() {
    var r = S.result, k = kid();
    if (!r) { fakeResult(); r = S.result; }
    var title = r.passed ? (r.correct === r.n ? '¡Test perfecto!' : '¡Test superado!') : '¡Buen esfuerzo!';
    var sub = r.passed ? r.correct + ' de ' + r.n + ' aciertos' : r.correct + ' de ' + r.n + '. Mañana lo vuelves a intentar.';
    var NAMES = { aciertos: function (it) { return 'Aciertos (' + it.n + ' × ' + S.rules.perCorrect + ' ★)'; },
                  superado: function () { return 'Test superado'; }, perfecto: function () { return 'Test perfecto'; },
                  racha: function (it) { return 'Bonus de racha · ' + it.days + ' días'; } };
    var rows = r.items.map(function (it, i) {
      return '<div class="rw' + (it.id === 'racha' ? ' hl' : '') + anim('rise', i + 1) + '"><span>' + NAMES[it.id](it) + '</span><b>+' + it.stars + ' ★</b></div>';
    }).join('');
    if (r.practice) rows = '<div class="rw"><span>Práctica libre: hoy ya ganaste tus estrellas</span><b>0 ★</b></div>';
    if (r.fast) rows += '<div class="rw"><span class="muted">Respondiste muy rápido: este test no da bonus</span><b class="muted">—</b></div>';
    var streakLine = r.streakExtended ? '<span class="chip gold">' + ic('flame', 16) + 'Racha: ' + plural(r.newStreak, 'día', 'días') + '</span>' :
      (k.streakToday ? '<span class="chip">' + ic('flame', 16) + 'Racha de hoy ya contada</span>' : '<span class="chip">' + ic('flame', 16) + 'Aprueba para sumar racha</span>');
    var evo = '';
    if (r.stageAfter > r.stageBefore) {
      evo = '<div class="evo' + anim('pop', 5) + '">' + mascot(k, 'animando', { stage: r.stageAfter }) + '<div><b style="font-size:20px">¡' + esc(k.petName) + ' ya es ' + M.STAGES[r.stageAfter - 1].name + '!</b><div class="muted">Mira su nuevo traje en «Mi mascota».</div></div></div>';
    } else if (r.stageAfter < 4) {
      var nxt = M.STAGES[r.stageAfter], left = nxt.bestStreak - k.best;
      evo = '<div class="evo">' + mascot(k, 'contenta', { stage: r.stageAfter + 1, cls: 'sil' }) +
        '<div><b style="font-size:18px">Siguiente etapa: ' + nxt.name + '</b><div class="muted">Te faltan ' + plural(Math.max(1, left), 'día', 'días') + ' de racha para conseguirla.</div></div></div>';
    }
    if (r.gotShield) evo += '<div class="evo">' + ic('shield', 40, 'sh') + '<div><b>¡Has ganado un escudo!</b><div class="muted">Protege tu racha un día sin test.</div></div></div>';
    return '<div class="tscr">' + topKid() +
      '<div class="res">' +
        '<div class="resl">' + donut(r.pct, r.passed) + mascot(k, r.passed ? 'animando' : 'contenta') +
          '<h2>' + title + '</h2><p class="sub">' + sub + '</p><div style="margin-top:8px">' + streakLine + '</div></div>' +
        '<div class="resr"><div class="caps">Tus estrellas de hoy</div>' + rows +
          '<div class="tot"><span>Total</span><b>+' + r.total + ' ★</b></div>' + evo +
          '<div class="resbtns"><button class="btn btn-line" data-act="go" data-v="mascota">Ver a ' + esc(k.petName) + '</button>' +
          '<button class="btn btn-gold" data-act="go" data-v="inicio">Volver al inicio</button></div></div>' +
      '</div></div>';
  }

  function scrMascota() {
    var k = kid(), cur = M.stageFor(k.best), view = S.preview || cur;
    var ladder = M.STAGES.map(function (st, i) {
      var n = i + 1, lock = n > cur;
      var status = n === cur ? '<span class="chip gold">Ahora</span>' : n < cur ? '<span class="chip good">' + ic('check', 16) + 'Conseguida</span>' :
        '<span class="chip">Faltan ' + plural(st.bestStreak - k.best, 'día', 'días') + '</span>';
      return '<button class="step' + (n === cur ? ' now' : '') + (lock ? ' lock' : '') + '" data-act="preview" data-v="' + n + '" aria-pressed="' + (view === n && n !== cur) + '">' +
        mascot(k, 'contenta', { stage: n }) + '<span><span class="nm">' + st.name + '</span><br><span class="rq">' + (st.bestStreak ? 'Mejor racha de ' + st.bestStreak + ' días' : 'Al empezar') + '</span></span>' +
        '<span class="st">' + status + '</span></button>';
    }).join('');
    var emos = M.EMOTIONS.map(function (e) { return '<button data-act="emo" data-v="' + e.id + '" aria-pressed="' + (S.emo === e.id) + '">' + e.label + '</button>'; }).join('');
    var locked = view > cur;
    return '<div class="tscr">' + topKid('<div class="brand-in">' + backBtn('inicio') + '<b style="font-size:26px">Mi mascota</b></div>') +
      '<div class="mas">' +
        '<div class="masl"><div class="planet"></div>' +
          mascot(k, S.emo, { stage: view, cls: locked ? 'sil' : '' }) +
          '<label class="nameedit"><span class="sr-only">Nombre de tu mascota</span><input data-input="petName" data-key="petName" maxlength="12" value="' + esc(k.petName) + '" aria-label="Nombre de tu mascota">' + ic('check', 24, 'gold') + '</label>' +
          '<div class="emos" role="group" aria-label="Emoción">' + emos + '</div></div>' +
        '<div class="masr"><div class="caps">Etapas: dependen de tu mejor racha y nunca bajan</div><div class="ladder">' + ladder + '</div>' +
          '<div class="kindsel">Compañero: <span class="segs">' + M.KINDS.map(function (kd) {
            return '<button data-act="kind" data-v="' + kd.id + '" aria-pressed="' + (k.kind === kd.id) + '">' + kd.name + '</button>'; }).join('') + '</span></div></div>' +
      '</div></div>';
  }

  function sheetStars() {
    var k = kid(), bal = balance(k.id);
    var rows = S.ledger.filter(function (e) { return e.kid === k.id; }).slice().reverse().map(function (e) {
      return '<div class="led"><span>' + esc(e.note) + '<br><span class="muted" style="font-size:14px">' + fmtDay(today(e.day)) + '</span></span><b class="' + (e.amount >= 0 ? 'pos' : 'neg') + '">' + (e.amount > 0 ? '+' : '−') + Math.abs(e.amount) + ' ★</b></div>';
    }).join('');
    var goals = S.rewards.map(function (r) {
      var p = Math.min(100, Math.round(bal / r.cost * 100));
      return '<div class="led" style="flex-direction:column;gap:6px"><span style="display:flex;justify-content:space-between"><span>' + esc(r.name) + '</span><b class="gold">' + r.cost + ' ★</b></span><div class="bar"><i style="width:' + p + '%"></i></div></div>';
    }).join('');
    return '<div class="overlay" data-act="closesheet"><div class="sheetbox" role="dialog" aria-label="Mis estrellas" data-stop="1">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h3>Mis estrellas</h3><button class="icon-btn" data-act="closesheet" aria-label="Cerrar">' + ic('x', 24) + '</button></div>' +
      '<div class="starscard"><div class="hd"><span class="num">' + bal + '</span><b>estrellas</b></div></div>' +
      '<div class="caps">Metas que ha publicado tu familia</div>' + goals +
      '<p class="muted" style="margin:0;font-size:15px">Para canjear un premio, pídeselo a tu familia.</p>' +
      '<div class="caps">Historial</div>' + rows + '</div></div>';
  }

  /* ---------- Pantallas del padre ---------- */
  function pinPad(prefix) {
    var keys = '';
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (n) { keys += '<button data-act="' + prefix + '" data-v="' + n + '">' + n + '</button>'; });
    return keys + '<span></span><button data-act="' + prefix + '" data-v="0">0</button><button class="ghost" data-act="' + prefix + '" data-v="del" aria-label="Borrar">' + ic('del', 28) + '</button>';
  }
  function pinDots(entry, shake) {
    var d = ''; for (var i = 0; i < 4; i++) d += '<i class="' + (i < entry.length ? 'on' : '') + '"></i>';
    return '<div class="dots' + (shake ? ' shake' : '') + '" aria-label="' + entry.length + ' de 4 dígitos">' + d + '</div>';
  }
  function scrPin() {
    var p = S.pin, locked = p.lockedUntil > Date.now();
    return '<div class="pscr"><div class="pbody pin">' +
      '<div class="brand-in" style="justify-content:center"><span class="mk" style="width:64px;height:64px">' + (A.mark || '') + '</span></div>' +
      '<h2>Modo padre</h2><p class="lead" style="margin:0">' + (locked ? 'Demasiados intentos. Vuelve a probar en 15 minutos.' : 'Introduce tu PIN') + '</p>' +
      pinDots(p.entry, p.shake) + '<p class="err" role="alert">' + esc(p.err) + '</p>' +
      '<div class="keys">' + pinPad(locked ? 'noop' : 'pin') + '</div>' +
      (locked ? '<button class="link" data-act="unlock">Demo: desbloquear</button>' : '<button class="link" data-act="forgot">¿Has olvidado el PIN?</button>') +
    '</div></div>';
  }
  function tabbar() {
    var tabs = [['panel', 'Panel', 'grid'], ['canje', 'Canjear', 'gift'], ['ajustes', 'Ajustes', 'gear']];
    return '<nav class="tabbar">' + tabs.map(function (t) {
      return '<button data-act="go" data-v="' + t[0] + '" aria-current="' + (S.screen === t[0]) + '">' + ic(t[2], 26) + t[1] + '</button>';
    }).join('') + '</nav>';
  }
  function scrPanel() {
    var cards = S.kids.map(function (k) {
      var open = S.openKid === k.id, bal = balance(k.id);
      var last = k.lastTest ? '<span class="chip ' + (k.lastTest.correct / k.lastTest.n >= 0.7 ? 'good' : 'bad') + '">Hoy: ' + k.lastTest.correct + '/' + k.lastTest.n + '</span>' :
        '<span class="chip">Hoy: sin test</span>';
      var body = '';
      if (open) {
        var skills = Object.keys(k.mastery).sort(function (a, b) { return k.mastery[a] - k.mastery[b]; }).map(function (g) {
          var v = k.mastery[g];
          return '<div class="mr"><span>' + esc(E.SKILLS[g].name) + '</span><b>' + v + '%</b><div class="bar"><i class="' + (v < 60 ? 'low' : v >= 85 ? 'hi' : '') + '" style="width:' + v + '%"></i></div></div>';
        }).join('');
        var errs = Object.keys(k.errors).sort(function (a, b) { return k.errors[b] - k.errors[a]; }).slice(0, 3).map(function (t) {
          return '<span class="chip bad">' + esc(E.ERROR_NAMES[t] || t) + ' · ' + k.errors[t] + '</span>';
        }).join('');
        var sug = suggestion(k);
        body = '<div class="caps">Dominio por habilidad</div><div class="mast">' + skills + '</div>' +
          '<div class="caps">Errores más frecuentes</div><div class="chips2">' + (errs || '<span class="muted">Ninguno esta semana</span>') + '</div>' +
          '<div class="caps">Últimos 7 días</div><div class="week" style="margin-top:0">' + weekDots(k).replace(/class="dot /g, 'style="width:32px;height:32px" class="dot ') + '</div>' +
          (sug ? '<div class="sug" data-stop="1"><span>' + esc(sug.text) + '</span><div class="acts"><button class="pbtn" data-act="level" data-v="' + k.id + '" data-d="' + (sug.dir === 'up' ? 1 : -1) + '">' + (sug.dir === 'up' ? 'Subir' : 'Bajar') + ' a nivel ' + (k.level + (sug.dir === 'up' ? 1 : -1)) + '</button><button class="pbtn line" data-act="dismiss" data-v="' + k.id + '">Ahora no</button></div></div>' : '');
      }
      return '<div class="kidcard" role="button" tabindex="0" data-act="openkid" data-v="' + k.id + '" aria-expanded="' + open + '">' +
        '<div class="hd">' + mascot(k, 'contenta') + '<div><div class="nm">' + esc(k.name) + '</div><div class="muted" style="font-size:14px">Nivel ' + k.level + ' · ' + (k.streak ? 'racha de ' + k.streak : 'racha en pausa') + '</div></div>' +
        '<div class="bal">' + bal + ' ★</div></div>' +
        '<div class="chips2">' + last + '<span class="chip">' + ic('shield', 14) + k.shields + ' escudos</span><span class="chip">Récord ' + k.best + ' días</span><span class="chip">' + k.avgSec.toFixed(1).replace('.', ',') + ' s por pregunta</span></div>' + body + '</div>';
    }).join('');
    var d = today();
    return '<div class="pscr"><div class="pbody"><h2>Hola</h2><p class="lead">' + d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) + '. Toca una tarjeta para ver el detalle.</p>' + cards + '</div>' + tabbar() + '</div>';
  }
  function redeemAmount() {
    var R = S.redeem;
    if (R.reward) { for (var i = 0; i < S.rewards.length; i++) if (S.rewards[i].id === R.reward) return { n: S.rewards[i].cost, what: S.rewards[i].name }; }
    var n = parseInt(R.custom, 10);
    return { n: isNaN(n) ? 0 : n, what: R.reason.trim() || 'Canje' };
  }
  function scrCanje() {
    var R = S.redeem, k = kid(R.kid), bal = balance(k.id), amt = redeemAmount();
    var sel = S.kids.map(function (c) {
      return '<button data-act="rkid" data-v="' + c.id + '" aria-pressed="' + (R.kid === c.id) + '">' + mascot(c, 'contenta') + esc(c.name) + '<b class="gold">' + balance(c.id) + ' ★</b></button>';
    }).join('');
    var rows = S.rewards.map(function (r) {
      var dis = r.cost > bal;
      return '<button class="rrow" data-act="rrew" data-v="' + r.id + '" aria-pressed="' + (R.reward === r.id) + '"' + (dis ? ' disabled' : '') + '><span>' + esc(r.name) + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + (dis ? '<small>Le faltan ' + (r.cost - bal) + ' ★</small>' : '') + '</span><b>' + r.cost + ' ★</b></button>';
    }).join('');
    var after = bal - amt.n, valid = amt.n > 0 && after >= 0;
    var hist = S.ledger.filter(function (e) { return e.kid === k.id && (e.type === 'canje' || e.type === 'ajuste'); }).slice().reverse().map(function (e) {
      return '<div class="led"><span>' + esc(e.note) + '<br><span class="muted">' + fmtDay(today(e.day)) + '</span></span><span style="display:flex;gap:8px;align-items:center"><b class="' + (e.amount >= 0 ? 'pos' : 'neg') + '">' + (e.amount > 0 ? '+' : '−') + Math.abs(e.amount) + ' ★</b>' +
        (e.type === 'canje' && !e.fixed ? '<button class="link" style="padding:4px;min-height:0" data-act="compensate" data-v="' + e.id + '">Corregir</button>' : '') + '</span></div>';
    }).join('') || '<p class="muted" style="margin:0">Todavía no hay canjes.</p>';
    var sheet = '';
    if (S.confirm) {
      sheet = '<button class="scrim" data-act="cancelconfirm" aria-label="Cancelar"></button><div class="sheet-p" role="dialog" aria-label="Confirmar con PIN">' +
        '<b style="font-size:20px">Descontar ' + amt.n + ' ★ a ' + esc(k.name) + '</b><span class="muted">' + esc(amt.what) + ' · introduce tu PIN</span>' +
        pinDots(S.confirm.entry, S.confirm.shake) + '<p class="err" role="alert">' + esc(S.confirm.err) + '</p><div class="keys">' + pinPad('cpin') + '</div></div>';
    }
    return '<div class="pscr"><div class="pbody"><h2>Canjear estrellas</h2><p class="lead">Solo tú puedes descontar estrellas. El saldo nunca baja de cero.</p>' +
      '<div class="kidsel" role="group" aria-label="Hijo">' + sel + '</div>' +
      '<div class="balbig">Saldo de ' + esc(k.name) + '<b>' + bal + ' ★</b></div>' +
      '<div class="caps">Premios</div>' + rows +
      '<div class="caps">U otra cantidad</div>' +
      '<label class="field">Estrellas a descontar<input type="text" inputmode="numeric" data-input="custom" data-key="custom" value="' + esc(R.custom) + '" placeholder="Por ejemplo, 15"></label>' +
      '<label class="field">Motivo<input type="text" data-input="reason" data-key="reason" value="' + esc(R.reason) + '" placeholder="Por ejemplo, cromos"></label>' +
      '<div class="sumbar"><div style="display:flex;justify-content:space-between"><span>' + esc(amt.what) + '</span><b class="gold">' + (amt.n ? '−' + amt.n + ' ★' : '—') + '</b></div>' +
        '<div style="display:flex;justify-content:space-between"><span class="muted">Saldo después</span><b>' + (amt.n ? after + ' ★' : '—') + '</b></div>' +
        (amt.n && after < 0 ? '<span style="color:var(--soft-fail)">No hay estrellas suficientes.</span>' : '') +
        '<button class="pbtn full" data-act="askconfirm"' + (valid ? '' : ' disabled') + '>' + ic('lock', 20) + ' Confirmar con PIN</button></div>' +
      '<div class="caps">Historial de canjes</div><div class="hist">' + hist + '</div>' +
      '<p class="muted" style="font-size:13px;margin:0">Los apuntes no se borran: un error se corrige con un apunte de compensación.</p>' +
      '</div>' + tabbar() + sheet + '</div>';
  }
  function stepper(key, val, label, small) {
    return '<div class="srow"><span class="lb">' + label + (small ? '<small>' + small + '</small>' : '') + '</span><span class="stepper">' +
      '<button data-act="step" data-v="' + key + '" data-d="-1" aria-label="Menos">−</button><b>' + val + '</b><button data-act="step" data-v="' + key + '" data-d="1" aria-label="Más">+</button></span></div>';
  }
  function scrAjustes() {
    var kids = S.kids.map(function (k) {
      return stepper('level:' + k.id, k.level, esc(k.name) + ' · nivel', k.level > 3 ? 'El prototipo genera preguntas hasta el nivel 3' : null) +
        '<div class="srow"><span class="lb">Longitud máxima<small>' + esc(k.name) + ' no verá tests más largos</small></span><span class="segs">' + [10, 15, 20].map(function (n) {
          return '<button data-act="maxlen" data-v="' + k.id + '" data-n="' + n + '" aria-pressed="' + (k.maxLen === n) + '">' + n + '</button>'; }).join('') + '</span></div>';
    }).join('');
    var R = S.rules;
    var rewards = S.rewards.map(function (r) {
      return '<div class="rw-edit"><input data-input="rname" data-id="' + r.id + '" data-key="rname' + r.id + '" value="' + esc(r.name) + '" aria-label="Nombre del premio">' +
        '<input data-input="rcost" data-id="' + r.id + '" data-key="rcost' + r.id + '" value="' + r.cost + '" inputmode="numeric" style="flex:0 0 72px" aria-label="Coste en estrellas">' +
        '<button class="x" data-act="delrew" data-v="' + r.id + '" aria-label="Quitar premio">' + ic('x', 20) + '</button></div>';
    }).join('');
    return '<div class="pscr"><div class="pbody"><h2>Ajustes</h2>' +
      '<section class="sect"><h3>Hijos</h3>' + kids + '</section>' +
      '<section class="sect"><h3>Estrellas</h3>' +
        stepper('perCorrect', R.perCorrect, 'Por acierto') + stepper('passPct', R.passPct + ' %', 'Para aprobar', 'Porcentaje mínimo de aciertos') +
        stepper('pb10', R.passBonus[10], 'Bonus al aprobar 10') + stepper('pb15', R.passBonus[15], 'Bonus al aprobar 15') + stepper('pb20', R.passBonus[20], 'Bonus al aprobar 20') +
        stepper('perfect', R.perfect, 'Test perfecto') +
        stepper('sb3', R.streakBonus[3], 'Racha de 3 días') + stepper('sb7', R.streakBonus[7], 'Racha de 7 días') + stepper('sb14', R.streakBonus[14], 'Racha de 14 días') + stepper('sb30', R.streakBonus[30], 'Racha de 30 días') +
      '</section>' +
      '<section class="sect"><h3>Premios</h3>' + rewards + '<button class="pbtn line" data-act="addrew" style="margin-top:8px">+ Añadir premio</button></section>' +
      '<section class="sect"><h3>Equivalencia</h3><label class="field">Solo la ves tú. La app no calcula dinero.<input type="text" data-input="equivalence" data-key="equivalence" value="' + esc(S.equivalence) + '" placeholder="Por ejemplo, 10 ★ = un cromo"></label></section>' +
      '<section class="sect"><h3>Rachas</h3>' +
        '<div class="srow"><span class="lb">Escudos<small>Se ganan cada 7 días, máximo 2</small></span><span class="segs"><button data-act="shields" data-v="1" aria-pressed="' + S.shieldsOn + '">Sí</button><button data-act="shields" data-v="0" aria-pressed="' + !S.shieldsOn + '">No</button></span></div>' +
        stepper('dayStart', S.dayStart + ':00', 'El día empieza a las', 'Un test a las 2:00 cuenta para el día anterior') +
      '</section>' +
      '<section class="sect"><h3>Idioma</h3><div class="srow"><span class="lb">Idioma de la app<small>El prototipo solo está en español</small></span><span class="segs">' +
        ['es', 'en', 'fr', 'de'].map(function (l) { return '<button data-act="lang" data-v="' + l + '" aria-pressed="' + (S.lang === l) + '">' + l.toUpperCase() + '</button>'; }).join('') + '</span></div></section>' +
      '<section class="sect"><h3>Datos</h3><div style="display:flex;flex-direction:column;gap:8px;padding:6px 0">' +
        '<button class="pbtn line" data-act="demo" data-v="Exportación preparada (en la app real se descarga un archivo).">Exportar datos</button>' +
        '<button class="pbtn line" data-act="demo" data-v="En la app real se pide el PIN y una confirmación.">Borrar un hijo</button>' +
        '<button class="pbtn line" data-act="demo" data-v="En la app real se pide el PIN y una confirmación.">Borrar la cuenta</button></div></section>' +
      '<button class="pbtn line" data-act="logout">Salir del modo padre</button>' +
      '</div>' + tabbar() + '</div>';
  }

  /* ---------- Página y render ---------- */
  function screenHtml() {
    if (S.device === 'phone') {
      if (!S.authed) return scrPin();
      return { panel: scrPanel, canje: scrCanje, ajustes: scrAjustes }[S.screen]();
    }
    if (S.screen === 'pregunta' && !S.test) startTest(10);
    var html = { perfiles: scrPerfiles, inicio: scrInicio, longitud: scrLongitud, pregunta: scrPregunta, resultado: scrResultado, mascota: scrMascota }[S.screen]();
    if (S.sheet === 'stars') html += sheetStars();
    return html;
  }
  function page() {
    var d = DEV[S.device], list = S.device === 'tablet' ? KID_SCREENS : PARENT_SCREENS;
    var cur = S.device === 'phone' && !S.authed ? 'pin' :
      (S.screen === 'pregunta' && S.test && S.test.phase === 'fail' ? 'explicacion' : S.screen);
    var jump = list.map(function (s) { return '<button data-act="jump" data-v="' + s[0] + '" aria-current="' + (cur === s[0]) + '">' + s[1] + '</button>'; }).join('');
    return '<div class="wrap">' +
      '<header class="head"><div class="brand">' + logo() + '</div><p>Prototipo clicable de la fase 1. Todo es de demostración y se guarda solo en memoria.</p></header>' +
      '<div class="toolbar"><div class="seg" role="group" aria-label="Dispositivo">' +
        '<button data-act="device" data-v="tablet" aria-pressed="' + (S.device === 'tablet') + '">Tablet del niño</button>' +
        '<button data-act="device" data-v="phone" aria-pressed="' + (S.device === 'phone') + '">Móvil del padre</button></div>' +
        (S.device === 'phone' ? '<span class="tag-demo">PIN de prueba: ' + DEMO_PIN + '</span>' : '<span class="tag-demo">Niño activo: ' + esc(kid().name) + '</span>') +
      '</div>' +
      '<nav class="jump" aria-label="Ir a pantalla">' + jump + '</nav>' +
      '<div class="stagebox"><div class="scaler" id="scaler"><div class="device" id="device" style="width:' + d.w + 'px;height:' + d.h + 'px">' +
        screenHtml() + (S.toast ? '<div class="toast" role="status">' + esc(S.toast) + '</div>' : '') +
      '</div></div></div>' +
      '<div class="notes">' +
        '<section><h2>Cómo probarlo</h2><ol><li>Elige a Lucía: si aprueba hoy llega a 7 días, gana un escudo y su mascota pasa a Piloto.</li><li>Falla a propósito para ver la explicación y el mini-reto.</li><li>Cambia a «Móvil del padre», entra con el PIN y canjea un premio.</li></ol></section>' +
        '<section><h2>Reglas de estrellas</h2><ul><li>Aprobado con ' + S.rules.passPct + ' % · ' + S.rules.perCorrect + ' ★ por acierto.</li><li>Bonus de aprobado +' + S.rules.passBonus[10] + '/+' + S.rules.passBonus[15] + '/+' + S.rules.passBonus[20] + ' y perfecto +' + S.rules.perfect + '.</li><li>Rachas: día 3 +' + S.rules.streakBonus[3] + ', 7 +' + S.rules.streakBonus[7] + ', 14 +' + S.rules.streakBonus[14] + ', 30 +' + S.rules.streakBonus[30] + '.</li><li>Solo el primer test del día da estrellas. Tres respuestas en menos de 2 s quitan el bonus.</li></ul></section>' +
        '<section><h2>Fuera del prototipo</h2><ul><li>Guardado real, sin conexión e instalación (fase 2 y 4).</li><li>Niveles 4 a 6 e idiomas (fase 8).</li><li>Foto del cuaderno: aplazada.</li></ul></section>' +
      '</div></div>';
  }

  var app;
  function render() {
    var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-key'), pos = null;
    if (key && a.selectionStart != null) pos = a.selectionStart;
    var scroll = document.querySelector('.pbody'), st = scroll ? scroll.scrollTop : 0, sameScreen = !S.fresh;
    app.innerHTML = page();
    if (key) {
      var el = app.querySelector('[data-key="' + key + '"]');
      if (el) { el.focus(); if (pos != null) try { el.setSelectionRange(pos, pos); } catch (e) { /* no aplica */ } }
    }
    var sc2 = app.querySelector('.pbody');
    if (sc2 && sameScreen) sc2.scrollTop = st;
    S.fresh = false;
    if (S.pin.shake) S.pin.shake = false;
    if (S.confirm && S.confirm.shake) S.confirm.shake = false;
    fit();
  }
  function fit() {
    var d = DEV[S.device], box = app.querySelector('.stagebox'), sc = document.getElementById('scaler'), dev = document.getElementById('device');
    if (!box || !sc) return;
    var s = Math.min(1, box.clientWidth / d.w);
    dev.style.transform = 'scale(' + s + ')';
    sc.style.width = Math.round(d.w * s) + 'px';
    sc.style.height = Math.round(d.h * s) + 'px';
  }

  /* ---------- Acciones ---------- */
  function pinKey(state, v, onOk) {
    if (v === 'del') { state.entry = state.entry.slice(0, -1); state.err = ''; return; }
    if (state.entry.length >= 4) return;
    state.entry += v;
    if (state.entry.length === 4) {
      if (state.entry === DEMO_PIN) { state.entry = ''; state.err = ''; state.tries = 0; onOk(); }
      else {
        state.tries = (state.tries || 0) + 1; state.entry = ''; state.shake = true;
        state.err = state.tries >= 5 ? 'PIN incorrecto. Bloqueado 15 minutos.' : 'PIN incorrecto. Te quedan ' + (5 - state.tries) + ' intentos.';
        if (state.tries >= 5 && state === S.pin) state.lockedUntil = Date.now() + 15 * 60 * 1000;
      }
    }
  }
  var STEP = {
    perCorrect: [function () { return S.rules.perCorrect; }, function (v) { S.rules.perCorrect = v; }, 1, 5, 1],
    passPct: [function () { return S.rules.passPct; }, function (v) { S.rules.passPct = v; }, 50, 100, 5],
    pb10: [function () { return S.rules.passBonus[10]; }, function (v) { S.rules.passBonus[10] = v; }, 0, 20, 1],
    pb15: [function () { return S.rules.passBonus[15]; }, function (v) { S.rules.passBonus[15] = v; }, 0, 20, 1],
    pb20: [function () { return S.rules.passBonus[20]; }, function (v) { S.rules.passBonus[20] = v; }, 0, 20, 1],
    perfect: [function () { return S.rules.perfect; }, function (v) { S.rules.perfect = v; }, 0, 20, 1],
    sb3: [function () { return S.rules.streakBonus[3]; }, function (v) { S.rules.streakBonus[3] = v; }, 0, 50, 1],
    sb7: [function () { return S.rules.streakBonus[7]; }, function (v) { S.rules.streakBonus[7] = v; }, 0, 50, 1],
    sb14: [function () { return S.rules.streakBonus[14]; }, function (v) { S.rules.streakBonus[14] = v; }, 0, 100, 1],
    sb30: [function () { return S.rules.streakBonus[30]; }, function (v) { S.rules.streakBonus[30] = v; }, 0, 200, 5],
    dayStart: [function () { return S.dayStart; }, function (v) { S.dayStart = v; }, 0, 8, 1]
  };
  var ACT = {
    device: function (v) { S.device = v; S.fresh = true; S.sheet = null; S.screen = v === 'phone' ? 'panel' : (S.screen === 'pin' ? 'perfiles' : 'perfiles'); },
    jump: function (v) {
      if (S.device === 'phone') { if (v === 'pin') { S.authed = false; } else { S.authed = true; go(v); } S.fresh = true; return; }
      if (v === 'pregunta') { ensureTest('ask'); go('pregunta'); return; }
      if (v === 'explicacion') { ensureTest('fail'); go('pregunta'); S.fresh = true; return; }
      if (v === 'resultado') { if (!S.result) fakeResult(); go('resultado'); return; }
      go(v);
    },
    go: function (v) { go(v); },
    pick: function (v) { S.kidId = v; S.emo = 'contenta'; go('inicio'); },
    start: function (v) { startTest(parseInt(v, 10)); },
    opt: function (v) { S.test.sel = parseInt(v, 10); },
    key: function (v) {
      var t = S.test;
      if (v === 'del') t.entry = t.entry.slice(0, -1);
      else if (t.entry.length < 4) t.entry = (t.entry === '0' ? '' : t.entry) + v;
    },
    check: check,
    next: nextQ,
    understood: function () {
      var t = S.test;
      t.mini = E.similar(t.qs[t.i], Math.floor(Math.random() * 1e9));
      t.phase = 'mini'; t.sel = null; t.entry = '';
    },
    pause: function () { toast('Test en pausa. Lo retomas desde «Empezar».'); go('inicio'); },
    sheet: function (v) { S.sheet = v; },
    closesheet: function () { S.sheet = null; },
    preview: function (v) { var n = parseInt(v, 10); S.preview = S.preview === n ? null : n; },
    emo: function (v) { S.emo = v; },
    kind: function (v) { kid().kind = v; },
    pin: function (v) { pinKey(S.pin, v, function () { S.authed = true; S.lastParent = Date.now(); go('panel'); }); },
    noop: function () {},
    unlock: function () { S.pin.lockedUntil = 0; S.pin.tries = 0; S.pin.err = ''; },
    forgot: function () { toast('En la app real se restablece desde el email de la cuenta.'); },
    openkid: function (v) { S.openKid = S.openKid === v ? null : v; },
    level: function (v, el) { var k = kid(v); k.level = Math.max(1, Math.min(6, k.level + parseInt(el.getAttribute('data-d'), 10))); k.recent = []; toast(k.name + ' pasa a nivel ' + k.level + '.'); },
    dismiss: function (v) { kid(v).recent = []; toast('De acuerdo. Te avisaremos si sigue igual.'); },
    rkid: function (v) { S.redeem.kid = v; S.redeem.reward = null; },
    rrew: function (v) { S.redeem.reward = S.redeem.reward === v ? null : v; if (S.redeem.reward) S.redeem.custom = ''; },
    askconfirm: function () { S.confirm = { entry: '', err: '', tries: 0 }; },
    cancelconfirm: function () { S.confirm = null; },
    cpin: function (v) {
      pinKey(S.confirm, v, function () {
        var R = S.redeem, amt = redeemAmount(), k = kid(R.kid);
        if (amt.n <= 0 || balance(k.id) - amt.n < 0) { S.confirm = null; return; }
        S.ledger.push({ id: nextId(), kid: k.id, day: 0, type: 'canje', amount: -amt.n, note: amt.what });
        S.confirm = null; R.reward = null; R.custom = ''; R.reason = '';
        toast('Hecho: −' + amt.n + ' ★ a ' + k.name + '. Ya lo ve en su historial.');
      });
      if (S.confirm && S.confirm.tries >= 5) { S.confirm = null; S.authed = false; S.pin.lockedUntil = Date.now() + 15 * 60 * 1000; }
    },
    compensate: function (v) {
      var e = S.ledger.filter(function (x) { return x.id === v; })[0];
      if (!e) return;
      e.fixed = true;
      S.ledger.push({ id: nextId(), kid: e.kid, day: 0, type: 'ajuste', amount: -e.amount, note: 'Corrección: ' + e.note });
      toast('Apunte de compensación añadido: +' + (-e.amount) + ' ★');
    },
    step: function (v, el) {
      var d = parseInt(el.getAttribute('data-d'), 10);
      if (v.indexOf('level:') === 0) { var k = kid(v.slice(6)); k.level = Math.max(1, Math.min(6, k.level + d)); return; }
      var s = STEP[v]; s[1](Math.max(s[2], Math.min(s[3], s[0]() + d * s[4])));
    },
    maxlen: function (v, el) { kid(v).maxLen = parseInt(el.getAttribute('data-n'), 10); },
    delrew: function (v) { S.rewards = S.rewards.filter(function (r) { return r.id !== v; }); },
    addrew: function () { S.rewards.push({ id: 'r' + nextId(), name: 'Nuevo premio', cost: 50, note: '' }); },
    shields: function (v) { S.shieldsOn = v === '1'; },
    lang: function (v) { if (v !== 'es') toast('Inglés, francés y alemán llegan en la fase 8.'); },
    demo: function (v) { toast(v); },
    logout: function () { S.authed = false; S.pin.entry = ''; S.fresh = true; }
  };
  var INPUT = {
    petName: function (v) { kid().petName = v.trim() || kid().petName; return false; },
    custom: function (v) { S.redeem.custom = v.replace(/\D/g, '').slice(0, 4); if (S.redeem.custom) S.redeem.reward = null; return true; },
    reason: function (v) { S.redeem.reason = v.slice(0, 40); return true; },
    rname: function (v, el) { S.rewards.forEach(function (r) { if (r.id === el.getAttribute('data-id')) r.name = v; }); return false; },
    rcost: function (v, el) { var n = parseInt(v.replace(/\D/g, ''), 10); S.rewards.forEach(function (r) { if (r.id === el.getAttribute('data-id') && n > 0) r.cost = n; }); return false; },
    equivalence: function (v) { S.equivalence = v; return false; }
  };

  function boot() {
    app = document.getElementById('app');
    app.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-act]');
      if (!el || el.disabled) return;
      if (el.getAttribute('data-act') === 'closesheet' && ev.target.closest('[data-stop]') && el.classList.contains('overlay')) return;
      if (el.getAttribute('data-act') === 'openkid' && ev.target.closest('[data-stop]')) return;
      if (S.device === 'phone' && S.authed && Date.now() - S.lastParent > 5 * 60 * 1000) { S.authed = false; S.fresh = true; render(); return; }
      if (S.device === 'phone') S.lastParent = Date.now();
      ACT[el.getAttribute('data-act')](el.getAttribute('data-v'), el);
      render();
    });
    app.addEventListener('keydown', function (ev) {
      var el = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && el.getAttribute && el.getAttribute('role') === 'button') { ev.preventDefault(); el.click(); }
    });
    app.addEventListener('input', function (ev) {
      var el = ev.target, k = el.getAttribute('data-input');
      if (k && INPUT[k](el.value, el)) render();
    });
    app.addEventListener('change', function (ev) { if (ev.target.getAttribute('data-input')) render(); });
    document.addEventListener('keydown', function (ev) {
      if (S.device !== 'tablet' || S.screen !== 'pregunta' || !S.test || /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      var t = S.test, q = curQ(), asking = t.phase === 'ask' || t.phase === 'mini';
      if (asking && q.type === 'num' && /^[0-9]$/.test(ev.key)) ACT.key(ev.key);
      else if (asking && q.type === 'num' && ev.key === 'Backspace') ACT.key('del');
      else if (asking && q.type === 'mc' && /^[1-4]$/.test(ev.key)) ACT.opt(String(parseInt(ev.key, 10) - 1));
      else if (ev.key === 'Enter' && asking) check();
      else return;
      ev.preventDefault(); render();
    });
    window.addEventListener('resize', fit);
    render();
    // La barra de scroll aparece después del primer render y estrecha la página: volver a ajustar
    if (window.ResizeObserver) new ResizeObserver(fit).observe(app);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
