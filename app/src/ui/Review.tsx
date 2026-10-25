/* Hoja de revisión a mano (criterio de la fase 3): 50 preguntas por nivel, en cualquier idioma,
   con la respuesta, los distractores y la etiqueta de error de cada uno. Ruta: #/revision   */
import { useMemo, useState } from 'react';
import { makeTest, explain, type Question } from '../engine';
import { LANGS, type Lang } from '../data/types';
import { useT, setLang, renderTpl, valText, ValView, rawRes } from '../i18n';
import { VisualView } from './visuals';

export function Review() {
  const t = useT();
  const [level, setLevel] = useState(1);
  const [lang, setL] = useState<Lang>('es');
  const [seed, setSeed] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const qs = useMemo(() => makeTest(level, 50, seed * 1000 + level), [level, seed]);
  return (
    <div className="review">
      <h1>{t('review.title')}</h1>
      <p className="muted">{t('review.lead')}</p>
      <div className="rvbar">
        <span className="segs">{[1, 2, 3, 4, 5, 6].map(l => <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)}>{t('kid.level', { n: l })}</button>)}</span>
        <span className="segs">{LANGS.map(l => <button key={l} aria-pressed={lang === l} onClick={() => { setL(l); setLang(l); }}>{l.toUpperCase()}</button>)}</span>
        <button className="pbtn line" onClick={() => setSeed(seed + 1)}>{t('review.other')}</button>
        <a className="pbtn line" href="#/">{t('common.back')}</a>
      </div>
      <ol className="rvlist">
        {qs.map((q: Question, i) => (
          <li key={i} onClick={() => setOpen(open === i ? null : i)}>
            <div className="rvq">
              <span className="chip">{t('skill.' + q.gen)}</span>
              {q.visual && <VisualView v={q.visual} size="sm" />}
              <span className="rvp">{renderTpl('q.' + q.prompt.key, q.prompt.vars, <b className="ok"><ValView v={q.answer} /></b>)}</span>
              {!String(rawRes('q.' + q.prompt.key)).includes('{{q}}') && <b className="ok"> → {valText(q.answer)}</b>}
            </div>
            <div className="rvo">
              {q.options.map((o, j) => <span key={j} className={'chip ' + (o.tag === 'ok' ? 'good' : '')}><ValView v={o.v} />{o.tag !== 'ok' && <small> · {o.tag}</small>}</span>)}
              <span className="muted"> {q.type === 'num' ? t('review.numpad') : t('review.mc')}</span>
            </div>
            {open === i && <div className="rvx">{q.options.filter(o => o.tag !== 'ok').map((o, j) => {
              const x = explain(q, o.tag, o.v);
              return <div key={j}><b>{valText(o.v)} — {renderTpl('tag.young.' + o.tag + (x.tagVars.p !== undefined ? '-xyp' : x.tagVars.x !== undefined ? '-xy' : ''), x.tagVars)}</b>
                <ol>{x.steps.map((s, k) => <li key={k}>{renderTpl(s.k, s.v)}</li>)}</ol></div>;
            })}</div>}
          </li>
        ))}
      </ol>
    </div>
  );
}
