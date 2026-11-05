/* Mapa de España para las preguntas de geografía. Se carga aparte (solo al hacer un test de geografía).
   - Lo que se pregunta se ilumina en dorado; lo que eligió el niño (en la explicación), con borde coral.
   - Los ríos y las cordilleras se ven tenues solo en sus preguntas, para no liar las demás.
   - Lo muy pequeño (Ceuta, Melilla, un pico, una ciudad) lleva además un aro alrededor.       */
import type { GeoRef } from '../engine';
import { MAP } from './map-data';

const GOLD = '#FFC933', CORAL = '#FF8A5B', SEA = '#0B1A44', LAND = '#1E2C5C', PROV = '#2B4697', PROV_LINE = '#4A63B5', CCAA_LINE = '#B8C4EE', NAVY = '#0A1230';
type Box = readonly [number, number, number, number];
const get = <T,>(o: Record<string, T>, k: string): T | undefined => o[k];

function centerOf(r: GeoRef): [number, number] | null {
  const b = r.t === 'prov' ? get<Box>(MAP.provBox, r.id) : r.t === 'ccaa' ? get<Box>(MAP.ccaaBox, r.id) : undefined;
  if (b) return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const p = r.t === 'city' ? get(MAP.cities, r.id) : r.t === 'peak' || (r.t === 'mount' && r.id === 'teide') ? get(MAP.peaks, r.id) : undefined;
  return p ? [p[0], p[1]] : null;
}
/** ¿Es tan pequeño que hace falta un aro para verlo? */
function tiny(r: GeoRef): boolean {
  const b = r.t === 'prov' ? get<Box>(MAP.provBox, r.id) : r.t === 'ccaa' ? get<Box>(MAP.ccaaBox, r.id) : undefined;
  return b ? Math.max(b[2] - b[0], b[3] - b[1]) < 30 : r.t === 'mount' && r.id === 'teide';
}
const shape = (r: GeoRef) => r.t === 'prov' ? get(MAP.prov, r.id) : r.t === 'ccaa' ? get(MAP.ccaa, r.id) : undefined;
const line = (r: GeoRef) => r.t === 'river' ? get(MAP.rivers, r.id) : r.t === 'mount' ? get(MAP.mounts, r.id) : undefined;

function Peak({ x, y, s = 1, fill = GOLD }: { x: number; y: number; s?: number; fill?: string }) {
  return <path d={`M${x} ${y - 13 * s}L${x + 11 * s} ${y + 7 * s}L${x - 11 * s} ${y + 7 * s}Z`} fill={fill} stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />;
}

export default function MapView({ hi, alt, dot, label, compact }: { hi: GeoRef[]; alt?: GeoRef; dot?: GeoRef; label: string; compact?: boolean }) {
  const v = MAP.view;
  const showRivers = hi.some(r => r.t === 'river') || alt?.t === 'river';
  const showMounts = hi.some(r => r.t === 'mount') || alt?.t === 'mount' || dot?.t === 'peak';
  const ccaaHi = hi.filter(r => r.t === 'ccaa'), provHi = hi.filter(r => r.t === 'prov');
  // con comunidad y provincia a la vez, la comunidad va en dorado suave y la provincia en dorado pleno
  const soft = ccaaHi.length > 0 && provHi.length > 0;
  const rings = [...hi, ...(dot ? [dot] : [])].filter(r => tiny(r) || r.t === 'city' || r.t === 'peak');
  const cb = MAP.canaryBox;
  return (
    <svg className={'geomap' + (compact ? ' sm' : '')} viewBox={v.join(' ')} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <rect x={v[0]} y={v[1]} width={v[2]} height={v[3]} rx={18} fill={SEA} />
      <path d={MAP.land} fill={LAND} />
      <rect x={cb[0]} y={cb[1]} width={cb[2]} height={cb[3]} rx={10} fill={SEA} stroke={CCAA_LINE} strokeOpacity={0.5} strokeWidth={2} />
      {Object.entries(MAP.prov).map(([id, d]) => <path key={id} d={d} fill={PROV} stroke={PROV_LINE} strokeWidth={1} />)}
      {ccaaHi.map(r => <path key={'c' + r.id} d={shape(r)} fill={GOLD} fillOpacity={soft ? 0.45 : 1} />)}
      {provHi.map(r => <path key={'p' + r.id} d={shape(r)} fill={GOLD} stroke={NAVY} strokeWidth={1.5} />)}
      {Object.entries(MAP.ccaa).map(([id, d]) => <path key={id} d={d} fill="none" stroke={CCAA_LINE} strokeOpacity={0.75} strokeWidth={2} />)}
      {alt && shape(alt) && <path d={shape(alt)} fill={CORAL} fillOpacity={0.25} stroke={CORAL} strokeWidth={5} strokeDasharray="10 6" />}
      {showMounts && Object.entries(MAP.mounts).map(([id, d]) => <path key={id} d={d} fill="none" stroke="#B98A5E" strokeOpacity={0.45} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />)}
      {showRivers && Object.entries(MAP.rivers).map(([id, d]) => <path key={id} d={d} fill="none" stroke="#6CC6F5" strokeOpacity={0.55} strokeWidth={3.5} strokeLinecap="round" />)}
      {alt && line(alt) && <path d={line(alt)} fill="none" stroke={CORAL} strokeWidth={alt.t === 'mount' ? 20 : 8} strokeOpacity={0.85} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={alt.t === 'mount' ? undefined : '14 8'} />}
      {hi.filter(r => line(r)).map(r => r.t === 'mount'
        ? <path key={'m' + r.id} d={line(r)} fill="none" stroke={GOLD} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
        : <g key={'r' + r.id}><path d={line(r)} fill="none" stroke={NAVY} strokeWidth={12} strokeLinecap="round" /><path d={line(r)} fill="none" stroke={GOLD} strokeWidth={7} strokeLinecap="round" /></g>)}
      {hi.some(r => r.t === 'mount' && r.id === 'teide') && (() => { const p = MAP.peaks.teide; return <Peak x={p[0]} y={p[1]} s={1.8} />; })()}
      {rings.map((r, i) => { const c = centerOf(r); return c && <circle key={'ring' + i} cx={c[0]} cy={c[1]} r={r.t === 'city' || r.t === 'peak' ? 24 : 30} fill="none" stroke={GOLD} strokeWidth={4} className="geopulse" />; })}
      {dot?.t === 'city' && (() => { const c = centerOf(dot); return c && <circle cx={c[0]} cy={c[1]} r={11} fill={GOLD} stroke={NAVY} strokeWidth={4} />; })()}
      {dot?.t === 'peak' && (() => { const c = centerOf(dot); return c && <Peak x={c[0]} y={c[1]} s={1.4} />; })()}
    </svg>
  );
}
