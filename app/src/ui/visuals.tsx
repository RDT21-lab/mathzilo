/* Apoyos visuales de preguntas y explicaciones. Formas planas, sin degradados. */
import type { Visual, Val } from '../engine';
import { ValView, fmtNum, fmtDec, rawRes, valText } from '../i18n';

const GOLD = '#FFC933', LAV = '#9AA8FF', NAVY = '#0A1230', LINE = '#2A4390', BONE = '#F7F7FA', MUTED = '#A9B6E0', CARD = '#1B3680';

export function VisualView({ v, size = 'md' }: { v?: Visual; size?: 'sm' | 'md' }) {
  if (!v) return null;
  const sc = size === 'sm' ? 0.78 : 1;
  switch (v.type) {
    case 'frame': {
      const cells = Array.from({ length: 20 }, (_, i) => (i < v.a ? 'a' : i < v.a + v.b ? 'b' : ''));
      return <div className="frames" aria-hidden="true">{[0, 1].map(f => <div className="frame" key={f}>{cells.slice(f * 10, f * 10 + 10).map((c, i) => <i key={i} className={'fd ' + c} />)}</div>)}</div>;
    }
    case 'chips':
      return <div className="chips" aria-hidden="true">{v.items.map((n, i) => <span key={i} className={'chipn' + (i === v.hi ? ' hi' : '')}><ValView v={n} /></span>)}</div>;
    case 'columns': return <Columns op={v.op} a={v.a} b={v.b} ans={v.ans} />;
    case 'mulcols': return <MulCols a={v.a} b={v.b} />;
    case 'clock': return <Clock h={v.h} m={v.m} size={170 * sc} />;
    case 'pie': return <Pie n={v.n} d={v.d} size={130 * sc} />;
    case 'pies': return <div className="pies"><Pie n={v.a[0]} d={v.a[1]} size={110 * sc} label /><Pie n={v.b[0]} d={v.b[1]} size={110 * sc} label /></div>;
    case 'rect': return <Rect w={v.w} h={v.h} unit={v.unit} grid={v.show === 'grid'} scale={sc} />;
    case 'tri': return <Tri a={v.a} b={v.b} c={v.c} unit={v.unit} scale={sc} />;
    case 'trih': return <TriH b={v.b} h={v.h} unit={v.unit} scale={sc} />;
    case 'box': return <Box w={v.w} h={v.h} d={v.d} unit={v.unit} scale={sc} />;
    case 'coins': return <Coins coins={v.coins} />;
    case 'line': return <NumLine from={v.from} to={v.to} marks={v.marks} hi={v.hi} />;
    case 'place': return <Place n={v.n} />;
    case 'decs': return <Decs a={v.a} b={v.b} op={v.op} ans={v.ans} />;
    case 'bars': return <Bars values={v.values} />;
  }
}

function Columns({ op, a, b, ans }: { op: '+' | '-'; a: number; b: number; ans: number }) {
  const at = Math.floor(a / 10), au = a % 10, bt = Math.floor(b / 10), bu = b % 10, rt = Math.floor(ans / 10), ru = ans % 10;
  const carry = op === '+' && au + bu >= 10, borrow = op === '-' && au < bu;
  return (
    <div className="cols" aria-hidden="true">
      <span /><span className="cy">{carry ? '1' : borrow ? fmtNum(at - 1) : ''}</span><span className="cy">{borrow ? '+10' : ''}</span>
      <span /><span>{borrow ? <s>{at}</s> : at}</span><span>{borrow && <small>1</small>}{au}</span>
      <span>{op === '+' ? '+' : '−'}</span><span>{bt || ''}</span><span>{bu}</span>
      <i className="rule" /><span /><span className="rs">{rt || ''}</span><span className="rs">{ru}</span>
    </div>
  );
}
function MulCols({ a, b }: { a: number; b: number }) {
  const mul = (rawRes('sym.mul') as string) || '×';
  const bu = b % 10, bt = Math.floor(b / 10);
  const rows: [string, string, string?][] = [['', fmtNum(a)], [mul, fmtNum(b)]];
  if (bt) rows.push(['', fmtNum(a * bu), 'p'], ['+', fmtNum(a * bt * 10), 'p']);
  else rows.push(['', fmtNum((a % 10) * b), 'p'], ['+', fmtNum(Math.floor(a / 10) * 10 * b), 'p']);
  return (
    <div className="calc" aria-hidden="true">
      {rows.map((r, i) => <div key={i} className={r[2] === 'p' ? 'part' : ''}><span>{r[0]}</span><span>{r[1]}</span></div>)}
      <i className="rule" /><div className="rs"><span /><span>{fmtNum(a * b)}</span></div>
    </div>
  );
}
function Clock({ h, m, size }: { h: number; m: number; size: number }) {
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
  const hand = (ang: number, len: number, w: number, c: string) => {
    const r = (ang - 90) * Math.PI / 180;
    return <line x1="100" y1="100" x2={100 + len * Math.cos(r)} y2={100 + len * Math.sin(r)} stroke={c} strokeWidth={w} strokeLinecap="round" />;
  };
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="clock">
      <circle cx="100" cy="100" r="94" fill={BONE} />
      <circle cx="100" cy="100" r="94" fill="none" stroke={GOLD} strokeWidth="6" />
      {Array.from({ length: 12 }, (_, i) => {
        const r = ((i + 1) * 30 - 90) * Math.PI / 180;
        return <text key={i} x={100 + 72 * Math.cos(r)} y={100 + 72 * Math.sin(r) + 8} textAnchor="middle" fontSize="22" fontWeight="700" fill={NAVY} fontFamily="Lexend, system-ui">{i + 1}</text>;
      })}
      {hand(ma, 74, 5, '#3A93E0')}
      {hand(ha, 46, 9, NAVY)}
      <circle cx="100" cy="100" r="7" fill={GOLD} />
    </svg>
  );
}
export function Pie({ n, d, size, label }: { n: number; d: number; size: number; label?: boolean }) {
  const r = 90, parts = [];
  for (let i = 0; i < d; i++) {
    const a0 = (i / d) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
    const x0 = 100 + r * Math.cos(a0), y0 = 100 + r * Math.sin(a0), x1 = 100 + r * Math.cos(a1), y1 = 100 + r * Math.sin(a1);
    const path = d === 1 ? '' : `M100 100L${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${1 / d > 0.5 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z`;
    parts.push(<path key={i} d={path} fill={i < n ? GOLD : CARD} stroke={NAVY} strokeWidth="4" />);
  }
  return (
    <span className="pie">
      <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">{d === 1 ? <circle cx="100" cy="100" r={r} fill={n ? GOLD : CARD} /> : parts}</svg>
      {label && <ValView v={{ k: 'frac', n, d }} />}
    </span>
  );
}
function dimLabel(v: number, unit: string) { return fmtNum(v) + ' ' + unit; }
function Rect({ w, h, unit, grid, scale }: { w: number; h: number; unit: string; grid: boolean; scale: number }) {
  const k = Math.min(260 / w, 150 / h) * scale, W = w * k, H = h * k;
  return (
    <svg width={W + 110} height={H + 60} viewBox={`-76 -40 ${W + 110} ${H + 60}`} aria-hidden="true">
      <rect x="0" y="0" width={W} height={H} fill={CARD} stroke={GOLD} strokeWidth="4" />
      {grid && Array.from({ length: w - 1 }, (_, i) => <line key={'v' + i} x1={(i + 1) * k} y1="0" x2={(i + 1) * k} y2={H} stroke={LINE} strokeWidth="2" />)}
      {grid && Array.from({ length: h - 1 }, (_, i) => <line key={'h' + i} x1="0" y1={(i + 1) * k} x2={W} y2={(i + 1) * k} stroke={LINE} strokeWidth="2" />)}
      <text x={W / 2} y="-12" textAnchor="middle" fill={BONE} fontSize="20" fontWeight="700" fontFamily="Lexend, system-ui">{dimLabel(w, unit)}</text>
      <text x="-12" y={H / 2 + 7} textAnchor="end" fill={BONE} fontSize="20" fontWeight="700" fontFamily="Lexend, system-ui">{dimLabel(h, unit)}</text>
    </svg>
  );
}
function Tri({ a, b, c, unit, scale }: { a: number; b: number; c: number; unit: string; scale: number }) {
  // Dibujo proporcional con el lado más largo como base: así el vértice siempre cae sobre la base
  // y las etiquetas no se salen del dibujo, por desiguales que sean los lados.
  const [base, left, right] = [a, b, c].sort((p, q) => q - p);
  const k = 200 / base * scale;
  const C = base * k, A = left * k, B = right * k;
  const x = (A * A - B * B + C * C) / (2 * C), y = -Math.sqrt(Math.max(A * A - x * x, 100));
  const pad = 78;
  const T = (tx: number, ty: number, s: string) => <text x={tx} y={ty} textAnchor="middle" fill={BONE} fontSize="19" fontWeight="700" fontFamily="Lexend, system-ui">{s}</text>;
  return (
    <svg width={C + 2 * pad} height={-y + 70} viewBox={`${-pad} ${y - 30} ${C + 2 * pad} ${-y + 70}`} aria-hidden="true">
      <polygon points={`0,0 ${C},0 ${x},${y}`} fill={CARD} stroke={GOLD} strokeWidth="4" strokeLinejoin="round" />
      {T(C / 2, 28, dimLabel(base, unit))}
      {T(x / 2 - 36, y / 2, dimLabel(left, unit))}
      {T((x + C) / 2 + 36, y / 2, dimLabel(right, unit))}
    </svg>
  );
}
function TriH({ b, h, unit, scale }: { b: number; h: number; unit: string; scale: number }) {
  const k = Math.min(240 / b, 150 / h) * scale, B = b * k, H = h * k, apex = B * 0.35;
  const T = (tx: number, ty: number, s: string, anchor: 'start' | 'middle' | 'end' = 'middle') => <text x={tx} y={ty} textAnchor={anchor} fill={BONE} fontSize="19" fontWeight="700" fontFamily="Lexend, system-ui">{s}</text>;
  // La altura se acota fuera, a la izquierda: dentro chocaría con el lado inclinado si el triángulo es bajo
  const lab = Math.min(Math.max(-H / 2 + 7, -H + 16), 0);
  return (
    <svg width={B + 120} height={H + 60} viewBox={`-90 ${-H - 20} ${B + 120} ${H + 60}`} aria-hidden="true">
      <polygon points={`0,0 ${B},0 ${apex},${-H}`} fill={CARD} stroke={GOLD} strokeWidth="4" strokeLinejoin="round" />
      <line x1={apex} y1={-H} x2={apex} y2="0" stroke={LAV} strokeWidth="3" strokeDasharray="7 6" />
      <path d={`M-22 0V${-H}M-28 0H-16M-28 ${-H}H-16`} stroke={LAV} strokeWidth="2" fill="none" />
      <line x1="-16" y1={-H} x2={apex} y2={-H} stroke={LAV} strokeWidth="1.5" strokeDasharray="3 5" opacity=".7" />
      {T(B / 2, 28, dimLabel(b, unit))}
      {T(-30, lab, dimLabel(h, unit), 'end')}
    </svg>
  );
}
function Box({ w, h, d, unit, scale }: { w: number; h: number; d: number; unit: string; scale: number }) {
  const k = 150 / Math.max(w, h, d) * scale, W = w * k, H = h * k, Dx = d * k * 0.55, Dy = d * k * 0.35;
  const T = (tx: number, ty: number, s: string, anchor: 'start' | 'middle' | 'end' = 'middle') => <text x={tx} y={ty} textAnchor={anchor} fill={BONE} fontSize="18" fontWeight="700" fontFamily="Lexend, system-ui">{s}</text>;
  return (
    <svg width={W + Dx + 120} height={H + Dy + 60} viewBox={`-60 ${-Dy - 10} ${W + Dx + 120} ${H + Dy + 60}`} aria-hidden="true">
      <polygon points={`0,0 ${Dx},${-Dy} ${W + Dx},${-Dy} ${W},0`} fill="#25479F" stroke={GOLD} strokeWidth="3" strokeLinejoin="round" />
      <polygon points={`${W},0 ${W + Dx},${-Dy} ${W + Dx},${H - Dy} ${W},${H}`} fill="#12275F" stroke={GOLD} strokeWidth="3" strokeLinejoin="round" />
      <rect x="0" y="0" width={W} height={H} fill={CARD} stroke={GOLD} strokeWidth="3" />
      {T(W / 2, H + 26, dimLabel(w, unit))}
      {T(-10, H / 2 + 6, dimLabel(h, unit), 'end')}
      {T(W + Dx / 2 + 8, H - Dy / 2 + 26, dimLabel(d, unit), 'start')}
    </svg>
  );
}
function Coins({ coins }: { coins: number[] }) {
  return (
    <div className="coins" aria-hidden="true">
      {coins.map((c, i) => {
        const big = c >= 10, r = 26 + Math.log2(c + 1) * 3;
        return (
          <svg key={i} width={r * 2 + 4} height={r * 2 + 4} viewBox={`0 0 ${r * 2 + 4} ${r * 2 + 4}`}>
            <circle cx={r + 2} cy={r + 2} r={r} fill={big ? GOLD : '#D9531E'} stroke={big ? '#E0A200' : '#A33F14'} strokeWidth="4" />
            <text x={r + 2} y={r + 9} textAnchor="middle" fontSize={r * 0.62} fontWeight="800" fill={big ? '#3A2A00' : BONE} fontFamily="Lexend, system-ui">{c}c</text>
          </svg>
        );
      })}
    </div>
  );
}
function NumLine({ from, to, marks, hi }: { from: number; to: number; marks: number[]; hi: number }) {
  const span = to - from, W = 440, x = (v: number) => 34 + ((v - from) / span) * (W - 68);
  const step = span <= 30 ? 1 : 0;
  const ticks = step ? Array.from({ length: span + 1 }, (_, i) => from + i) : [from, to, ...marks];
  return (
    <svg width={W} height="78" viewBox={`0 0 ${W} 78`} aria-hidden="true">
      <line x1="4" y1="34" x2={W - 4} y2="34" stroke={MUTED} strokeWidth="3" />
      {ticks.map(t => <line key={'t' + t} x1={x(t)} y1="26" x2={x(t)} y2="42" stroke={t === 0 ? GOLD : MUTED} strokeWidth={t === 0 ? 4 : 2} />)}
      {ticks.filter(t => !step || span <= 12 || t % 2 === 0 || marks.includes(t) || t === 0).map(t =>
        <text key={'l' + t} x={x(t)} y="66" textAnchor="middle" fontSize="15" fontWeight={marks.includes(t) ? 800 : 500} fill={t === hi ? GOLD : BONE} fontFamily="Lexend, system-ui">{fmtNum(t)}</text>)}
      {marks.map((m, i) => <circle key={'m' + i} cx={x(m)} cy="34" r="9" fill={m === hi ? GOLD : LAV} />)}
    </svg>
  );
}
function Place({ n }: { n: number }) {
  const digits = String(n).split('');
  const heads = (rawRes('words.pvh') as string[]) || ['U', 'D', 'C', 'UM', 'DM', 'CM', 'U.Mi'];
  return (
    <table className="place" aria-hidden="true">
      <thead><tr>{digits.map((_, i) => <th key={i}>{heads[digits.length - 1 - i]}</th>)}</tr></thead>
      <tbody><tr>{digits.map((d, i) => <td key={i}>{d}</td>)}</tr></tbody>
    </table>
  );
}
function Decs({ a, b, op, ans }: { a: Val; b: Val; op: '+' | '-'; ans: Val }) {
  const p = Math.max(a.k === 'dec' ? a.p : 0, b.k === 'dec' ? b.p : 0, ans.k === 'dec' ? ans.p : 0);
  const pad = (v: Val) => v.k === 'dec' ? fmtDec(v.u * 10 ** (p - v.p), p) : v.k === 'int' ? fmtDec(v.v * 10 ** p, p) : valText(v);
  return (
    <div className="calc" aria-hidden="true">
      <div><span /><span>{pad(a)}</span></div>
      <div><span>{op === '+' ? '+' : '−'}</span><span>{pad(b)}</span></div>
      <i className="rule" /><div className="rs"><span /><span>{pad(ans)}</span></div>
    </div>
  );
}
function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values), W = 46;
  return (
    <svg width={values.length * (W + 12) + 10} height="150" aria-hidden="true">
      {values.map((v, i) => {
        const h = (v / max) * 100;
        return <g key={i}>
          <rect x={10 + i * (W + 12)} y={118 - h} width={W} height={h} rx="8" fill={i % 2 ? LAV : GOLD} />
          <text x={10 + i * (W + 12) + W / 2} y={140} textAnchor="middle" fontSize="16" fontWeight="700" fill={BONE} fontFamily="Lexend, system-ui">{fmtNum(v)}</text>
        </g>;
      })}
    </svg>
  );
}
