/* Genera el mapa de España de la geografía (se ejecuta a mano: `npm run geo`).
   - Provincias y comunidades autónomas: es-atlas (IGN, licencia MIT). Países vecinos: world-atlas
     (Natural Earth, dominio público). Se simplifican conservando las fronteras compartidas.
   - Ríos, cordilleras, picos y ciudades: puntos (longitud, latitud) puestos a mano, abajo.
   - Proyección sencilla: grados × coseno de 40° en horizontal; Canarias en un recuadro abajo a la izquierda.
   Escribe src/geo/map-data.ts (dibujo, se carga solo al hacer un test de geografía) y
   src/geo/neighbors.ts (provincias y comunidades vecinas, para elegir distractores).          */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as topo from 'topojson-client';
import * as simp from 'topojson-simplify';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '..', 'src', 'geo');

/* ---------- Proyección ---------- */
const K = 100, C = Math.cos(40 * Math.PI / 180);
const CAN = { s: 0.85, x0: -90, y0: 742 };                 // recuadro de Canarias
const r1 = n => Math.round(n);                              // 1 unidad ≈ 1 km: no hacen falta decimales
function proj([lon, lat], canary = false) {
  if (canary) return [r1(CAN.x0 + (lon + 18.25) * C * K * CAN.s), r1(CAN.y0 + (29.5 - lat) * K * CAN.s)];
  return [r1((lon + 9.6) * C * K), r1((44.0 - lat) * K)];
}
const isCanary = ([lon, lat]) => lon < -12.5 && lat < 30.5;
const CANARY_BOX = [CAN.x0 - 8, CAN.y0 - 8, r1((18.25 - 13.3) * C * K * CAN.s + 16), r1((29.5 - 27.6) * K * CAN.s + 16)];
const VIEW = [-100, 5, 1190, 915];

/* ---------- Caminos SVG ---------- */
function ringPath(ring, canary) {
  const pts = ring.map(p => proj(p, canary));
  const clean = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  if (clean.length < 3) return '';
  return 'M' + clean.map(p => p[0] + ' ' + p[1]).join('L') + 'Z';
}
function geomPath(g, canaryAuto = true) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.map(rings => rings.map(r => ringPath(r, canaryAuto && isCanary(r[0]))).join('')).join('');
}
function bbox(d) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < nums.length; i += 2) { x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]); y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]); }
  return [r1(x0), r1(y0), r1(x1), r1(y1)];
}
/** Línea suavizada (Catmull-Rom → Bézier) por los puntos dados */
function smooth(pts, canary = false) {
  const p = pts.map(q => proj(q, canary));
  if (p.length < 3) return 'M' + p.map(q => q.join(' ')).join('L');
  let d = 'M' + p[0].join(' ');
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] ?? p[i], b = p[i], c = p[i + 1], e = p[i + 2] ?? c;
    const c1 = [r1(b[0] + (c[0] - a[0]) / 6), r1(b[1] + (c[1] - a[1]) / 6)], c2 = [r1(c[0] - (e[0] - b[0]) / 6), r1(c[1] - (e[1] - b[1]) / 6)];
    d += 'C' + c1.join(' ') + ' ' + c2.join(' ') + ' ' + c.join(' ');
  }
  return d;
}

/* ---------- Provincias y comunidades ---------- */
let es = require('es-atlas/es/provinces.json');
es = simp.presimplify(es);
es = simp.simplify(es, simp.quantile(es, 0.42));
const provGeoms = es.objects.provinces.geometries.filter(g => g.id !== '54');            // fuera Gibraltar
const ccaaGeoms = es.objects.autonomous_regions.geometries.filter(g => g.id !== '20');
const gib = es.objects.provinces.geometries.find(g => g.id === '54');
const PROV = {}, CCAA = {};
for (const g of provGeoms) PROV[g.id] = geomPath(topo.feature(es, g).geometry);
for (const g of ccaaGeoms) CCAA[g.id] = geomPath(topo.feature(es, g).geometry);
const neigh = (geoms) => {
  const n = topo.neighbors(geoms.map(g => g));
  return Object.fromEntries(geoms.map((g, i) => [g.id, n[i].map(j => geoms[j].id).sort()]));
};
const provNeighbors = neigh(provGeoms), ccaaNeighbors = neigh(ccaaGeoms);

/* ---------- Países vecinos (en gris) ---------- */
let w = require('world-atlas/countries-50m.json');
w = simp.presimplify(w);
w = simp.simplify(w, simp.quantile(w, 0.5));
const NEAR = ['Portugal', 'France', 'Andorra', 'Morocco', 'Algeria'];
const land = w.objects.countries.geometries.filter(g => NEAR.includes(g.properties.name)).map(g => geomPath(topo.feature(w, g).geometry, false)).join('')
  + geomPath(topo.feature(es, gib).geometry);

/* ---------- Ríos (de la fuente a la desembocadura) ---------- */
const RIVERS = {
  mino: [[-7.29, 43.21], [-7.56, 43.01], [-7.62, 42.81], [-7.71, 42.63], [-7.73, 42.45], [-7.87, 42.34], [-8.14, 42.29], [-8.50, 42.08], [-8.64, 42.05], [-8.87, 41.87]],
  duero: [[-2.88, 41.99], [-2.46, 41.77], [-2.53, 41.48], [-3.20, 41.58], [-3.69, 41.67], [-4.12, 41.60], [-5.00, 41.50], [-5.39, 41.52], [-5.75, 41.50],
          [-6.27, 41.50], [-6.93, 41.03], [-7.79, 41.16], [-8.61, 41.14], [-8.67, 41.14]],
  tajo: [[-1.65, 40.29], [-1.92, 40.48], [-2.59, 40.70], [-2.70, 40.50], [-3.60, 40.03], [-4.02, 39.86], [-4.83, 39.96], [-5.55, 39.80], [-6.88, 39.72],
         [-7.67, 39.65], [-8.20, 39.46], [-8.69, 39.24], [-9.15, 38.70], [-9.30, 38.68]],
  guadiana: [[-2.85, 38.95], [-3.53, 39.13], [-3.92, 39.05], [-4.50, 39.00], [-5.53, 39.00], [-6.34, 38.92], [-6.97, 38.88], [-7.20, 38.60], [-7.35, 38.38],
             [-7.66, 37.64], [-7.52, 37.55], [-7.41, 37.18]],
  guadalquivir: [[-2.95, 37.88], [-3.35, 37.95], [-3.80, 37.97], [-4.05, 38.04], [-4.38, 38.02], [-4.78, 37.88], [-5.28, 37.70], [-5.53, 37.66], [-5.99, 37.38],
                 [-6.06, 37.29], [-6.37, 36.79]],
  ebro: [[-4.20, 43.00], [-4.13, 42.99], [-3.95, 42.98], [-3.30, 42.76], [-2.95, 42.69], [-2.85, 42.58], [-2.44, 42.47], [-1.96, 42.31], [-1.60, 42.06],
         [-0.88, 41.66], [-0.50, 41.42], [-0.04, 41.24], [0.30, 41.37], [0.55, 41.23], [0.52, 40.81], [0.58, 40.71], [0.87, 40.72]],
  jucar: [[-1.85, 40.35], [-2.13, 40.07], [-2.08, 39.55], [-2.10, 39.25], [-1.67, 39.15], [-1.52, 39.17], [-1.06, 39.23], [-0.59, 39.14], [-0.43, 39.15],
          [-0.31, 39.20], [-0.24, 39.17]],
  segura: [[-2.66, 38.10], [-2.32, 38.32], [-1.70, 38.23], [-1.42, 38.24], [-1.30, 38.12], [-1.13, 37.98], [-0.94, 38.08], [-0.65, 38.10]],
  turia: [[-1.70, 40.40], [-1.44, 40.41], [-1.11, 40.34], [-1.19, 40.23], [-1.29, 40.06], [-0.88, 39.65], [-0.57, 39.55], [-0.32, 39.45]],
  genil: [[-3.37, 37.07], [-3.60, 37.17], [-4.15, 37.17], [-4.77, 37.39], [-5.08, 37.54], [-5.25, 37.70]]
};
/* ---------- Cordilleras y montañas (eje de cada una) ---------- */
const MOUNTS = {
  pirineos: [[-1.75, 43.30], [-1.25, 43.05], [-1.0, 42.95], [-0.6, 42.85], [0.0, 42.72], [0.66, 42.63], [1.55, 42.55], [2.12, 42.38], [3.2, 42.32]],
  cantabrica: [[-6.85, 42.85], [-6.25, 43.0], [-5.77, 43.0], [-4.85, 43.17], [-4.38, 43.03], [-3.80, 43.05], [-3.30, 43.10]],
  galaico: [[-7.9, 42.85], [-7.2, 42.62], [-6.8, 42.25], [-6.35, 42.37]],
  vascos: [[-3.2, 43.05], [-2.78, 43.03], [-2.33, 42.95], [-2.05, 42.97], [-1.75, 43.10]],
  iberico: [[-3.15, 42.25], [-2.88, 41.99], [-2.6, 42.0], [-1.84, 41.79], [-1.6, 41.45], [-1.7, 40.35], [-1.0, 40.10], [-0.67, 40.40], [-0.2, 40.6]],
  central: [[-6.7, 40.25], [-6.17, 40.51], [-5.75, 40.32], [-5.29, 40.25], [-4.6, 40.35], [-3.95, 40.85], [-3.58, 41.10], [-3.37, 41.2], [-2.85, 41.25]],
  toledo: [[-5.5, 39.45], [-5.3, 39.45], [-4.85, 39.40], [-4.47, 39.37], [-4.0, 39.45], [-3.6, 39.40]],
  morena: [[-7.2, 37.95], [-6.55, 37.90], [-6.0, 38.0], [-5.3, 38.15], [-4.6, 38.35], [-3.52, 38.38], [-2.9, 38.40]],
  beticas: [[-5.4, 36.75], [-5.1, 36.70], [-4.4, 36.95], [-3.31, 37.05], [-2.6, 37.30], [-1.9, 37.65], [-1.3, 38.20], [-0.5, 38.55], [0.20, 38.73]],
  costero: [[1.0, 41.3], [1.8, 41.55], [2.43, 41.77], [2.95, 41.95]],
  tramuntana: [[2.38, 39.55], [2.75, 39.75], [2.79, 39.81], [3.05, 39.90], [3.2, 39.96]]
};
/* ---------- Puntos: picos y ciudades (longitud, latitud) ---------- */
const PEAKS = {
  aneto: [0.656, 42.631], perdido: [0.034, 42.675], mulhacen: [-3.311, 37.053], veleta: [-3.366, 37.057], almanzor: [-5.296, 40.247],
  moncayo: [-1.839, 41.787], cerredo: [-4.852, 43.198], penalara: [-3.955, 40.850], teide: [-16.642, 28.272], puigmajor: [2.79, 39.807],
  turo: [2.44, 41.77], banuela: [-4.20, 38.39], rocigalgo: [-4.47, 39.38], gorbea: [-2.78, 43.03], trevinca: [-6.79, 42.24], urbion: [-2.88, 41.99]
};
const CITIES = {
  'a-coruna': [-8.40, 43.37], lugo: [-7.56, 43.01], ourense: [-7.86, 42.34], pontevedra: [-8.65, 42.43], oviedo: [-5.85, 43.36], santander: [-3.80, 43.46],
  bilbao: [-2.93, 43.26], 'san-sebastian': [-1.98, 43.32], vitoria: [-2.67, 42.85], pamplona: [-1.64, 42.81], logrono: [-2.45, 42.47], huesca: [-0.41, 42.14],
  zaragoza: [-0.89, 41.65], teruel: [-1.11, 40.34], lleida: [0.62, 41.62], girona: [2.82, 41.98], barcelona: [2.17, 41.39], tarragona: [1.25, 41.12],
  castellon: [-0.05, 39.99], valencia: [-0.38, 39.47], alicante: [-0.48, 38.35], murcia: [-1.13, 37.99], albacete: [-1.86, 38.99], cuenca: [-2.13, 40.07],
  guadalajara: [-3.17, 40.63], toledo: [-4.03, 39.86], 'ciudad-real': [-3.93, 38.99], madrid: [-3.70, 40.42], leon: [-5.57, 42.60], palencia: [-4.53, 42.01],
  burgos: [-3.70, 42.34], soria: [-2.46, 41.76], segovia: [-4.12, 40.95], avila: [-4.70, 40.66], salamanca: [-5.66, 40.96], zamora: [-5.75, 41.50],
  valladolid: [-4.72, 41.65], caceres: [-6.37, 39.47], badajoz: [-6.97, 38.88], huelva: [-6.95, 37.26], sevilla: [-5.98, 37.39], cadiz: [-6.29, 36.53],
  cordoba: [-4.78, 37.88], jaen: [-3.79, 37.77], granada: [-3.60, 37.18], malaga: [-4.42, 36.72], almeria: [-2.46, 36.84], palma: [2.65, 39.57],
  'las-palmas': [-15.43, 28.12], 'santa-cruz': [-16.25, 28.46], ceuta: [-5.32, 35.89], melilla: [-2.94, 35.29],
  // ciudades de río que no son capital
  tortosa: [0.52, 40.81], tudela: [-1.61, 42.06], aranjuez: [-3.60, 40.03], talavera: [-4.83, 39.96], tordesillas: [-5.00, 41.50], aranda: [-3.69, 41.67],
  merida: [-6.34, 38.92], orihuela: [-0.94, 38.08], loja: [-4.15, 37.17], ecija: [-5.08, 37.54], tui: [-8.64, 42.05], alzira: [-0.43, 39.15], andujar: [-4.05, 38.04]
};

/* ---------- Comprobación: cada provincia cae en su comunidad (por su punto medio) ---------- */
const sz = d => { const b = bbox(d); return [b, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
const fmt = o => JSON.stringify(o);
const MID = Object.fromEntries(Object.entries({ ...PROV }).map(([k, d]) => [k, sz(d)[0]]));
const CMID = Object.fromEntries(Object.entries(CCAA).map(([k, d]) => [k, sz(d)[0]]));
const P = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, proj(v, isCanary(v))]));
const map = {
  view: VIEW, canaryBox: CANARY_BOX, land, prov: PROV, ccaa: CCAA, provBox: MID, ccaaBox: CMID,
  rivers: Object.fromEntries(Object.entries(RIVERS).map(([k, v]) => [k, smooth(v)])),
  mounts: Object.fromEntries(Object.entries(MOUNTS).map(([k, v]) => [k, smooth(v)])),
  peaks: P(PEAKS), cities: P(CITIES)
};
const head = '/* Generado por scripts/build-geo.mjs a partir de es-atlas (IGN, MIT) y world-atlas (Natural Earth). No editar a mano. */\n';
fs.writeFileSync(path.join(out, 'map-data.ts'), head + 'export const MAP = ' + fmt(map) + ' as const;\nexport type MapData = typeof MAP;\n');
fs.writeFileSync(path.join(out, 'neighbors.ts'), head +
  'export const PROV_NEIGHBORS: Record<string, string[]> = ' + fmt(provNeighbors) + ';\n' +
  'export const CCAA_NEIGHBORS: Record<string, string[]> = ' + fmt(ccaaNeighbors) + ';\n');
const kb = f => (fs.statSync(path.join(out, f)).size / 1024).toFixed(1) + ' KB';
console.log('map-data.ts', kb('map-data.ts'), '· neighbors.ts', kb('neighbors.ts'));
