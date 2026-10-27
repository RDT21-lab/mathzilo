/* Piezas comunes: escalado del diseño, consultas en vivo a la base de datos, iconos y mascota. */
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { liveQuery } from 'dexie';
import M from '../mascots/mascots.js';
import type { Child } from '../data/types';
import { useT } from '../i18n';

/** Resultado de una consulta a IndexedDB que se refresca solo cuando cambian los datos */
export function useLive<T>(fn: () => Promise<T>, deps: unknown[], initial: T): T {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(fn).subscribe({ next: setV, error: e => console.error(e) });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useLayoutEffect(() => {
    const f = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    window.visualViewport?.addEventListener('resize', f);
    return () => { window.removeEventListener('resize', f); window.visualViewport?.removeEventListener('resize', f); };
  }, []);
  return vp;
}

/** Tablet del niño: diseño 1024×680 escalado para caber entero (bandas si sobra) */
export function KidStage({ children, big }: { children: ReactNode; big?: boolean }) {
  const { w, h } = useViewport();
  const s = Math.min(w / 1024, h / 680);
  return (
    <div className="stage">
      <div className={'device kid' + (big ? ' big' : '')} style={{ width: 1024, height: 680, transform: `scale(${s})`, left: (w - 1024 * s) / 2, top: (h - 680 * s) / 2 }}>
        {children}
      </div>
    </div>
  );
}
/** Móvil del padre: 390 de ancho escalado al ancho de la pantalla; el alto se adapta */
export function ParentStage({ children }: { children: ReactNode }) {
  const { w, h } = useViewport();
  const s = Math.min(w / 390, 1.5, h / 640);
  const width = Math.min(390, w / s);
  return (
    <div className="stage">
      <div className="device parent" style={{ width, height: h / s, transform: `scale(${s})`, left: (w - width * s) / 2, top: 0 }}>
        {children}
      </div>
    </div>
  );
}

const ICONS: Record<string, string> = {
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
  arrow: '<path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1.2A4.6 4.6 0 0 0 7 18.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
  list: '<rect x="4.5" y="3.5" width="15" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 9l1.5 1.5L12 8M8 15l1.5 1.5L12 14M14.5 9.5h2M14.5 15.5h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
};
export function Icon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

export const EMOS = ['contenta', 'pensando', 'animando'] as const;
export type Emo = typeof EMOS[number];
export function Mascot({ child, emo = 'contenta', stage, className, style }: { child: Pick<Child, 'kind' | 'petName' | 'bestStreak'>; emo?: Emo; stage?: number; className?: string; style?: React.CSSProperties }) {
  const t = useT();
  const st = stage ?? M.stageFor(child.bestStreak);
  const svg = M.svg(child.kind, st, emo, { title: child.petName + ' · ' + t('stage.' + st) });
  return <div className={'mascot' + (className ? ' ' + className : '')} style={style} dangerouslySetInnerHTML={{ __html: svg }} />;
}
export const stageFor = (best: number) => M.stageFor(best);
export const STAGE_STREAK = M.STAGES.map(s => s.bestStreak);

/** Mensaje breve que se oculta solo */
export function useToast(): [string | null, (m: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(null), 2800); return () => clearTimeout(id); }, [msg]);
  return [msg, setMsg];
}
export function Toast({ msg }: { msg: string | null }) {
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}
