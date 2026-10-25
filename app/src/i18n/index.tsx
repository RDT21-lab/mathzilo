/* Idiomas: i18next para la interfaz y un intérprete propio para enunciados y explicaciones, que
   pinta los números con el formato de cada idioma (coma o punto, millares) y las fracciones
   apiladas. Las respuestas son números: el idioma nunca cambia cuál es la correcta.        */
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { Val } from '../engine';
import type { Lang } from '../data/types';
/* Cada idioma es un archivo aparte que se descarga al usarlo (el service worker los guarda
   todos para trabajar sin conexión). */
const LOADERS: Record<Lang, () => Promise<Record<string, unknown>>> = {
  es: async () => ({ ...(await import('./es/content.json')).default, ...(await import('./es/ui.json')).default }),
  en: async () => ({ ...(await import('./en/content.json')).default, ...(await import('./en/ui.json')).default }),
  fr: async () => ({ ...(await import('./fr/content.json')).default, ...(await import('./fr/ui.json')).default }),
  de: async () => ({ ...(await import('./de/content.json')).default, ...(await import('./de/ui.json')).default })
};

i18n.use(initReactI18next).init({
  resources: {}, partialBundledLanguages: true, lng: 'es', fallbackLng: 'es', interpolation: { escapeValue: false }, returnNull: false
});
export default i18n;
export const useT = () => useTranslation().t;

const LOCALE: Record<Lang, string> = { es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };
const ALL: Lang[] = ['es', 'en', 'fr', 'de'];
export const curLang = () => (i18n.language as Lang) || 'es';
export async function loadLang(l: Lang) {
  if (!i18n.hasResourceBundle(l, 'translation')) i18n.addResourceBundle(l, 'translation', await LOADERS[l](), true, true);
}
export function setLang(l: Lang) {
  document.documentElement.lang = l;
  try { localStorage.setItem('sm-lang', l); } catch { /* sin almacenamiento */ }
  if (i18n.language === l && i18n.hasResourceBundle(l, 'translation')) return;
  loadLang(l).then(() => i18n.changeLanguage(l));
}
/** Idioma de arranque: el último usado en este dispositivo o el del navegador */
export async function initLang() {
  let l: Lang | null = null;
  try { l = localStorage.getItem('sm-lang') as Lang | null; } catch { /* nada */ }
  if (!l || !ALL.includes(l)) l = ALL.find(x => navigator.language.startsWith(x)) ?? 'es';
  await loadLang(l);
  await i18n.changeLanguage(l);
  document.documentElement.lang = l;
}

/* ---------- Números ---------- */
export function fmtNum(n: number, lang = curLang()): string {
  return new Intl.NumberFormat(LOCALE[lang]).format(n).replace('-', '−');
}
function decSep(lang: Lang) { return new Intl.NumberFormat(LOCALE[lang]).formatToParts(1.5).find(p => p.type === 'decimal')?.value ?? ','; }
export function fmtDec(u: number, p: number, lang = curLang()): string {
  const neg = u < 0, s = String(Math.abs(u)).padStart(p + 1, '0');
  return (neg ? '−' : '') + fmtNum(parseInt(s.slice(0, -p), 10), lang) + decSep(lang) + s.slice(-p);
}
export function fmtMoney(c: number, lang = curLang()): string {
  return new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR', minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(c / 100);
}
export function fmtTime(h: number, m: number, lang = curLang()): string {
  const mm = String(m).padStart(2, '0');
  return lang === 'fr' ? h + ' h ' + mm : h + ':' + mm;
}
export function valText(v: Val, lang = curLang()): string {
  switch (v.k) {
    case 'int': return fmtNum(v.v, lang);
    case 'dec': return fmtDec(v.u, v.p, lang);
    case 'frac': return v.n + '/' + v.d;
    case 'money': return fmtMoney(v.c, lang);
    case 'time': return fmtTime(v.h, v.m, lang);
    case 'sym': return v.s;
  }
}
export function ValView({ v, paren }: { v: Val; paren?: boolean }) {
  if (v.k === 'frac') return <span className="frac" aria-label={v.n + '/' + v.d}><span>{v.n}</span><span>{v.d}</span></span>;
  const s = valText(v);
  return <>{paren && v.k === 'int' && v.v < 0 ? '(' + s + ')' : s}</>;
}

/* ---------- Plantillas con huecos ---------- */
export function rawRes(key: string, lang = curLang()): unknown {
  return i18n.getResource(lang, 'translation', key) ?? i18n.getResource('es', 'translation', key);
}
type Vars = Record<string, Val | string | number>;
function wordOf(ref: string, lang: Lang): { text: string; g?: string } {
  const r = rawRes('words.' + ref.slice(1), lang) as { pl: string; g?: string } | string | undefined;
  if (r && typeof r === 'object') return { text: r.pl, g: r.g };
  return { text: (r as string) ?? ref };
}
/** Clave efectiva: usa la variante «_f» si una palabra del enunciado es femenina */
export function tplKey(key: string, vars: Vars, lang = curLang()): string {
  for (const v of Object.values(vars)) {
    if (typeof v === 'string' && v.startsWith('@') && wordOf(v, lang).g === 'f' && rawRes(key + '_f', lang)) return key + '_f';
  }
  return key;
}
function isVal(x: unknown): x is Val { return typeof x === 'object' && x !== null && 'k' in x; }

/** Pinta una plantilla con huecos; `q` es lo que ocupa el hueco de la respuesta */
export function renderTpl(key: string, vars: Vars = {}, q?: ReactNode, lang = curLang()): ReactNode[] {
  const k = tplKey(key, vars, lang);
  const tpl = rawRes(k, lang);
  if (typeof tpl !== 'string') return [key];
  const mul = (rawRes('sym.mul', lang) as string) ?? '×';
  const out: ReactNode[] = [];
  tpl.split(/(\{\{\w+\}\})/).forEach((part, i) => {
    const m = part.match(/^\{\{(\w+)\}\}$/);
    if (!m) { if (part) out.push(part); return; }
    const name = m[1];
    if (name === 'q') { out.push(<span key={i} className="qslot">{q ?? '?'}</span>); return; }
    const v = vars[name];
    if (v === undefined) { out.push(''); return; }
    if (isVal(v)) out.push(<ValView key={i} v={v} paren={name.endsWith('P')} />);
    else if (typeof v === 'number') out.push(fmtNum(v, lang));
    else if (v.startsWith('@')) out.push(wordOf(v, lang).text);
    else out.push(v.replace(/×/g, mul));
  });
  return out;
}
/** Igual, pero como texto plano (para lectores de pantalla y pruebas) */
export function tplText(key: string, vars: Vars = {}, q = '?', lang = curLang()): string {
  const k = tplKey(key, vars, lang);
  const tpl = rawRes(k, lang);
  if (typeof tpl !== 'string') return key;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (name === 'q') return q;
    const v = vars[name];
    if (v === undefined) return '';
    if (isVal(v)) return valText(v, lang);
    if (typeof v === 'number') return fmtNum(v, lang);
    return v.startsWith('@') ? wordOf(v, lang).text : v;
  });
}

/** Notas del libro de movimientos: «@ev.aciertos;n=8;t=10» o texto libre del padre */
export function noteText(note: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!note.startsWith('@')) return note;
  const [key, ...kv] = note.slice(1).split(';');
  const vars: Record<string, unknown> = {};
  kv.forEach(p => { const [a, b] = p.split('='); vars[a] = b; });
  return t(key, vars);
}
