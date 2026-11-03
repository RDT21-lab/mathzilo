/* Modo padre: exportar (y recordar hacerlo cada semana), restaurar una copia e instalar la app. */
import { useEffect, useState } from 'react';
import { db, getMeta, setMeta } from '../../data/db';
import * as repo from '../../data/repo';
import { useT } from '../../i18n';
import { useLive } from '../common';
import { canPrompt, isInstalled, onInstallChange, persistStorage, platform, promptInstall } from '../../install';

const WEEK = 7 * 86400_000;

export async function downloadExport() {
  const data = { ...(await repo.exportAll()), errors: await getMeta('errors', []) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mathzilo-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  await setMeta('lastExport', Date.now());
}

/** Restaurar una copia exportada (tablet nueva, app borrada o datos perdidos) */
export function RestoreBackup({ onDone, compact }: { onDone: () => void; compact?: boolean }) {
  const t = useT();
  const [backup, setBackup] = useState<repo.Backup | null>(null);
  const [err, setErr] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    setErr(''); setBackup(null);
    if (!f) return;
    try { setBackup(repo.readBackup(await f.text())); } catch { setErr(t('extra.restoreBad')); }
  };
  return (
    <div className={compact ? 'restore' : 'restore sect'}>
      {!compact && <h3>{t('extra.restoreTitle')}</h3>}
      <p className="muted small" style={{ margin: 0 }}>{t('extra.restoreLead')}</p>
      <label className="pbtn line filebtn">{t('extra.restoreFile')}
        <input type="file" accept="application/json,.json" onChange={e => pick(e.target.files?.[0])} />
      </label>
      {err && <p className="err">{err}</p>}
      {backup && (
        <>
          <div className="sumbar">
            <span>{t('extra.restoreSummary', { kids: backup.children.map(c => c.name).join(', '), date: new Date(backup.exportedAt).toLocaleDateString(), tests: backup.sessions.length })}</span>
            <span className="small" style={{ color: 'var(--soft-fail)' }}>{t('extra.restoreWarn')}</span>
          </div>
          <label className="field">{t('extra.restorePin')}
            <input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </label>
          <button className="pbtn full" disabled={busy || !/^\d{4,6}$/.test(pin)} onClick={async () => {
            setBusy(true);
            await repo.restoreBackup(backup, pin);
            setBusy(false);
            onDone();
          }}>{t('extra.restoreBtn')}</button>
        </>
      )}
    </div>
  );
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
