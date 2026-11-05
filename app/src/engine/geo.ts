/* Geografía de España: generadores de preguntas de opción múltiple con el mapa iluminado.
   Niveles (propios de la geografía, independientes del nivel de matemáticas):
     1 · comunidades autónomas, grandes ríos, grandes cordilleras y en qué comunidad está una capital
     2 · provincias, capitales, provincias de cada comunidad y todos los ríos y cordilleras
     3 · provincias vecinas, capitales con ciudades grandes de distractor, por dónde pasa un río,
         dónde desemboca, qué río pasa por una ciudad, picos y cuántas provincias tiene una comunidad
   Cada pregunta trae 4 opciones (3 en «¿dónde desemboca?») con la etiqueta de su error:
   «geo-vecina» (la de al lado), «geo-ciudad-grande» (una ciudad grande que no es la capital)
   o «geo-confusion» (otra cualquiera).                                                        */
import { I, pick, shuffle, type Draft, type GeoKind, type GeoRef, type MapLayer, type Option, type Question, type Rng, type Val, type Visual } from './core';
import { st, type Generator, type Step } from './types';
import { CCAA, MOUNTS, PROVS, PROV_BY_ID, RIVERS, RIVER_BY_ID, provsOf } from '../geo/places';
import { CCAA_NEIGHBORS, PROV_NEIGHBORS } from '../geo/neighbors';

export const GEO_MAX_LEVEL = 3;
const G = (t: GeoKind, id: string): Val => ({ k: 'geo', t, id });
const GS = (t: GeoKind, ids: string[]): Val => ({ k: 'geos', t, ids });
const R = (t: GeoKind, id: string): GeoRef => ({ t, id });
const o = (v: Val, tag: string): Option => ({ v, tag });
const map = (layers: MapLayer[], hi: GeoRef[], dot?: GeoRef): Visual => ({ type: 'map', layers, hi, ...(dot ? { dot } : {}) });
const draft = (prompt: string, vars: Draft['prompt']['vars'], answer: Val, cands: Option[], visual?: Visual, data: Record<string, number> = {}): Draft =>
  ({ prompt: { key: prompt, vars }, answer, cands, expr: 0, mcOnly: true, data, ...(visual ? { visual } : {}) });

/** Provincias de la península y las islas (Ceuta y Melilla salen solo en las preguntas de comunidades) */
const PROV_IDS = PROVS.filter(p => p.ccaa !== '18' && p.ccaa !== '19').map(p => p.id);
const CCAA_IDS = CCAA.map(c => c.id);
const MULTI = CCAA.filter(c => provsOf(c.id).length >= 2).map(c => c.id);

/** `n` distractores: primero los de `near` (etiqueta vecina), luego del resto; nunca los de `skip` */
function distract(r: Rng, n: number, near: string[], pool: string[], skip: Set<string>, nearMax = n): { id: string; tag: string }[] {
  const out: { id: string; tag: string }[] = [], used = new Set(skip);
  for (const id of shuffle(r, near)) { if (out.length >= Math.min(n, nearMax)) break; if (!used.has(id)) { used.add(id); out.push({ id, tag: 'geo-vecina' }); } }
  for (const id of shuffle(r, pool)) { if (out.length >= n) break; if (!used.has(id)) { used.add(id); out.push({ id, tag: 'geo-confusion' }); } }
  return out;
}
const nearProvsOutside = (ccaa: string) => [...new Set(provsOf(ccaa).flatMap(p => PROV_NEIGHBORS[p.id] ?? []))].filter(id => PROV_BY_ID[id]?.ccaa !== ccaa);

/* ---------- Explicaciones ---------- */
/** Lo que eligió el niño, si se puede pintar en el mapa (borde naranja) */
function altOf(given: Val | null): GeoRef | undefined {
  return given?.k === 'geo' && ['ccaa', 'prov', 'river', 'mount'].includes(given.t) ? R(given.t, given.id) : undefined;
}
function withAlt(v: Visual | undefined, given: Val | null, answer: Val): Visual | undefined {
  if (!v || v.type !== 'map') return v;
  const alt = altOf(given);
  return alt && !(answer.k === 'geo' && answer.id === alt.id && answer.t === alt.t) ? { ...v, alt } : v;
}
const altStep = (given: Val | null): Step[] => altOf(given) ? [st('ex.geo.alt', { given: given! })] : [];
const mouthStep = (rv: string): Step => {
  const r = RIVER_BY_ID[rv];
  return r.mouth === 'guadalquivir' ? st('ex.geo.riverInto', { r: G('river', rv), into: G('river', 'guadalquivir') }) : st('ex.geo.riverMouth', { r: G('river', rv), sea: G('sea', r.mouth) });
};
const provsList = (ccaa: string) => GS('prov', provsOf(ccaa).map(p => p.id));

/* ---------- Generadores ---------- */
export const GEO: Generator[] = [
  /* ---------------- Nivel 1 ---------------- */
  {
    id: 'geo-ccaa-map', level: 1,
    make(r) {
      const c = pick(r, CCAA_IDS);
      const ds = distract(r, 3, [], CCAA_IDS, new Set([c]));
      return draft('geoCcaaMap', {}, G('ccaa', c), ds.map(d => o(G('ccaa', d.id), d.tag)), map(['ccaa'], [R('ccaa', c)]), { c: +c });
    },
    explain(q, _tag, given) {
      const c = (q.answer as { id: string }).id;
      return { steps: [...(provsOf(c).length > 1 ? [st('ex.geo.ccaaProvs', { c: q.answer, list: provsList(c) })] : [st('ex.geo.provIn', { p: G('prov', provsOf(c)[0].id), ans: q.answer })]), ...altStep(given)],
               visual: withAlt(map(['ccaa'], [R('ccaa', c)]), given, q.answer) };
    }
  },
  {
    id: 'geo-river-map1', level: 1,
    make(r) { return riverMap(r, RIVERS.filter(x => x.main).map(x => x.id)); },
    explain: riverMapExplain
  },
  {
    id: 'geo-mount-map1', level: 1,
    make(r) { return mountMap(r, MOUNTS.filter(x => x.main).map(x => x.id)); },
    explain: mountMapExplain
  },
  {
    id: 'geo-city-ccaa', level: 1,
    make(r) {
      const p = PROV_BY_ID[pick(r, PROV_IDS)], c = p.ccaa;
      const ds = distract(r, 3, CCAA_NEIGHBORS[c] ?? [], CCAA_IDS.filter(x => x !== '18' && x !== '19'), new Set([c]), 2);
      return draft('geoCityCcaa', { c: G('city', p.capital) }, G('ccaa', c), ds.map(d => o(G('ccaa', d.id), d.tag)), map(['ccaa'], [], R('city', p.capital)), { p: +p.id });
    },
    explain(q, _tag, given) {
      const p = PROVS.find(x => +x.id === q.data.p)!;
      return { steps: [st('ex.geo.cityIn', { c: G('city', p.capital), ans: q.answer }), st('ex.geo.capitalOfProv', { c: G('city', p.capital), p: G('prov', p.id) }), ...altStep(given)],
               visual: withAlt(map(['ccaa'], [R('ccaa', p.ccaa)], R('city', p.capital)), given, q.answer) };
    }
  },

  {
    id: 'geo-prov-map1', level: 1,
    make(r) {
      const p = pick(r, PROV_IDS);
      const ds = distract(r, 3, [], PROV_IDS.filter(id => !(PROV_NEIGHBORS[p] ?? []).includes(id)), new Set([p]));
      return draft('geoProvMap', {}, G('prov', p), ds.map(d => o(G('prov', d.id), d.tag)), map(['prov'], [R('prov', p)]), { p: +p });
    },
    explain: provMapExplain
  },
  {
    id: 'geo-capital-of1', level: 1,
    make(r) {
      const p = PROV_BY_ID[pick(r, PROV_IDS)], near = new Set(PROV_NEIGHBORS[p.id] ?? []);
      const ds = distract(r, 3, [], PROV_IDS.filter(id => !near.has(id)).map(id => PROV_BY_ID[id].capital), new Set([p.capital]));
      return draft('geoCapitalOf', { p: G('prov', p.id) }, G('city', p.capital), ds.map(d => o(G('city', d.id), d.tag)), map(['prov', 'caps'], [R('prov', p.id)]), { p: +p.id });
    },
    explain: capitalExplain
  },

  /* ---------------- Nivel 2 ---------------- */
  {
    id: 'geo-prov-map', level: 2,
    make(r) {
      const p = pick(r, PROV_IDS);
      const ds = distract(r, 3, PROV_NEIGHBORS[p] ?? [], PROV_IDS, new Set([p]), 1);
      return draft('geoProvMap', {}, G('prov', p), ds.map(d => o(G('prov', d.id), d.tag)), map(['prov'], [R('prov', p)]), { p: +p });
    },
    explain: provMapExplain
  },
  {
    id: 'geo-capital-of', level: 2,
    make(r) {
      const p = PROV_BY_ID[pick(r, PROV_IDS)];
      const ds = distract(r, 3, (PROV_NEIGHBORS[p.id] ?? []).map(id => PROV_BY_ID[id].capital), PROV_IDS.map(id => PROV_BY_ID[id].capital), new Set([p.capital]), 2);
      return draft('geoCapitalOf', { p: G('prov', p.id) }, G('city', p.capital), ds.map(d => o(G('city', d.id), d.tag)), map(['prov', 'caps'], [R('prov', p.id)]), { p: +p.id });
    },
    explain: capitalExplain
  },
  {
    id: 'geo-prov-of-capital', level: 2,
    make(r) {
      const p = PROV_BY_ID[pick(r, PROV_IDS)];
      const ds = distract(r, 3, PROV_NEIGHBORS[p.id] ?? [], PROV_IDS, new Set([p.id]), 2);
      return draft('geoProvOfCapital', { c: G('city', p.capital) }, G('prov', p.id), ds.map(d => o(G('prov', d.id), d.tag)), map(['prov', 'caps'], [], R('city', p.capital)), { p: +p.id });
    },
    explain(q, _tag, given) {
      const p = PROVS.find(x => +x.id === q.data.p)!;
      return { steps: [st('ex.geo.capitalOfProv', { c: G('city', p.capital), p: q.answer }), st('ex.geo.provIn', { p: q.answer, ans: G('ccaa', p.ccaa) }), ...altStep(given)],
               visual: withAlt(map(['prov', 'caps'], [R('prov', p.id)], R('city', p.capital)), given, q.answer) };
    }
  },
  {
    id: 'geo-prov-ccaa', level: 2,
    make(r) {
      const p = PROV_BY_ID[pick(r, PROV_IDS)], c = p.ccaa;
      const ds = distract(r, 3, CCAA_NEIGHBORS[c] ?? [], CCAA_IDS.filter(x => x !== '18' && x !== '19'), new Set([c]), 2);
      return draft('geoProvCcaa', { p: G('prov', p.id) }, G('ccaa', c), ds.map(d => o(G('ccaa', d.id), d.tag)), map(['ccaa'], [R('prov', p.id)]), { p: +p.id });
    },
    explain(q, _tag, given) {
      const p = PROVS.find(x => +x.id === q.data.p)!;
      return { steps: [st('ex.geo.provIn', { p: G('prov', p.id), ans: q.answer }), ...(provsOf(p.ccaa).length > 1 ? [st('ex.geo.ccaaProvs', { c: q.answer, list: provsList(p.ccaa) })] : []), ...altStep(given)],
               visual: withAlt(map(['ccaa'], [R('ccaa', p.ccaa), R('prov', p.id)]), given, q.answer) };
    }
  },
  {
    id: 'geo-ccaa-prov', level: 2,
    make(r) {
      const c = pick(r, MULTI), p = pick(r, provsOf(c)).id;
      const ds = distract(r, 3, nearProvsOutside(c), PROV_IDS.filter(id => PROV_BY_ID[id].ccaa !== c), new Set([p]), 2);
      return draft('geoCcaaProv', { c: G('ccaa', c) }, G('prov', p), ds.map(d => o(G('prov', d.id), d.tag)), map(['prov'], [R('ccaa', c)]), { c: +c, p: +p });
    },
    explain(q, _tag, given) {
      const c = String(q.data.c).padStart(2, '0');
      return { steps: [st('ex.geo.provIn', { p: q.answer, ans: G('ccaa', c) }), st('ex.geo.ccaaProvs', { c: G('ccaa', c), list: provsList(c) }), ...altStep(given)],
               visual: withAlt(map(['prov'], [R('ccaa', c), R('prov', (q.answer as { id: string }).id)]), given, q.answer) };
    }
  },
  {
    id: 'geo-river-map', level: 2,
    make(r) { return riverMap(r, RIVERS.map(x => x.id)); },
    explain: riverMapExplain
  },
  {
    id: 'geo-mount-map', level: 2,
    make(r) { return mountMap(r, MOUNTS.map(x => x.id)); },
    explain: mountMapExplain
  },

  /* ---------------- Nivel 3 ---------------- */
  {
    id: 'geo-prov-map-near', level: 3,
    make(r) {
      const p = pick(r, PROV_IDS.filter(id => (PROV_NEIGHBORS[id] ?? []).length >= 3));
      const ds = distract(r, 3, PROV_NEIGHBORS[p], PROV_IDS, new Set([p]));
      return draft('geoProvMap', {}, G('prov', p), ds.map(d => o(G('prov', d.id), d.tag)), map(['prov'], [R('prov', p)]), { p: +p });
    },
    explain: provMapExplain
  },
  {
    id: 'geo-capital-hard', level: 3,
    make(r) {
      const p = PROV_BY_ID[pick(r, PROV_IDS.filter(id => PROV_BY_ID[id].big?.length))];
      const bigs = shuffle(r, p.big!).slice(0, 2).map(id => ({ id, tag: 'geo-ciudad-grande' }));
      const rest = distract(r, 3 - bigs.length, (PROV_NEIGHBORS[p.id] ?? []).map(id => PROV_BY_ID[id].capital), PROV_IDS.map(id => PROV_BY_ID[id].capital), new Set([p.capital]));
      return draft('geoCapitalOf', { p: G('prov', p.id) }, G('city', p.capital), [...bigs, ...rest].map(d => o(G('city', d.id), d.tag)), map(['prov', 'caps'], [R('prov', p.id)]), { p: +p.id });
    },
    explain: capitalExplain
  },
  {
    id: 'geo-river-ccaa', level: 3,
    make(r) {
      const rv = pick(r, RIVERS), c = pick(r, rv.ccaa), skip = new Set([...rv.ccaa, ...(rv.near ?? []), '18', '19']);
      const ds = distract(r, 3, rv.ccaa.flatMap(x => CCAA_NEIGHBORS[x] ?? []), CCAA_IDS, skip, 2);
      return draft('geoRiverCcaa', { r: G('river', rv.id) }, G('ccaa', c), ds.map(d => o(G('ccaa', d.id), d.tag)), map(['ccaa', 'river'], [R('river', rv.id)]), { r: RIVERS.indexOf(rv) });
    },
    explain(q, _tag, given) {
      const rv = RIVERS[q.data.r];
      return { steps: [st('ex.geo.riverPasses', { r: G('river', rv.id), list: GS('ccaa', rv.ccaa) }), mouthStep(rv.id), ...altStep(given)],
               visual: withAlt(map(['ccaa', 'river'], [...rv.ccaa.map(c => R('ccaa', c)), R('river', rv.id)]), given, q.answer) };
    }
  },
  {
    id: 'geo-river-mouth', level: 3,
    make(r) {
      const rv = pick(r, RIVERS);
      const cands = rv.mouth === 'guadalquivir'
        ? [o(G('sea', 'atl'), 'geo-confusion'), o(G('sea', 'med'), 'geo-confusion'), o(G('river', 'ebro'), 'geo-confusion')]
        : (['atl', 'med', 'cant'] as const).filter(s => s !== rv.mouth).map(s => o(G('sea', s), 'geo-confusion'));
      const ans = rv.mouth === 'guadalquivir' ? G('river', 'guadalquivir') : G('sea', rv.mouth);
      return draft('geoRiverMouth', { r: G('river', rv.id) }, ans, cands, map(['river'], [R('river', rv.id)]), { r: RIVERS.indexOf(rv) });
    },
    explain(q) {
      const rv = RIVERS[q.data.r];
      return { steps: [mouthStep(rv.id), st('ex.geo.riverCities', { r: G('river', rv.id), list: GS('city', rv.cities) })],
               visual: map(['river'], rv.mouth === 'guadalquivir' ? [R('river', 'guadalquivir'), R('river', rv.id)] : [R('river', rv.id)]) };
    }
  },
  {
    id: 'geo-river-city', level: 3,
    make(r) {
      const rv = pick(r, RIVERS), city = pick(r, rv.cities);
      const ds = distract(r, 3, [], RIVERS.map(x => x.id), new Set([rv.id]));
      return draft('geoRiverCity', { c: G('city', city) }, G('river', rv.id), ds.map(d => o(G('river', d.id), d.tag)), map(['river'], [], R('city', city)),
                   { r: RIVERS.indexOf(rv), c: rv.cities.indexOf(city) });
    },
    explain(q, _tag, given) {
      const rv = RIVERS[q.data.r], city = rv.cities[q.data.c];
      return { steps: [st('ex.geo.cityRiver', { c: G('city', city), ans: q.answer }), st('ex.geo.riverCities', { r: q.answer, list: GS('city', rv.cities) }), ...altStep(given)],
               visual: withAlt(map(['river'], [R('river', rv.id)], R('city', city)), given, q.answer) };
    }
  },
  {
    id: 'geo-peak', level: 3,
    make(r) {
      const m = pick(r, MOUNTS.filter(x => x.id !== 'teide')), peak = pick(r, m.peaks);
      const ds = distract(r, 3, [], MOUNTS.filter(x => x.id !== 'teide').map(x => x.id), new Set([m.id]));
      return draft('geoPeak', { k: G('peak', peak) }, G('mount', m.id), ds.map(d => o(G('mount', d.id), d.tag)), map(['mount'], [], R('peak', peak)),
                   { m: MOUNTS.indexOf(m), k: m.peaks.indexOf(peak) });
    },
    explain(q, _tag, given) {
      const m = MOUNTS[q.data.m], peak = m.peaks[q.data.k];
      return { steps: [st('ex.geo.peakIn', { k: G('peak', peak), ans: q.answer }), st('ex.geo.mountIn', { m: q.answer, list: GS('ccaa', m.ccaa) }), ...altStep(given)],
               visual: withAlt(map(['mount'], [R('mount', m.id)], R('peak', peak)), given, q.answer) };
    }
  },
  {
    id: 'geo-ccaa-count', level: 3,
    make(r) {
      const c = pick(r, MULTI), n = provsOf(c).length;
      const cands = [n - 1, n + 1, n + 2, n - 2, n + 3].filter(x => x >= 1).map(x => o(I(x), 'geo-confusion'));
      return draft('geoCcaaCount', { c: G('ccaa', c) }, I(n), cands, map(['prov'], [R('ccaa', c)]), { c: +c });
    },
    explain(q) {
      const c = String(q.data.c).padStart(2, '0');
      return { steps: [st('ex.geo.ccaaProvs', { c: G('ccaa', c), list: provsList(c) })], visual: map(['prov'], [R('ccaa', c)]) };
    }
  },
  {
    id: 'geo-mount-ccaa', level: 3,
    make(r) {
      const m = pick(r, MOUNTS), c = pick(r, m.ccaa), skip = new Set([...m.ccaa, ...(m.near ?? []), '18', '19']);
      const ds = distract(r, 3, m.ccaa.flatMap(x => CCAA_NEIGHBORS[x] ?? []), CCAA_IDS, skip, 2);
      return draft('geoMountCcaa', { m: G('mount', m.id) }, G('ccaa', c), ds.map(d => o(G('ccaa', d.id), d.tag)), map(['ccaa', 'mount'], [R('mount', m.id)]), { m: MOUNTS.indexOf(m) });
    },
    explain(q, _tag, given) {
      const m = MOUNTS[q.data.m];
      return { steps: [st('ex.geo.mountIn', { m: G('mount', m.id), list: GS('ccaa', m.ccaa) }), ...altStep(given)],
               visual: withAlt(map(['ccaa', 'mount'], [...m.ccaa.map(c => R('ccaa', c)), R('mount', m.id)]), given, q.answer) };
    }
  }
];

/* ---------- Piezas compartidas ---------- */
function riverMap(r: Rng, ids: string[]): Draft {
  const rv = pick(r, ids);
  const ds = distract(r, 3, [], RIVERS.map(x => x.id), new Set([rv]));
  return draft('geoRiverMap', {}, G('river', rv), ds.map(d => o(G('river', d.id), d.tag)), map(['river'], [R('river', rv)]), { r: RIVERS.findIndex(x => x.id === rv) });
}
function riverMapExplain(q: Question, _tag: string, given: Val | null) {
  const rv = RIVERS[q.data.r];
  return { steps: [mouthStep(rv.id), st('ex.geo.riverCities', { r: q.answer, list: GS('city', rv.cities) }), ...altStep(given)],
           visual: withAlt(map(['river'], [R('river', rv.id)]), given, q.answer) };
}
function mountMap(r: Rng, ids: string[]): Draft {
  const m = pick(r, ids);
  const ds = distract(r, 3, [], MOUNTS.map(x => x.id), new Set([m]));
  return draft('geoMountMap', {}, G('mount', m), ds.map(d => o(G('mount', d.id), d.tag)), map(['mount'], [R('mount', m)]), { m: MOUNTS.findIndex(x => x.id === m) });
}
function mountMapExplain(q: Question, _tag: string, given: Val | null) {
  const m = MOUNTS[q.data.m];
  return { steps: [st('ex.geo.mountIn', { m: q.answer, list: GS('ccaa', m.ccaa) }), m.id === 'teide' ? st('ex.geo.teide') : st('ex.geo.peakOf', { m: q.answer, k: G('peak', m.peaks[0]) }), ...altStep(given)],
           visual: withAlt(map(['mount'], [R('mount', m.id)]), given, q.answer) };
}
function provMapExplain(q: Question, _tag: string, given: Val | null) {
  const p = PROVS.find(x => +x.id === q.data.p)!;
  return { steps: [st('ex.geo.provIn', { p: q.answer, ans: G('ccaa', p.ccaa) }), st('ex.geo.capitalOfProv', { c: G('city', p.capital), p: q.answer }), ...altStep(given)],
           visual: withAlt(map(['prov'], [R('prov', p.id)]), given, q.answer) };
}
function capitalExplain(q: Question, tag: string, given: Val | null) {
  const p = PROVS.find(x => +x.id === q.data.p)!;
  return { steps: [st('ex.geo.capitalOfProv', { c: q.answer, p: G('prov', p.id) }), ...(tag === 'geo-ciudad-grande' && given ? [st('ex.geo.bigCity', { given, p: G('prov', p.id) })] : []),
                   st('ex.geo.provIn', { p: G('prov', p.id), ans: G('ccaa', p.ccaa) })],
           visual: map(['prov', 'caps'], [R('prov', p.id)], R('city', p.capital)) };
}

/* ---------- Temas ---------- */
/** Temas que se pueden elegir */
export type GeoTopic = 'ccaa' | 'prov' | 'caps' | 'mount' | 'river';
export const GEO_TOPICS: GeoTopic[] = ['ccaa', 'prov', 'caps', 'mount', 'river'];
/** Con todo elegido, comunidades y provincias salen el doble que el resto */
export const TOPIC_WEIGHT: Record<GeoTopic, number> = { ccaa: 2, prov: 2, caps: 1, mount: 1, river: 1 };
export const GEO_TOPIC: Record<string, GeoTopic> = {
  'geo-ccaa-map': 'ccaa', 'geo-city-ccaa': 'ccaa', 'geo-prov-ccaa': 'ccaa', 'geo-ccaa-count': 'ccaa',
  'geo-prov-map1': 'prov', 'geo-prov-map': 'prov', 'geo-ccaa-prov': 'prov', 'geo-prov-map-near': 'prov',
  'geo-capital-of1': 'caps', 'geo-capital-of': 'caps', 'geo-prov-of-capital': 'caps', 'geo-capital-hard': 'caps',
  'geo-mount-map1': 'mount', 'geo-mount-map': 'mount', 'geo-peak': 'mount', 'geo-mount-ccaa': 'mount',
  'geo-river-map1': 'river', 'geo-river-map': 'river', 'geo-river-ccaa': 'river', 'geo-river-mouth': 'river', 'geo-river-city': 'river'
};
/** Temas que valen para un test: los permitidos por el padre y, si el niño puede elegir, los suyos */
export function topicsFor(c: { geoTopics?: string[]; geoTopicsFixed?: boolean; geoPick?: string[] }): GeoTopic[] {
  const ok = (l?: string[]) => (l ?? []).filter((t): t is GeoTopic => (GEO_TOPICS as string[]).includes(t));
  const allowed = ok(c.geoTopics).length ? ok(c.geoTopics) : GEO_TOPICS;
  if (c.geoTopicsFixed) return allowed;
  const pick = ok(c.geoPick).filter(t => allowed.includes(t));
  return pick.length ? pick : allowed;
}

/* ---------- Test de geografía ---------- */
export const GEO_BY_ID: Record<string, Generator> = Object.fromEntries(GEO.map(g => [g.id, g]));
export const GEO_LEVEL_SKILLS: Record<number, string[]> = {};
for (const g of GEO) (GEO_LEVEL_SKILLS[g.level] ||= []).push(g.id);
export const GEO_TAGS = ['geo-vecina', 'geo-ciudad-grande', 'geo-confusion'] as const;
/** Todo lo que aparece en el mapa de una pregunta (para comprobar que existe en el dibujo) */
export const geoRefs = (v?: Visual): GeoRef[] => v?.type === 'map' ? [...v.hi, ...(v.alt ? [v.alt] : []), ...(v.dot ? [v.dot] : [])] : [];
