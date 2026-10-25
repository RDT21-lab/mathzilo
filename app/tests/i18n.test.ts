/* Fase 8: los 4 idiomas tienen las mismas claves y todo lo que genera el motor (enunciados,
   frases de error en dos tonos y pasos de explicación) se pinta en cada idioma sin huecos.  */
import { describe, expect, it } from 'vitest';
import i18n, { tplText, valText } from '../src/i18n';
import { resources } from '../src/i18n/all';
import { GENERATORS, makeQuestion, explain, ERROR_TAGS } from '../src/engine';
import type { Lang } from '../src/data/types';

const LANGS: Lang[] = ['es', 'en', 'fr', 'de'];
const SEEDS = Number(process.env.I18N_SEEDS ?? 300);

function keys(o: unknown, p = ''): string[] {
  if (Array.isArray(o)) return [p];
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => keys(v, p ? p + '.' + k : k));
  return [p];
}
// Variantes que dependen de la gramática de cada idioma (género, plural)
const own = (k: string) => k.endsWith('_f') || k.endsWith('.g') || /_(one|other)$/.test(k);

describe('mismas claves en los 4 idiomas', () => {
  const base = new Set(keys(resources.es.translation).filter(k => !own(k)));
  for (const l of LANGS.slice(1)) {
    it(l, () => {
      const mine = new Set(keys(resources[l].translation).filter(k => !own(k)));
      expect([...base].filter(k => !mine.has(k)), 'faltan en ' + l).toEqual([]);
      expect([...mine].filter(k => !base.has(k)), 'sobran en ' + l).toEqual([]);
    });
  }
  it('cada etiqueta de error tiene frase y nombre en los dos tonos', () => {
    for (const l of LANGS) for (const t of ERROR_TAGS) {
      for (const k of ['tag.young.' + t, 'tag.older.' + t, 'tagName.' + t]) expect(typeof i18n.getResource(l, 'translation', k), l + ' ' + k).toBe('string');
    }
  });
});

describe('el motor se pinta completo en cada idioma', () => {
  for (const l of LANGS) {
    it(l, async () => {
      await i18n.changeLanguage(l);
      const bad: string[] = [];
      const check = (what: string, key: string, s: string) => {
        if (typeof i18n.getResource(l, 'translation', key) !== 'string' && typeof i18n.getResource(l, 'translation', key + '_f') !== 'string') bad.push(what + ': falta ' + key);
        else if (/\{\{|undefined|NaN|@/.test(s)) bad.push(what + ': ' + s);
      };
      for (const g of GENERATORS) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const q = makeQuestion(g.id, seed);
          check(g.id, 'q.' + q.prompt.key, tplText('q.' + q.prompt.key, q.prompt.vars, '?', l));
          for (const o of q.options) {
            valText(o.v, l);
            if (o.tag === 'ok') continue;
            const x = explain(q, o.tag, o.v);
            const suf = x.tagVars.p !== undefined ? '-xyp' : x.tagVars.x !== undefined ? '-xy' : '';
            for (const tone of ['young', 'older']) check(g.id, 'tag.' + tone + '.' + o.tag + suf, tplText('tag.' + tone + '.' + o.tag + suf, x.tagVars, '?', l));
            for (const s of x.steps) check(g.id, s.k, tplText(s.k, s.v, '?', l));
          }
          if (bad.length > 10) break;
        }
        check('skill', 'skill.' + g.id, i18n.t('skill.' + g.id));
      }
      expect(bad.slice(0, 10)).toEqual([]);
    });
  }
});

describe('formato de números por idioma', () => {
  it('coma decimal en es/fr/de, punto en en; euros', async () => {
    const { fmtDec, fmtMoney } = await import('../src/i18n');
    expect(fmtDec(75, 2, 'es')).toBe('0,75');
    expect(fmtDec(75, 2, 'en')).toBe('0.75');
    expect(fmtDec(12345, 1, 'de')).toBe('1.234,5');
    expect(fmtMoney(850, 'fr').replace(/\s/g, ' ')).toBe('8,50 €');
    expect(fmtMoney(600, 'en')).toBe('€6');
  });
});
