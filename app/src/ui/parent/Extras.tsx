/* Fases 10 y 11 en el modo padre: exportar (y recordar hacerlo cada semana), instalar la app,
   y el resumen del piloto para ajustar estrellas, niveles y textos confusos.                */
import { useEffect, useState } from 'react';
import { db, getMeta, setMeta } from '../../data/db';
import * as repo from '../../data/repo';
import type { Child, Family } from '../../data/types';
import { balanceOf } from '../../data/domain';
import { useT, fmtNum } from '../../i18n';
import { useLive } from '../common';
import { canPrompt, isInstalled, onInstallChange, persistStorage, platform, promptInstall } from '../../install';

const WEEK = 7 * 86400_000;

export async function downloadExport() {
  const data = { ...(await repo.exportAll()), pilotNotes: await getMeta('pilotNotes', ''), errors: await getMeta('errors', []) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mathzilo-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  await setMeta('lastExport', Date.now());
}

/** Aviso en el panel si hace más de una semana de la última copia exportada */
export function ExportReminder() {
  const t = useT();
  const st = useLive(async () => ({ last: await getMeta('lastExport', 0), sessions: await db.sessions.count(), since: await getMeta('firstUse', 0) }), [], null);
  useEffect(() => { getMeta('firstUse', 0).then(v => { if (!v) setMeta('firstUse', Date.now()); }); }, []);
  if (!st || !st.sessions) return null;
  const ref = st.last || st.since;
  if (!ref || Date.now() - ref < WEEK) return null;
  return (
    <div className="sug">
      <span>{t('extra.exportReminder')}</span>
      <div className="acts"><button className="pbtn" onClick={downloadExport}>{t('parent.export')}</button>
        <button className="pbtn line" onClick={() => setMeta('lastExport', Date.now())}>{t('parent.notNow')}</button></div>
    </div>
  );
}

/** Ayuda de instalación según el dispositivo */
export function InstallSection() {
  const t = useT();
  const [, force] = useState(0);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => onInstallChange(() => force(x => x + 1)), []);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)); }, []);
  const p = platform();
  return (
    <section className="sect"><h3>{t('extra.installTitle')}</h3>
      {isInstalled() ? <p className="okline">✓ {t('extra.installed')}</p> : (
        <>
          {canPrompt() && <button className="pbtn" onClick={promptInstall}>{t('extra.installNow')}</button>}
          <ol className="howto">{(t('extra.steps.' + p, { returnObjects: true }) as unknown as string[]).map((s, i) => <li key={i}>{s}</li>)}</ol>
        </>
      )}
      {p === 'ios' && <p className="muted small">{t('extra.guided')}</p>}
      <div className="srow"><span className="lb">{t('extra.persist')}<small>{t('extra.persistSub')}</small></span>
        {persisted ? <b className="okline">✓</b> : <button className="pbtn line" onClick={async () => setPersisted(await persistStorage())}>{t('extra.persistBtn')}</button>}</div>
    </section>
  );
}

/** Resumen del piloto: ritmo de estrellas, aprobados y explicaciones marcadas como confusas */
export function PilotSummary({ family }: { family: Family }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const data = useLive(async () => {
    const since = Date.now() - 14 * 86400_000;
    const kids: Child[] = await db.children.toCollection().sortBy('createdAt');
    const rewards = (await db.rewards.toArray()).filter(r => r.active);
    const maxReward = rewards.reduce((m, r) => Math.max(m, r.cost), 0);
    const rows = await Promise.all(kids.map(async c => {
      const ses = (await db.sessions.where('childId').equals(c.id).toArray()).filter(s => s.endedAt > since);
      const evs = (await db.events.where('childId').equals(c.id).toArray()).filter(e => e.ts > since && e.amount > 0);
      const days = new Set(ses.map(s => s.serverDay ?? s.day)).size;
      const earned = balanceOf(evs);
      const scored = ses.filter(s => !s.practice);
      return { c, tests: ses.length, days, perMonth: Math.round(earned / 14 * 30), pass: scored.length ? Math.round(scored.filter(s => s.passed).length / scored.length * 100) : null,
               fast: ses.filter(s => s.fast).length };
    }));
    const flags = (await db.flags.toArray()).filter(f => f.ts > since);
    const count = new Map<string, number>();
    flags.forEach(f => count.set(f.gen + '|' + f.tag, (count.get(f.gen + '|' + f.tag) ?? 0) + 1));
    const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ gen: k.split('|')[0], tag: k.split('|')[1], n }));
    return { rows, top, maxReward, notes: await getMeta('pilotNotes', '') };
  }, [family], null);
  const [notes, setNotes] = useState<string | null>(null);
  if (!data) return null;
  return (
    <div className="kidcard pilot">
      <button className="pilothd" onClick={() => setOpen(!open)} aria-expanded={open}><b>{t('extra.pilotTitle')}</b><span className="muted">{t('extra.pilotLead')}</span></button>
      {open && (
        <>
          {data.rows.map(r => (
            <div className="sumbar" key={r.c.id}>
              <b>{r.c.name}</b>
              <div className="sb"><span>{t('extra.daysUsed')}</span><b>{r.days} / 14</b></div>
              <div className="sb"><span>{t('extra.tests')}</span><b>{r.tests}</b></div>
              <div className="sb"><span>{t('extra.passRate')}</span><b>{r.pass === null ? '—' : r.pass + ' %'}</b></div>
              <div className="sb"><span>{t('extra.perMonth')}</span><b className="gold">≈ {fmtNum(r.perMonth)} ★</b></div>
              {r.fast > 0 && <div className="sb"><span>{t('extra.fast')}</span><b>{r.fast}</b></div>}
              {data.maxReward > 0 && r.perMonth > 0 && (
                <span className="muted small">{r.perMonth > data.maxReward * 2 ? t('extra.tooMany', { n: fmtNum(data.maxReward) }) : r.perMonth < data.maxReward / 4 ? t('extra.tooFew', { n: fmtNum(data.maxReward) }) : t('extra.balanced')}</span>
              )}
            </div>
          ))}
          <div className="caps">{t('extra.flagged')}</div>
          {data.top.length ? data.top.map(f => <div className="led" key={f.gen + f.tag}><span>{t('skill.' + f.gen)} · {t('tagName.' + f.tag)}</span><b>{f.n}</b></div>)
            : <span className="muted">{t('extra.noFlags')}</span>}
          <label className="field">{t('extra.notes')}
            <textarea rows={4} value={notes ?? data.notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== null && setMeta('pilotNotes', notes)} placeholder={t('extra.notesPh')} />
          </label>
          <span className="muted small">{t('extra.notesHint')}</span>
        </>
      )}
    </div>
  );
}
