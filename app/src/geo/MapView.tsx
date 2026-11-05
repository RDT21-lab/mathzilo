/* Mapa de España para las preguntas de geografía. Se carga aparte (solo al hacer un test de geografía).
   Cada pregunta pide sus capas y solo se dibujan esas:
   - «ccaa»: solo la división en comunidades autónomas;  «prov»: solo la división en provincias;
   - «caps»: un punto en cada capital de provincia;
   - «river»: los ríos sobre el relieve;  «mount»: el relieve con símbolos de montaña en cada cordillera.
   Lo que se pregunta se ilumina en dorado y el resto se apaga (en ríos y montañas, con un foco).
   Lo que eligió el niño (en la explicación) va en coral.                                          */
import { useId } from 'react';
import type { GeoRef, MapLayer } from '../engine';
import { PROVS } from './places';
import { MAP } from './map-data';
import reliefUrl from './relief.jpg';

const GOLD = '#FFC933', CORAL = '#FF8A5B', SEA = '#0B1A44', LAND = '#1B2856', PROV = '#2B4697', LINE = '#6F86D0', CCAA_LINE = '#C9D3F5',
  NAVY = '#0A1230', RIVER = '#7FD3FF', BONE = '#F7F7FA', ROCK = '#C9B79A';
type Box = readonly [number, number, number, number];
const get = <T,>(o: Record<string, T>, k: string): T | undefined => o[k];
const CAPITALS = PROVS.map(p => p.capital);

function centerOf(r: GeoRef): [number, number] | null {
  const b = r.t === 'prov' ? get<Box>(MAP.provBox, r.id) : r.t === 'ccaa' ? get<Box>(MAP.ccaaBox, r.id) : undefined;
  if (b) return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const p = r.t === 'city' ? get(MAP.cities, r.id) : r.t === 'peak' || (r.t === 'mount' && r.id === 'teide') ? get(MAP.peaks, r.id) : undefined;
  return p ? [p[0], p[1]] : null;
}
/** ¿Es tan pequeño que hace falta un aro para verlo? (Ceuta, Melilla, el Teide) */
function tiny(r: GeoRef): boolean {
  const b = r.t === 'prov' ? get<Box>(MAP.provBox, r.id) : r.t === 'ccaa' ? get<Box>(MAP.ccaaBox, r.id) : undefined;
  return b ? Math.max(b[2] - b[0], b[3] - b[1]) < 30 : r.t === 'mount' && r.id === 'teide';
}
const shape = (r: GeoRef) => r.t === 'prov' ? get(MAP.prov, r.id) : r.t === 'ccaa' ? get(MAP.ccaa, r.id) : undefined;
const riverD = (id: string) => get(MAP.rivers, id);
const mountAxis = (id: string) => get(MAP.mounts, id);
const icons = (id: string): readonly (readonly [number, number])[] => id === 'teide' ? [MAP.peaks.teide] : get(MAP.mountIcons, id) ?? [];

/** Símbolo de montaña: dos picos con nieve */
function Mountain({ x, y, s, fill, snow, stroke }: { x: number; y: number; s: number; fill: string; snow: string; stroke: string }) {
  const p = (dx: number, dy: number) => `${x + dx * s} ${y + dy * s}`;
  return (
    <g>
      <path d={`M${p(-10, 6)}L${p(-3, -7)}L${p(0, -2)}L${p(4, -9)}L${p(12, 6)}Z`} fill={fill} stroke={stroke} strokeWidth={1.6 * s} strokeLinejoin="round" />
      <path d={`M${p(1.6, -5.3)}L${p(4, -9)}L${p(6.6, -4.9)}L${p(5, -5.6)}L${p(3.8, -4.4)}L${p(2.6, -5.8)}Z`} fill={snow} />
      <path d={`M${p(-5.4, -3.3)}L${p(-3, -7)}L${p(-1.3, -4.4)}L${p(-2.6, -4.8)}L${p(-3.6, -3.6)}Z`} fill={snow} />
    </g>
  );
}

export default function MapView({ layers, hi, alt, dot, label, compact }: { layers: MapLayer[]; hi: GeoRef[]; alt?: GeoRef; dot?: GeoRef; label: string; compact?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const v = MAP.view, cb = MAP.canaryBox;
  const L = new Set(layers);
  const relief = L.has('mount') || (L.has('river') && !L.has('ccaa'));
  const ccaaHi = hi.filter(r => r.t === 'ccaa'), provHi = hi.filter(r => r.t === 'prov');
  const riverHi = hi.filter(r => r.t === 'river').map(r => r.id), mountHi = hi.filter(r => r.t === 'mount').map(r => r.id);
  const soft = ccaaHi.length > 0 && provHi.length > 0;          // comunidad en dorado suave y provincia en dorado pleno
  // foco: en ríos y montañas se oscurece todo menos lo preguntado
  const spot = relief && (riverHi.length > 0 || mountHi.length > 0);
  const rings = [...hi, ...(dot ? [dot] : [])].filter(r => tiny(r));
  const shown = (id: string, list: string[]) => list.length === 0 || list.includes(id);
  return (
    <svg className={'geomap' + (compact ? ' sm' : '')} viewBox={v.join(' ')} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* el difuminado cubre todo el mapa: si no, el foco sale con bordes rectos */}
        <filter id={'blur' + uid} filterUnits="userSpaceOnUse" x={v[0]} y={v[1]} width={v[2]} height={v[3]}><feGaussianBlur stdDeviation={14} /></filter>
        <filter id={'glow' + uid} filterUnits="userSpaceOnUse" x={v[0]} y={v[1]} width={v[2]} height={v[3]}><feGaussianBlur stdDeviation={5} /></filter>
        <clipPath id={'land' + uid}>{Object.entries(MAP.ccaa).map(([id, d]) => <path key={id} d={d} />)}</clipPath>
        {spot && (
          <mask id={'spot' + uid}>
            <rect x={v[0]} y={v[1]} width={v[2]} height={v[3]} fill="white" />
            {riverHi.map(id => <path key={id} d={riverD(id)} fill="none" stroke="black" strokeWidth={70} strokeLinecap="round" strokeLinejoin="round" filter={`url(#blur${uid})`} />)}
            {mountHi.map(id => id === 'teide'
              ? <circle key={id} cx={MAP.peaks.teide[0]} cy={MAP.peaks.teide[1]} r={45} fill="black" filter={`url(#blur${uid})`} />
              : <path key={id} d={mountAxis(id)} fill="none" stroke="black" strokeWidth={95} strokeLinecap="round" strokeLinejoin="round" filter={`url(#blur${uid})`} />)}
          </mask>
        )}
      </defs>
      <rect x={v[0]} y={v[1]} width={v[2]} height={v[3]} rx={18} fill={SEA} />
      {relief ? (
        <>
          <image href={reliefUrl} x={v[0]} y={v[1]} width={v[2]} height={v[3]} preserveAspectRatio="none" />
          {/* los países vecinos y el mar, apagados: solo destaca España */}
          <path d={MAP.land} fill={NAVY} fillOpacity={0.55} />
          <path d={MAP.outline} fill="none" stroke={CCAA_LINE} strokeOpacity={0.7} strokeWidth={1.6} />
        </>
      ) : (
        <>
          <path d={MAP.land} fill={LAND} />
          <g clipPath={`url(#land${uid})`}><rect x={v[0]} y={v[1]} width={v[2]} height={v[3]} fill={PROV} /></g>
        </>
      )}
      <rect x={cb[0]} y={cb[1]} width={cb[2]} height={cb[3]} rx={10} fill="none" stroke={CCAA_LINE} strokeOpacity={0.5} strokeWidth={2} />

      {/* foco en ríos y montañas: se apaga todo menos lo preguntado */}
      {spot && <rect x={v[0]} y={v[1]} width={v[2]} height={v[3]} fill="#050B22" fillOpacity={0.5} mask={`url(#spot${uid})`} />}

      {/* lo iluminado: comunidades y provincias */}
      {ccaaHi.map(r => <path key={'c' + r.id} d={shape(r)} fill={GOLD} fillOpacity={soft ? 0.5 : relief ? 0.55 : 1} />)}
      {provHi.map(r => <path key={'p' + r.id} d={shape(r)} fill={GOLD} />)}
      {alt && shape(alt) && <path d={shape(alt)} fill={CORAL} fillOpacity={0.3} />}

      {/* divisiones: solo la que pide la pregunta */}
      {L.has('prov') && Object.entries(MAP.prov).map(([id, d]) => <path key={'lp' + id} d={d} fill="none" stroke={LINE} strokeWidth={1.3} />)}
      {L.has('ccaa') && Object.entries(MAP.ccaa).map(([id, d]) => <path key={'lc' + id} d={d} fill="none" stroke={CCAA_LINE} strokeWidth={2.4} />)}
      {provHi.map(r => <path key={'po' + r.id} d={shape(r)} fill="none" stroke={NAVY} strokeWidth={2} />)}
      {alt && shape(alt) && <path d={shape(alt)} fill="none" stroke={CORAL} strokeWidth={5} strokeDasharray="10 6" />}


      {/* montañas: banda dorada difusa y símbolos (las demás, en gris) */}
      {L.has('mount') && (
        <>
          {mountHi.filter(id => id !== 'teide').map(id => <path key={'mb' + id} d={mountAxis(id)} fill="none" stroke={GOLD} strokeOpacity={0.55} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow${uid})`} />)}
          {alt?.t === 'mount' && alt.id !== 'teide' && <path d={mountAxis(alt.id)} fill="none" stroke={CORAL} strokeOpacity={0.55} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow${uid})`} />}
          {Object.keys(MAP.mountIcons).concat('teide').map(id => {
            const on = mountHi.includes(id), chosen = alt?.t === 'mount' && alt.id === id;
            if (!on && !chosen && mountHi.length && compact) return null;
            return icons(id).map(([x, y], i) => <Mountain key={id + i} x={x} y={y} s={on ? 2.2 : chosen ? 1.8 : 1.5}
              fill={on ? GOLD : chosen ? CORAL : ROCK} snow={on ? BONE : chosen ? BONE : '#EDE6D8'} stroke={NAVY} />);
          })}
        </>
      )}

      {/* ríos: todos en azul; el preguntado, dorado con contorno */}
      {L.has('river') && (
        <>
          {Object.entries(MAP.rivers).map(([id, d]) => <path key={'r' + id} d={d} fill="none" stroke={RIVER} strokeOpacity={shown(id, riverHi) ? 0.95 : 0.5}
            strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />)}
          {alt?.t === 'river' && <path d={riverD(alt.id)} fill="none" stroke={CORAL} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="14 8" />}
          {riverHi.map(id => (
            <g key={'rh' + id}>
              <path d={riverD(id)} fill="none" stroke={GOLD} strokeOpacity={0.5} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow${uid})`} />
              <path d={riverD(id)} fill="none" stroke={NAVY} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
              <path d={riverD(id)} fill="none" stroke={GOLD} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
        </>
      )}

      {/* capitales de provincia: un punto en cada una */}
      {L.has('caps') && CAPITALS.map(c => { const p = get(MAP.cities, c); return p && <circle key={'cap' + c} cx={p[0]} cy={p[1]} r={7} fill={BONE} stroke={NAVY} strokeWidth={2} />; })}

      {rings.map((r, i) => { const c = centerOf(r); return c && <circle key={'ring' + i} cx={c[0]} cy={c[1]} r={30} fill="none" stroke={GOLD} strokeWidth={4} className="geopulse" />; })}
      {dot?.t === 'city' && (() => { const c = centerOf(dot); return c && <g><circle cx={c[0]} cy={c[1]} r={22} fill="none" stroke={GOLD} strokeWidth={4} className="geopulse" /><circle cx={c[0]} cy={c[1]} r={10} fill={GOLD} stroke={NAVY} strokeWidth={4} /></g>; })()}
      {dot?.t === 'peak' && (() => { const c = centerOf(dot); return c && <g><circle cx={c[0]} cy={c[1] - 2} r={26} fill="none" stroke={GOLD} strokeWidth={4} className="geopulse" /><Mountain x={c[0]} y={c[1]} s={1.9} fill={GOLD} snow={BONE} stroke={NAVY} /></g>; })()}
    </svg>
  );
}
