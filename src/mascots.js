/* StarMath — generador de mascotas.
   2 compañeros (zorro, robot) × 4 etapas × 3 emociones = 24 dibujos SVG planos, 200×200.
   La etapa depende de la mejor racha (nunca retrocede). Sin degradados ni sombras.
   Uso: StarMascots.svg('zorro', 2, 'animando')  →  cadena <svg>…</svg>            */
(function (root) {
  'use strict';

  var C = {
    gold: '#FFC933', goldDeep: '#E0A200', goldPale: '#FFE08A',
    cream: '#FFF1DC', ink: '#1B1B2F', white: '#F7F7FA',
    coral: '#FF8A5B', mint: '#3DDC97', lav: '#9AA8FF', sky: '#5AB6FF', skyDeep: '#3A93E0',
    violet: '#6C5CE7', violetDeep: '#4B3FB8', blue: '#4C7DFF', navyBand: '#0F1F5C',
    leather: '#6B3E26', lens: '#9BE1FF',
    foxO: '#FF8A3D', foxD: '#D9531E', foxEar: '#5A2417',
    rob: '#C9D3FF', robD: '#9AA8FF', robL: '#E3E8FF', visor: '#0D1B4A'
  };

  var STAGES = [
    { id: 'cadete', name: 'Cadete', bestStreak: 0 },
    { id: 'piloto', name: 'Piloto', bestStreak: 7 },
    { id: 'capitan', name: 'Capitán', bestStreak: 21 },
    { id: 'comandante', name: 'Comandante estelar', bestStreak: 50 }
  ];
  var EMOTIONS = [
    { id: 'contenta', key: 'happy', label: 'Contenta' },
    { id: 'pensando', key: 'thinking', label: 'Pensando' },
    { id: 'animando', key: 'cheering', label: 'Animando' }
  ];
  var KINDS = [
    { id: 'zorro', name: 'Zorro' },
    { id: 'robot', name: 'Robot' }
  ];

  function f(n) { return Math.round(n * 10) / 10; }

  function starPath(cx, cy, R, r) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
      pts.push(f(cx + rad * Math.cos(a)) + ' ' + f(cy + rad * Math.sin(a)));
    }
    return 'M' + pts.join('L') + 'Z';
  }
  function star(cx, cy, R, fill) {
    return '<path d="' + starPath(cx, cy, R, R * 0.46) + '" fill="' + (fill || C.gold) + '" stroke="' + (fill || C.gold) + '" stroke-width="2" stroke-linejoin="round"/>';
  }
  function sparkle(cx, cy, s, fill) {
    var k = s * 0.14;
    return '<path d="M' + cx + ' ' + (cy - s) + 'Q' + (cx + k) + ' ' + (cy - k) + ' ' + (cx + s) + ' ' + cy +
      'Q' + (cx + k) + ' ' + (cy + k) + ' ' + cx + ' ' + (cy + s) +
      'Q' + (cx - k) + ' ' + (cy + k) + ' ' + (cx - s) + ' ' + cy +
      'Q' + (cx - k) + ' ' + (cy - k) + ' ' + cx + ' ' + (cy - s) + 'Z" fill="' + (fill || C.gold) + '"/>';
  }
  function line(d, stroke, w) {
    return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  /* ---------- Piezas comunes por etapa ---------- */

  // Órbita de la etapa 4 (las dos mitades: una detrás y otra delante del personaje)
  function orbitBack() {
    return '<g transform="rotate(-18 100 112)">' + line('M6 112A94 30 0 0 1 194 112', C.goldPale, 4) + '</g>';
  }
  function orbitFront() {
    return '<g transform="rotate(-18 100 112)">' + line('M194 112A94 30 0 0 1 6 112', C.goldPale, 4) +
      '<g transform="translate(186 98)">' + sparkle(0, 0, 10, C.gold) + '</g></g>';
  }

  // Elemento de cuello: pañuelo (1), bufanda (2), cierre de capa (3 y 4)
  function neckItem(stage) {
    if (stage === 1) {
      return '<path d="M74 148L126 148L100 177Z" fill="' + C.coral + '"/><circle cx="100" cy="151" r="4.5" fill="' + C.gold + '"/>';
    }
    if (stage === 2) {
      return '<path d="M68 146Q100 162 132 146L132 159Q100 175 68 159Z" fill="' + C.sky + '"/>' +
        '<path d="M118 160L136 194L120 198L106 166Z" fill="' + C.skyDeep + '"/>';
    }
    return line('M62 152Q100 166 138 152', C.violetDeep, 6) + star(100, 160, 9, C.gold);
  }
  function capeBack(stage) {
    if (stage < 3) return '';
    var trim = stage === 4 ? line('M53 196L147 196', C.gold, 4) : '';
    return '<path d="M52 200C50 170 58 150 78 144L122 144C142 150 150 170 148 200Z" fill="' + C.violet + '"/>' + trim;
  }
  function epaulettes(stage) {
    if (stage < 3) return '';
    var s = '<g transform="rotate(-14 62 156)"><rect x="48" y="150" width="28" height="11" rx="5" fill="' + C.gold + '"/></g>' +
      '<g transform="rotate(14 138 156)"><rect x="124" y="150" width="28" height="11" rx="5" fill="' + C.gold + '"/></g>';
    if (stage === 4) {
      s += '<rect x="51" y="160" width="3" height="11" rx="1.5" fill="' + C.goldDeep + '"/><rect x="57" y="162" width="3" height="11" rx="1.5" fill="' + C.goldDeep + '"/><rect x="63" y="163" width="3" height="11" rx="1.5" fill="' + C.goldDeep + '"/>' +
        '<rect x="146" y="160" width="3" height="11" rx="1.5" fill="' + C.goldDeep + '"/><rect x="140" y="162" width="3" height="11" rx="1.5" fill="' + C.goldDeep + '"/><rect x="134" y="163" width="3" height="11" rx="1.5" fill="' + C.goldDeep + '"/>';
    }
    return s;
  }

  // Gorra, gafas o gorro de capitán. 'g' ajusta la geometría a cada cabeza.
  function headgear(stage, g) {
    var dy = g.dy;
    if (stage === 1) {
      return '<g transform="translate(0 ' + dy + ')">' +
        '<path d="M68 62C68 36 132 36 132 62Z" fill="' + C.blue + '"/>' +
        '<rect x="58" y="57" width="84" height="10" rx="5" fill="' + C.gold + '"/>' +
        star(100, 49, 8.5, C.gold) + '</g>';
    }
    if (stage === 2) {
      return '<rect x="' + g.strap[0] + '" y="' + (g.lensY - 4.5) + '" width="' + (g.strap[1] - g.strap[0]) + '" height="9" rx="4" fill="' + C.leather + '"/>' +
        '<rect x="88" y="' + (g.lensY - 3.5) + '" width="24" height="7" fill="' + C.gold + '"/>' +
        '<circle cx="78" cy="' + g.lensY + '" r="' + g.lensR + '" fill="' + C.lens + '" stroke="' + C.gold + '" stroke-width="4.5"/>' +
        '<circle cx="122" cy="' + g.lensY + '" r="' + g.lensR + '" fill="' + C.lens + '" stroke="' + C.gold + '" stroke-width="4.5"/>' +
        line('M72 ' + (g.lensY - 3) + 'Q75 ' + (g.lensY - 6) + ' 80 ' + (g.lensY - 6), C.white, 2.2) +
        line('M116 ' + (g.lensY - 3) + 'Q119 ' + (g.lensY - 6) + ' 124 ' + (g.lensY - 6), C.white, 2.2);
    }
    var s = '<g transform="translate(0 ' + dy + ')">' +
      '<path d="M60 62C60 30 140 30 140 62Z" fill="' + C.white + '"/>' +
      '<rect x="60" y="52" width="80" height="11" fill="' + C.navyBand + '"/>';
    if (stage === 4) s += '<rect x="60" y="49" width="80" height="3" fill="' + C.gold + '"/><rect x="60" y="63" width="80" height="3" fill="' + C.gold + '"/>';
    s += '<path d="M68 66Q100 78 132 66L128 61L72 61Z" fill="' + C.goldDeep + '"/>' +
      star(100, 57.5, 8.5, C.gold);
    if (stage === 4) s += star(100, 30, 12, C.gold) + sparkle(120, 24, 7, C.goldPale);
    return s + '</g>';
  }

  /* ---------- Emociones (comunes: bocadillo de pensar y chispas) ---------- */
  function thinkDots() {
    return '<circle cx="168" cy="58" r="3.2" fill="' + C.lav + '"/><circle cx="178" cy="44" r="4.8" fill="' + C.lav + '"/><circle cx="189" cy="26" r="6.8" fill="' + C.lav + '"/>';
  }
  function cheerSparks(stage) {
    var s = sparkle(24, 64, 9) + sparkle(176, 56, 12) + sparkle(16, 150, 7, C.goldPale);
    return stage === 4 ? sparkle(30, 30, 7, C.goldPale) + s : s;
  }

  /* ---------- Zorro ---------- */
  function fox(stage, emo) {
    var g = { dy: 0, strap: [50, 150], lensY: 64, lensR: 12 };
    var out = '';
    if (stage === 4) out += orbitBack();
    // cola
    out += '<path d="M126 190C166 198 204 172 192 138C189 128 182 122 175 122C177 140 160 158 130 164Z" fill="' + C.foxO + '"/>' +
      '<path d="M175 122C182 122 189 128 192 138C193 142 193 147 191 151C182 145 177 135 175 122Z" fill="' + C.cream + '"/>';
    out += capeBack(stage);
    // torso
    out += '<path d="M60 200C60 164 76 148 100 148C124 148 140 164 140 200Z" fill="' + C.foxO + '"/>' +
      '<ellipse cx="100" cy="177" rx="20" ry="26" fill="' + C.cream + '"/>';
    out += neckItem(stage) + epaulettes(stage);
    // brazos al aire (detrás de la cabeza)
    if (emo === 'cheering') {
      out += line('M64 172Q30 162 24 126', C.foxO, 16) + line('M136 172Q170 162 176 126', C.foxO, 16) +
        '<circle cx="24" cy="122" r="9.5" fill="' + C.cream + '"/><circle cx="176" cy="122" r="9.5" fill="' + C.cream + '"/>';
    }
    // cabeza
    var tilt = emo === 'thinking' ? ' transform="rotate(-6 100 110)"' : (emo === 'cheering' ? ' transform="translate(0 -3)"' : '');
    var h = '<g' + tilt + '>' +
      '<path d="M44 86L40 28L84 57Z" fill="' + C.foxO + '"/><path d="M50 76L48 43L73 58Z" fill="' + C.foxEar + '"/>' +
      '<path d="M156 86L160 28L116 57Z" fill="' + C.foxO + '"/><path d="M150 76L152 43L127 58Z" fill="' + C.foxEar + '"/>' +
      '<path d="M28 106L40 86C44 60 70 48 100 48C130 48 156 60 160 86L172 106L148 122C138 138 118 146 100 148C82 146 62 138 52 122Z" fill="' + C.foxO + '"/>' +
      '<path d="M100 148C80 146 62 134 56 118C70 111 86 107 100 115C114 107 130 111 144 118C138 134 120 146 100 148Z" fill="' + C.cream + '"/>' +
      '<ellipse cx="100" cy="119" rx="7.5" ry="5.5" fill="' + C.ink + '"/>';
    if (emo === 'happy') {
      h += '<ellipse cx="79" cy="98" rx="5.8" ry="8" fill="' + C.ink + '"/><ellipse cx="121" cy="98" rx="5.8" ry="8" fill="' + C.ink + '"/>' +
        '<circle cx="81" cy="95" r="2.2" fill="#fff"/><circle cx="123" cy="95" r="2.2" fill="#fff"/>' +
        line('M100 124L100 129M89 128Q100 139 111 128', C.ink, 3.5) +
        '<circle cx="62" cy="114" r="6" fill="' + C.coral + '" opacity=".55"/><circle cx="138" cy="114" r="6" fill="' + C.coral + '" opacity=".55"/>';
    } else if (emo === 'thinking') {
      h += '<ellipse cx="81" cy="97" rx="5.8" ry="8" fill="' + C.ink + '"/><ellipse cx="123" cy="95" rx="5.8" ry="8" fill="' + C.ink + '"/>' +
        '<circle cx="84" cy="93" r="2.2" fill="#fff"/><circle cx="126" cy="91" r="2.2" fill="#fff"/>' +
        line('M68 83L90 86M110 80Q122 71 135 78', C.foxEar, 4) +
        line('M93 131Q101 127 110 132', C.ink, 3.5);
    } else {
      h += line('M69 103Q79 88 89 103M111 103Q121 88 131 103', C.ink, 4.8) +
        '<path d="M86 126Q100 152 114 126Z" fill="' + C.ink + '"/><path d="M93 138Q100 146 107 138Q100 133 93 138Z" fill="' + C.coral + '"/>' +
        '<circle cx="62" cy="114" r="6" fill="' + C.coral + '" opacity=".55"/><circle cx="138" cy="114" r="6" fill="' + C.coral + '" opacity=".55"/>';
    }
    h += headgear(stage, g) + '</g>';
    out += h;
    // mano en la barbilla (delante)
    if (emo === 'thinking') {
      out += line('M130 178Q142 160 122 147', C.foxO, 15) + '<circle cx="121" cy="145" r="8.5" fill="' + C.cream + '"/>';
    }
    if (emo === 'thinking') out += thinkDots();
    if (emo === 'cheering') out += cheerSparks(stage);
    if (stage === 4) out += orbitFront();
    return out;
  }

  /* ---------- Robot ---------- */
  function robot(stage, emo) {
    var g = { dy: -2, strap: [44, 156], lensY: 65, lensR: 9.5 };
    var out = '';
    if (stage === 4) out += orbitBack();
    out += capeBack(stage);
    // torso
    out += '<rect x="66" y="144" width="68" height="62" rx="16" fill="' + C.rob + '"/>' +
      '<circle cx="100" cy="172" r="12" fill="' + C.visor + '"/>' + star(100, 172, 7, C.gold) +
      '<rect x="88" y="134" width="24" height="14" rx="4" fill="' + C.robD + '"/>';
    out += neckItem(stage) + epaulettes(stage);
    if (emo === 'cheering') {
      out += line('M70 170Q38 162 32 124', C.robD, 14) + line('M130 170Q162 162 168 124', C.robD, 14) +
        '<circle cx="32" cy="120" r="9.5" fill="' + C.robL + '"/><circle cx="168" cy="120" r="9.5" fill="' + C.robL + '"/>';
    }
    var tilt = emo === 'thinking' ? ' transform="rotate(-5 100 100)"' : (emo === 'cheering' ? ' transform="translate(0 -3)"' : '');
    var h = '<g' + tilt + '>' +
      line('M146 56L146 34', C.robD, 5) + star(146, 28, 9, C.gold) +
      '<circle cx="36" cy="96" r="13" fill="' + C.robD + '"/><circle cx="164" cy="96" r="13" fill="' + C.robD + '"/>' +
      '<rect x="40" y="52" width="120" height="88" rx="28" fill="' + C.rob + '"/>' +
      '<rect x="54" y="72" width="92" height="54" rx="22" fill="' + C.visor + '"/>';
    if (emo === 'happy') {
      h += '<circle cx="82" cy="94" r="7.5" fill="' + C.gold + '"/><circle cx="118" cy="94" r="7.5" fill="' + C.gold + '"/>' +
        '<circle cx="84.5" cy="91.5" r="2.4" fill="#fff"/><circle cx="120.5" cy="91.5" r="2.4" fill="#fff"/>' +
        line('M90 109Q100 118 110 109', C.gold, 5);
    } else if (emo === 'thinking') {
      h += '<circle cx="84" cy="94" r="7.5" fill="' + C.gold + '"/><circle cx="120" cy="91" r="7.5" fill="' + C.gold + '"/>' +
        '<circle cx="86.5" cy="91.5" r="2.4" fill="#fff"/><circle cx="122.5" cy="88.5" r="2.4" fill="#fff"/>' +
        line('M70 80L94 83M108 77Q120 71 132 77', C.lav, 4.5) +
        line('M92 112L108 112', C.gold, 5);
    } else {
      h += '<path d="' + starPath(82, 94, 11, 5) + '" fill="' + C.gold + '" stroke="' + C.gold + '" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="' + starPath(118, 94, 11, 5) + '" fill="' + C.gold + '" stroke="' + C.gold + '" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M88 106Q100 128 112 106Z" fill="' + C.gold + '"/>';
    }
    h += headgear(stage, g) + '</g>';
    out += h;
    if (emo === 'thinking') {
      out += line('M128 176Q140 160 122 146', C.robD, 14) + '<circle cx="121" cy="144" r="8.5" fill="' + C.robL + '"/>';
      out += thinkDots();
    }
    if (emo === 'cheering') out += cheerSparks(stage);
    if (stage === 4) out += orbitFront();
    return out;
  }

  /* ---------- API ---------- */
  function svg(kind, stage, emotion, opts) {
    opts = opts || {};
    var emo = emotion;
    for (var i = 0; i < EMOTIONS.length; i++) if (EMOTIONS[i].id === emotion) emo = EMOTIONS[i].key;
    var body = kind === 'robot' ? robot(stage, emo) : fox(stage, emo);
    var title = (opts.title !== undefined) ? opts.title : (kind + ' · ' + STAGES[stage - 1].name + ' · ' + emotion);
    var size = opts.size ? ' width="' + opts.size + '" height="' + opts.size + '"' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"' + size + ' role="img" aria-label="' + title + '"><title>' + title + '</title>' + body + '</svg>';
  }
  function stageFor(bestStreak) {
    var s = 1;
    for (var i = 0; i < STAGES.length; i++) if (bestStreak >= STAGES[i].bestStreak) s = i + 1;
    return s;
  }

  var api = { svg: svg, stageFor: stageFor, STAGES: STAGES, EMOTIONS: EMOTIONS, KINDS: KINDS, colors: C };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarMascots = api;
})(typeof window !== 'undefined' ? window : this);
