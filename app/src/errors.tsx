/* Registro de errores sin datos personales (fase 10): solo mensaje, pila, versión y pantalla.
   Se guardan los últimos 20 en el dispositivo y, si hay cuenta en la nube, se envían al servidor. */
import { Component, type ReactNode } from 'react';
import { getMeta, setMeta } from './data/db';
import { getSyncConfig } from './sync/client';
import i18n from './i18n';

export interface ErrorEntry { ts: number; v: string; where: string; msg: string; stack: string }
declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

/** Quita lo que podría identificar a alguien: emails, tokens, números largos y textos entre comillas */
export function scrub(s: string): string {
  return s.replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, '<email>').replace(/token=\w+/g, 'token=<x>')
          .replace(/"[^"]{1,60}"|'[^']{1,60}'/g, '"…"').replace(/\d{6,}/g, '<n>').slice(0, 2000);
}

let sending = false;
export async function reportError(err: unknown, where = location.hash || '#/') {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const entry: ErrorEntry = { ts: Date.now(), v: VERSION, where: where.slice(0, 40), msg: scrub(e.message), stack: scrub(e.stack ?? '') };
    const list = [...(await getMeta<ErrorEntry[]>('errors', [])), entry].slice(-20);
    await setMeta('errors', list);
    await flushErrors();
  } catch { /* registrar un error nunca debe romper la app */ }
}
export async function flushErrors() {
  if (sending) return;
  const cfg = await getSyncConfig();
  const pending = await getMeta<ErrorEntry[]>('errorsPending', []);
  const all = await getMeta<ErrorEntry[]>('errors', []);
  const sent = await getMeta<number>('errorsSentTs', 0);
  const toSend = [...pending, ...all.filter(e => e.ts > sent)].slice(-20);
  if (!cfg || !toSend.length) return;
  sending = true;
  try {
    const r = await fetch(cfg.url.replace(/\/+$/, '') + '/api/log', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.token }, body: JSON.stringify({ errors: toSend }) });
    if (r.ok) { await setMeta('errorsSentTs', Math.max(...toSend.map(e => e.ts))); await setMeta('errorsPending', []); }
  } catch { /* sin conexión: se envía más tarde */ } finally { sending = false; }
}
export function installErrorHandlers() {
  window.addEventListener('error', ev => reportError(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', ev => reportError(ev.reason));
  window.addEventListener('online', () => flushErrors());
}

/** Si una pantalla falla, se ve un aviso amable con un botón para volver a empezar */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { reportError(err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash" role="alert">
        <img src="favicon.svg" alt="" width={72} height={72} />
        <h1>{i18n.t('crash.title')}</h1>
        <p>{i18n.t('crash.text')}</p>
        <button className="btn btn-gold" onClick={() => { location.hash = '#/'; location.reload(); }}>{i18n.t('crash.reload')}</button>
      </div>
    );
  }
}
