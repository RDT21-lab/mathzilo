/* Genera el relieve sombreado de España para las preguntas de montañas y ríos (se ejecuta a mano:
   `npm run relief`). Elevación: Terrain Tiles de AWS (formato «terrarium», zoom 7; fuentes SRTM,
   GMTED y otras, ver https://github.com/tilezen/joerd/blob/master/docs/attribution.md).
   Misma proyección que scripts/build-geo.mjs (Canarias en su recuadro). Escribe src/geo/relief.jpg.
   Uso: node scripts/build-relief.mjs [carpeta de teselas]  (si faltan, las descarga)            */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const tileDir = process.argv[2] ?? path.join(here, '.tiles');
const out = path.resolve(here, '..', 'src', 'geo', 'relief.jpg');

/* Proyección (igual que build-geo.mjs) */
const K = 100, C = Math.cos(40 * Math.PI / 180), CAN = { s: 0.85, x0: -90, y0: 742 };
const CANARY_BOX = [CAN.x0 - 8, CAN.y0 - 8, Math.round((18.25 - 13.3) * C * K * CAN.s + 16), Math.round((29.5 - 27.6) * K * CAN.s + 16)];
const VIEW = [-100, 5, 1190, 915];
const PX = 0.75;                                                   // píxeles por unidad del mapa (1 unidad ≈ 1 km)
function unproj(x, y) {
  const b = CANARY_BOX;
  if (x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]) return [(x - CAN.x0) / (C * K * CAN.s) - 18.25, 29.5 - (y - CAN.y0) / (K * CAN.s)];
  return [x / (C * K) - 9.6, 44.0 - y / K];
}

/* Elevación de las teselas (Web Mercator, zoom 7) */
const Z = 7, N = 256 * 2 ** Z, tiles = new Map();
async function tile(tx, ty) {
  const key = tx + '_' + ty;
  if (tiles.has(key)) return tiles.get(key);
  const f = path.join(tileDir, `${Z}_${tx}_${ty}.png`);
  if (!fs.existsSync(f)) {
    fs.mkdirSync(tileDir, { recursive: true });
    const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`);
    if (!r.ok) throw new Error('tesela ' + key + ': ' + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const png = PNG.sync.read(fs.readFileSync(f));
  tiles.set(key, png);
  return png;
}
async function elevAt(lon, lat) {
  const X = (lon + 180) / 360 * N, s = Math.sin(lat * Math.PI / 180);
  const Y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * N;
  const sample = async (px, py) => {
    const t = await tile(Math.floor(px / 256), Math.floor(py / 256)), i = ((Math.floor(py) % 256) * 256 + (Math.floor(px) % 256)) * 4;
    return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
  };
  const x0 = Math.floor(X - 0.5), y0 = Math.floor(Y - 0.5), fx = X - 0.5 - x0, fy = Y - 0.5 - y0;
  const [a, b, c, d] = await Promise.all([sample(x0, y0), sample(x0 + 1, y0), sample(x0, y0 + 1), sample(x0 + 1, y0 + 1)]);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/* Colores por altitud (tonos de la app: azul noche abajo, arena y nieve arriba) */
const RAMP = [[-1, [11, 26, 68]], [0, [56, 88, 158]], [400, [68, 100, 162]], [800, [100, 116, 156]], [1300, [146, 134, 128]], [1900, [190, 160, 118]], [2600, [226, 210, 174]], [3300, [250, 246, 238]]];
function color(e) {
  if (e <= 0) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) if (e <= RAMP[i][0]) {
    const [e0, c0] = RAMP[i - 1], [e1, c1] = RAMP[i], f = (e - e0) / (e1 - e0);
    return c0.map((v, k) => v + (c1[k] - v) * f);
  }
  return RAMP[RAMP.length - 1][1];
}

const W = Math.round(VIEW[2] * PX), H = Math.round(VIEW[3] * PX);
const elev = new Float32Array(W * H);
for (let j = 0; j < H; j++) {
  const row = [];
  for (let i = 0; i < W; i++) {
    const [lon, lat] = unproj(VIEW[0] + (i + 0.5) / PX, VIEW[1] + (j + 0.5) / PX);
    row.push(elevAt(lon, lat).then(e => { elev[j * W + i] = e; }));
  }
  await Promise.all(row);
}
/* Sombreado: luz del noroeste, relieve exagerado ×3 para que se vea en una tablet */
const cell = 1000 / PX, zf = 3, az = 315 * Math.PI / 180, alt = 45 * Math.PI / 180;
const at = (i, j) => elev[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
const img = Buffer.alloc(W * H * 4);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const e = at(i, j);
  const dzdx = ((at(i + 1, j - 1) + 2 * at(i + 1, j) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i - 1, j) + at(i - 1, j + 1))) / (8 * cell);
  const dzdy = ((at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1)) - (at(i - 1, j - 1) + 2 * at(i, j - 1) + at(i + 1, j - 1))) / (8 * cell);
  const slope = Math.atan(zf * Math.hypot(dzdx, dzdy)), aspect = Math.atan2(dzdy, -dzdx);
  let shade = Math.cos(alt) * Math.cos(slope) + Math.sin(alt) * Math.sin(slope) * Math.cos(az - Math.PI / 2 - aspect);
  shade = e <= 0 ? 1 : 0.6 + 0.7 * Math.max(0, shade);
  const c = color(e), k = (j * W + i) * 4;
  img[k] = Math.min(255, c[0] * shade); img[k + 1] = Math.min(255, c[1] * shade); img[k + 2] = Math.min(255, c[2] * shade); img[k + 3] = 255;
}
fs.writeFileSync(out, jpeg.encode({ data: img, width: W, height: H }, 72).data);
console.log('relief.jpg', W + '×' + H, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
