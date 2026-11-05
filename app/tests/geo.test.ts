/* Geografía: cada pregunta tiene una sola respuesta correcta, los distractores son falsos de verdad,
   todo lo que se ilumina existe en el mapa y los datos (provincias, capitales, ríos…) cuadran.   */
import { describe, expect, it } from 'vitest';
import { GEO, GEO_LEVEL_SKILLS, makeQuestion, makeTest, explain, valKey, isGeo, type Question, type Val } from '../src/engine';
import { geoRefs } from '../src/engine/geo';
import { CCAA, PROVS, PROV_BY_ID, RIVERS, RIVER_BY_ID, MOUNTS, MOUNT_BY_ID, CITY_NAMES, PEAK_NAMES, provsOf } from '../src/geo/places';
import { MAP } from '../src/geo/map-data';
import { PROV_NEIGHBORS } from '../src/geo/neighbors';

const N = 2000;
const id = (v: Val) => (v as { id: string }).id;

/** ¿Es correcta esta opción? Se recalcula desde los datos, sin mirar cómo se generó */
function truth(q: Question, v: Val): boolean {
  const d = q.data, pid = String(d.p).padStart(2, '0'), cid = String(d.c).padStart(2, '0');
  switch (q.gen) {
    case 'geo-ccaa-map': return v.k === 'geo' && v.t === 'ccaa' && id(v) === cid;
    case 'geo-river-map1': case 'geo-river-map': return id(v) === RIVERS[d.r].id;
    case 'geo-mount-map1': case 'geo-mount-map': return id(v) === MOUNTS[d.m].id;
    case 'geo-city-ccaa': case 'geo-prov-ccaa': return id(v) === PROV_BY_ID[pid].ccaa;
    case 'geo-prov-map': case 'geo-prov-map-near': case 'geo-prov-of-capital': return id(v) === pid;
    case 'geo-capital-of': case 'geo-capital-hard': return id(v) === PROV_BY_ID[pid].capital;
    case 'geo-ccaa-prov': return PROV_BY_ID[id(v)]?.ccaa === cid;
    case 'geo-river-ccaa': return RIVERS[d.r].ccaa.includes(id(v));
    case 'geo-river-mouth': { const m = RIVERS[d.r].mouth; return m === 'guadalquivir' ? v.k === 'geo' && v.t === 'river' && id(v) === 'guadalquivir' : v.k === 'geo' && v.t === 'sea' && id(v) === m; }
    case 'geo-river-city': return RIVER_BY_ID[id(v)]?.cities.includes(RIVERS[d.r].cities[d.c]);
    case 'geo-peak': return MOUNT_BY_ID[id(v)]?.peaks.includes(MOUNTS[d.m].peaks[d.k]);
    case 'geo-ccaa-count': return v.k === 'int' && v.v === provsOf(cid).length;
    case 'geo-mount-ccaa': return MOUNTS[d.m].ccaa.includes(id(v));
  }
  throw new Error('sin comprobación: ' + q.gen);
}
/** Distractores que serían discutibles (comunidades por las que un río o una cordillera pasa de refilón) */
function doubtful(q: Question, v: Val): boolean {
  if (q.gen === 'geo-river-ccaa') return (RIVERS[q.data.r].near ?? []).includes(id(v));
  if (q.gen === 'geo-mount-ccaa') return (MOUNTS[q.data.m].near ?? []).includes(id(v));
  return false;
}
function onMap(r: { t: string; id: string }): boolean {
  switch (r.t) {
    case 'ccaa': return r.id in MAP.ccaa;
    case 'prov': return r.id in MAP.prov;
    case 'river': return r.id in MAP.rivers;
    case 'mount': return r.id in MAP.mounts || (r.id === 'teide' && 'teide' in MAP.peaks);
    case 'city': return r.id in MAP.cities;
    case 'peak': return r.id in MAP.peaks;
  }
  return false;
}

describe('geografía: ' + N + ' semillas por generador', () => {
  for (const g of GEO) {
    it(g.id + ' (nivel ' + g.level + ')', () => {
      const fails: string[] = [];
      const fail = (m: string) => { if (fails.length < 10) fails.push(m); };
      for (let seed = 1; seed <= N; seed++) {
        const q = makeQuestion(g.id, seed);
        const label = g.id + ' #' + seed;
        if (q.type !== 'mc') fail(label + ': no es de opción múltiple');
        const keys = q.options.map(o => valKey(o.v));
        const expected = q.gen === 'geo-river-mouth' && RIVERS[q.data.r].mouth !== 'guadalquivir' ? 3 : 4;
        if (q.options.length !== expected) fail(label + ': ' + q.options.length + ' opciones');
        if (new Set(keys).size !== keys.length) fail(label + ': opciones repetidas ' + keys.join(' '));
        if (q.options.filter(o => o.tag === 'ok').length !== 1) fail(label + ': no hay una sola correcta');
        if (!truth(q, q.answer)) fail(label + ': la respuesta no es correcta ' + valKey(q.answer));
        for (const o of q.options) if (o.tag !== 'ok' && (truth(q, o.v) || doubtful(q, o.v))) fail(label + ': distractor válido o dudoso ' + valKey(o.v));
        for (const r of geoRefs(q.visual)) if (!onMap(r)) fail(label + ': no está en el mapa ' + r.t + ':' + r.id);
        if (q.visual?.type !== 'map' || !q.visual.layers.length) fail(label + ': el mapa no dice qué capa enseñar');
        // la capa tiene que ser la del tema preguntado
        const need = q.gen.includes('river') ? 'river' : q.gen.includes('mount') || q.gen === 'geo-peak' ? 'mount' : q.gen.includes('ccaa-map') || q.gen === 'geo-city-ccaa' || q.gen === 'geo-prov-ccaa' ? 'ccaa' : 'prov';
        if (q.visual?.type === 'map' && !q.visual.layers.includes(need as never)) fail(label + ': falta la capa ' + need);
        for (const o of q.options) {
          if (o.tag === 'ok') continue;
          const x = explain(q, o.tag, o.v);
          for (const r of geoRefs(x.visual)) if (!onMap(r)) fail(label + ': explicación fuera del mapa ' + r.t + ':' + r.id);
          if (!x.steps.length) fail(label + ': explicación sin pasos');
        }
      }
      expect(fails).toEqual([]);
    });
  }
});

describe('geografía: datos', () => {
  it('50 provincias + Ceuta y Melilla, 17 comunidades + 2 ciudades, todas en el mapa', () => {
    expect(PROVS.length).toBe(52);
    expect(CCAA.length).toBe(19);
    expect(Object.keys(MAP.prov).sort()).toEqual(PROVS.map(p => p.id).sort());
    expect(Object.keys(MAP.ccaa).sort()).toEqual(CCAA.map(c => c.id).sort());
  });
  it('provincias por comunidad como en el mapa oficial', () => {
    const n = (c: string) => provsOf(c).length;
    expect([n('01'), n('07'), n('08'), n('09'), n('12'), n('10'), n('02'), n('16'), n('11'), n('05')]).toEqual([8, 9, 5, 4, 4, 3, 3, 3, 2, 2]);
  });
  it('cada provincia cae dentro de su comunidad en el mapa', () => {
    for (const p of PROVS) {
      const [a, b, c, d] = MAP.provBox[p.id as keyof typeof MAP.provBox], [A, B, C, D] = MAP.ccaaBox[p.ccaa as keyof typeof MAP.ccaaBox];
      expect(a >= A - 1 && b >= B - 1 && c <= C + 1 && d <= D + 1, p.name).toBe(true);
    }
  });
  it('capitales, ciudades, picos, ríos y cordilleras tienen nombre y punto en el mapa', () => {
    for (const p of PROVS) { expect(CITY_NAMES[p.capital], p.name).toBeTruthy(); expect(MAP.cities[p.capital as keyof typeof MAP.cities], p.capital).toBeTruthy(); }
    for (const p of PROVS) for (const c of p.big ?? []) expect(CITY_NAMES[c], c).toBeTruthy();
    for (const r of RIVERS) { expect(MAP.rivers[r.id as keyof typeof MAP.rivers]).toBeTruthy(); for (const c of r.cities) expect(MAP.cities[c as keyof typeof MAP.cities], c).toBeTruthy(); }
    for (const m of MOUNTS) for (const k of m.peaks) { expect(PEAK_NAMES[k]).toBeTruthy(); expect(MAP.peaks[k as keyof typeof MAP.peaks], k).toBeTruthy(); }
  });
  it('vecinas: Madrid limita con Toledo y Guadalajara; las islas no tienen vecinas', () => {
    expect(PROV_NEIGHBORS['28']).toEqual(expect.arrayContaining(['05', '19', '40', '45']));
    expect(PROV_NEIGHBORS['07'] ?? []).toEqual([]);
  });
});

describe('test de geografía', () => {
  it('cada nivel tiene sus preguntas y el test no mezcla materias', () => {
    for (let lv = 1; lv <= 3; lv++) expect(GEO_LEVEL_SKILLS[lv].length).toBeGreaterThanOrEqual(4);
    for (const lv of [1, 2, 3]) for (const n of [10, 15, 20]) {
      const qs = makeTest(lv, n, 1234 + lv * n, {}, 'geo');
      expect(qs).toHaveLength(n);
      expect(qs.every(q => isGeo(q.gen) && q.level <= lv)).toBe(true);
      expect(new Set(qs.map(q => JSON.stringify([q.prompt, q.visual]))).size).toBe(n);   // sin repetidas
    }
    expect(makeTest(3, 20, 7).some(q => isGeo(q.gen))).toBe(false);
  });
  it('el repaso de matemáticas no trae geografía ni al revés', () => {
    const qs = makeTest(2, 20, 99, { review: ['geo-prov-map', 'sum-20'] }, 'mates');
    expect(qs.some(q => isGeo(q.gen))).toBe(false);
    const gs = makeTest(2, 20, 99, { review: ['geo-ccaa-map', 'sum-20'] }, 'geo');
    expect(gs.every(q => isGeo(q.gen))).toBe(true);
  });
});
