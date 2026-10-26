/* Modo padre (móvil en vertical, o la tablet con PIN): panel, canjes y ajustes.
   El PIN se pide al entrar y tras 5 minutos sin actividad; 5 fallos bloquean 15 minutos.   */
import { useEffect, useRef, useState } from 'react';
import { db } from '../../data/db';
import * as repo from '../../data/repo';
import type { Child, Family, Lang, Reward, StarEvent } from '../../data/types';
import { LANGS } from '../../data/types';
import { addDays, balanceOf, computeStreak, dayOf, levelSuggestion } from '../../data/domain';
import { IDLE_MS, validPin } from '../../data/pin';
import * as sync from '../../sync/client';
import { useT, setLang, noteText, fmtNum, rawRes } from '../../i18n';
import { Icon, Mascot, ParentStage, useLive, useToast, Toast } from '../common';
import markUrl from '../../assets/mark.svg';
import { downloadExport, ExportReminder, InstallSection, PilotSummary, RestoreBackup } from './Extras';

type Screen = 'panel' | 'redeem' | 'settings';

export function ParentApp({ family, onExit }: { family: Family; onExit: () => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [screen, setScreen] = useState<Screen>('panel');
  const [toast, setToast] = useToast();
  const last = useRef(Date.now());
  useEffect(() => { setLang(family.settings.lang); }, [family.settings.lang]);
  useEffect(() => {
    if (!unlocked) return;
    const touch = () => { last.current = Date.now(); };
    const iv = setInterval(() => { if (Date.now() - last.current > IDLE_MS) { setUnlocked(false); sync.elevate(null); } }, 10_000);
    window.addEventListener('pointerdown', touch); window.addEventListener('keydown', touch);
    return () => { clearInterval(iv); window.removeEventListener('pointerdown', touch); window.removeEventListener('keydown', touch); };
  }, [unlocked]);

  return (
    <ParentStage>
      {!unlocked ? <PinScreen family={family} onOk={pin => { last.current = Date.now(); setUnlocked(true); sync.elevate(pin); }} onExit={onExit} />
        : (
          <div className="pscr">
            {screen === 'panel' && <Panel family={family} toast={setToast} />}
            {screen === 'redeem' && <Redeem family={family} toast={setToast} />}
            {screen === 'settings' && <SettingsScreen family={family} toast={setToast} onExit={() => { setUnlocked(false); sync.elevate(null); onExit(); }} />}
            <Tabbar screen={screen} onGo={setScreen} />
          </div>
        )}
      <Toast msg={toast} />
    </ParentStage>
  );
}

function Tabbar({ screen, onGo }: { screen: Screen; onGo: (s: Screen) => void }) {
  const t = useT();
  const tabs: [Screen, string, string][] = [['panel', 'grid', 'parent.tab.panel'], ['redeem', 'gift', 'parent.tab.redeem'], ['settings', 'gear', 'parent.tab.settings']];
  return <nav className="tabbar">{tabs.map(([s, ic, k]) => <button key={s} aria-current={screen === s} onClick={() => onGo(s)}><Icon name={ic} size={26} />{t(k)}</button>)}</nav>;
}

/* ---------- PIN ---------- */
export function PinPad({ len, onDone, small }: { len: number; onDone: (pin: string) => Promise<string | null>; small?: boolean }) {
  const t = useT();
  const [entry, setEntry] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  async function press(k: string) {
    if (busy) return;
    if (k === 'del') { setEntry(e => e.slice(0, -1)); setErr(''); return; }
    const e = (entry + k).slice(0, len);
    setEntry(e);
    if (e.length === len) {
      setBusy(true);
      const res = await onDone(e);
      setBusy(false);
      if (res) { setErr(res); setEntry(''); setShake(true); setTimeout(() => setShake(false), 450); }
    }
  }
  useEffect(() => {
    const h = (ev: KeyboardEvent) => { if (/^\d$/.test(ev.key)) press(ev.key); else if (ev.key === 'Backspace') press('del'); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <>
      <div className={'dots' + (shake ? ' shake' : '')} role="img" aria-label={t('parent.digits', { n: entry.length, m: len })}>
        {Array.from({ length: len }, (_, i) => <i key={i} className={i < entry.length ? 'on' : ''} />)}
      </div>
      <p className="err" role="alert">{err}</p>
      <div className={'keys' + (small ? ' sm' : '')}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} onClick={() => press(String(n))}>{n}</button>)}
        <span />
        <button onClick={() => press('0')}>0</button>
        <button className="ghost" onClick={() => press('del')} aria-label={t('kid.delete')}><Icon name="del" size={28} /></button>
      </div>
    </>
  );
}
function pinError(t: (k: string, o?: Record<string, unknown>) => string, r: repo.PinCheck) {
  return r.locked ? t('parent.locked', { m: Math.max(1, Math.ceil((r.until - Date.now()) / 60_000)) }) : t('parent.wrong', { count: r.triesLeft });
}
function PinScreen({ family, onOk, onExit }: { family: Family; onOk: (pin: string) => void; onExit: () => void }) {
  const t = useT();
  const [forgot, setForgot] = useState(false);
  if (forgot) return <ForgotPin onDone={() => setForgot(false)} />;
  return (
    <div className="pscr"><div className="pbody pin">
      <img src={markUrl} alt="" width={64} height={64} />
      <h2>{t('parent.title')}</h2>
      <p className="lead" style={{ margin: 0 }}>{t('parent.enterPin')}</p>
      <PinPad len={family.pinLength} onDone={async pin => { const r = await repo.checkPin(pin); if (r.ok) { onOk(pin); return null; } return pinError(t, r); }} />
      <button className="link" onClick={() => setForgot(true)}>{t('parent.forgot')}</button>
      <button className="pbtn line" onClick={onExit}>{t('parent.back')}</button>
    </div></div>
  );
}
function ForgotPin({ onDone }: { onDone: () => void }) {
  const t = useT();
  const cfg = useLive(() => sync.getSyncConfig(), [], null);
  const [email, setEmail] = useState(''), [pass, setPass] = useState(''), [pin, setPin] = useState(''), [err, setErr] = useState('');
  return (
    <div className="pscr"><div className="pbody">
      <h2>{t('parent.forgotTitle')}</h2>
      {!cfg ? <p className="lead">{t('parent.forgotLocal')}</p> : (
        <>
          <p className="lead">{t('parent.forgotCloud')}</p>
          <label className="field">{t('parent.email')}<input type="text" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="field">{t('parent.password')}<input type="password" value={pass} onChange={e => setPass(e.target.value)} /></label>
          <label className="field">{t('parent.newPin')}<input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
          <p className="err">{err}</p>
          <button className="pbtn full" disabled={!validPin(pin)} onClick={async () => {
            try { await sync.login(cfg.url, email, pass); await repo.changePin(pin); await db.meta.put({ key: 'pinLock', value: { fails: 0, until: 0 } }); await sync.syncNow(); onDone(); }
            catch (e) { setErr(t('parent.syncErr.' + (e instanceof sync.SyncError ? e.code : 'error'))); }
          }}>{t('common.save')}</button>
        </>
      )}
      <button className="pbtn line" onClick={onDone}>{t('common.back')}</button>
    </div></div>
  );
}

/* ---------- Panel ---------- */
function useKids(family: Family) {
  return useLive(async () => {
    const kids = await db.children.toCollection().sortBy('createdAt');
    const today = dayOf(Date.now(), family.settings.dayStartHour);
    return Promise.all(kids.map(async c => {
      const sessions = await db.sessions.where('childId').equals(c.id).toArray();
      const events = await db.events.where('childId').equals(c.id).toArray();
      const answers = await db.answers.where('childId').equals(c.id).toArray();
      const mastery = await db.mastery.where('childId').equals(c.id).toArray();
      const streak = computeStreak(sessions, today, family.settings.shieldsOn, c.bestStreak);
      const recent = answers.filter(a => (sessions.find(s => s.id === a.sessionId)?.endedAt ?? 0) > Date.now() - 28 * 86400_000);
      const errors: Record<string, number> = {};
      recent.filter(a => !a.ok).forEach(a => { errors[a.tag] = (errors[a.tag] ?? 0) + 1; });
      const avg = answers.length ? answers.slice(-100).reduce((s, a) => s + a.ms, 0) / Math.min(100, answers.length) / 1000 : 0;
      const lastTest = sessions.filter(s => (s.serverDay ?? s.day) === today).sort((a, b) => b.endedAt - a.endedAt)[0];
      const dismissed = await db.meta.get('sugDismiss:' + c.id);
      const sug = levelSuggestion(sessions.filter(s => s.endedAt > ((dismissed?.value as number) ?? 0)), c.level);
      return { c, streak, bal: balanceOf(events), mastery, errors, avg, lastTest, sug, sessions, today };
    }));
  }, [family], []);
}
function Panel({ family, toast }: { family: Family; toast: (m: string) => void }) {
  const t = useT();
  const kids = useKids(family);
  const [open, setOpen] = useState<string | null>(null);
  const date = new Date().toLocaleDateString(family.settings.lang, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="pbody">
      <h2>{t('parent.hello')}</h2>
      <p className="lead">{t('parent.panelLead', { date })}</p>
      <SyncPill />
      <ExportReminder />
      {kids.map(k => {
        const isOpen = open === k.c.id;
        const mastery = [...k.mastery].sort((a, b) => a.value - b.value);
        const errs = Object.entries(k.errors).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return (
          <div key={k.c.id} className="kidcard" role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : k.c.id)}
               onKeyDown={e => { if (e.key === 'Enter') setOpen(isOpen ? null : k.c.id); }}>
            <div className="hd">
              <Mascot child={k.c} />
              <div><div className="nm">{k.c.name}</div><div className="muted" style={{ fontSize: 14 }}>{t('kid.level', { n: k.c.level })} · {k.streak.streak ? t('parent.streakN', { n: k.streak.streak }) : t('parent.streakRest')}</div></div>
              <div className="bal">{fmtNum(k.bal)} ★</div>
            </div>
            <div className="chips2">
              {k.lastTest ? <span className={'chip ' + (k.lastTest.passed ? 'good' : 'bad')}>{t('parent.lastToday', { c: k.lastTest.correct, n: k.lastTest.length })}</span> : <span className="chip">{t('parent.noTestToday')}</span>}
              <span className="chip"><Icon name="shield" size={14} />{t('parent.shields', { n: k.streak.shields })}</span>
              <span className="chip">{t('parent.record', { n: k.streak.best })}</span>
              {k.avg > 0 && <span className="chip">{t('parent.avgTime', { s: fmtNum(Math.round(k.avg * 10) / 10) })}</span>}
            </div>
            {k.bal < 0 && <div className="sug warn">{t('parent.negWarn', { name: k.c.name, n: k.bal })}</div>}
            {k.sug && (
              <div className="sug" onClick={e => e.stopPropagation()}>
                <span>{t(k.sug === 'up' ? 'parent.sugUp' : 'parent.sugDown', { name: k.c.name, n: k.c.level + (k.sug === 'up' ? 1 : -1) })}</span>
                <div className="acts">
                  <button className="pbtn" onClick={async () => { const n = k.c.level + (k.sug === 'up' ? 1 : -1); await repo.updateChild(k.c.id, { level: n }); await db.meta.put({ key: 'sugDismiss:' + k.c.id, value: Date.now() }); toast(t('parent.levelChanged', { name: k.c.name, n })); }}>
                    {t('parent.levelTo', { n: k.c.level + (k.sug === 'up' ? 1 : -1) })}</button>
                  <button className="pbtn line" onClick={() => db.meta.put({ key: 'sugDismiss:' + k.c.id, value: Date.now() })}>{t('parent.notNow')}</button>
                </div>
              </div>
            )}
            {isOpen && (
              <>
                <div className="caps">{t('parent.mastery')}</div>
                <div className="mast">
                  {mastery.length ? mastery.map(m => (
                    <div className="mr" key={m.skill}><span>{t('skill.' + m.skill)}</span><b>{m.value}%</b>
                      <div className="bar"><i className={m.value < 60 ? 'low' : m.value >= 85 ? 'hi' : ''} style={{ width: m.value + '%' }} /></div></div>
                  )) : <span className="muted">{t('parent.noMastery')}</span>}
                </div>
                <div className="caps">{t('parent.errors')}</div>
                <div className="chips2">{errs.length ? errs.map(([tag, n]) => <span key={tag} className="chip bad">{t('tagName.' + tag)} · {n}</span>) : <span className="muted">{t('parent.noErrors')}</span>}</div>
                <div className="caps">{t('parent.calendar')}</div>
                <Calendar states={k.streak.states} today={k.today} />
                <div className="caps">{t('parent.lastTests')}</div>
                <div className="hist">
                  {k.sessions.sort((a, b) => b.endedAt - a.endedAt).slice(0, 5).map(s => (
                    <div className="led" key={s.id}><span>{new Date(s.endedAt).toLocaleDateString(family.settings.lang, { day: 'numeric', month: 'short' })} · {t('kid.level', { n: s.level })} · {s.correct}/{s.length}{s.practice ? ' · ' + t('parent.practice') : ''}{s.fast ? ' · ' + t('parent.fast') : ''}</span><b className="gold">+{s.stars} ★</b></div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
      <PilotSummary family={family} />
    </div>
  );
}
function Calendar({ states, today }: { states: Record<string, string>; today: string }) {
  const t = useT();
  const start = addDays(today, -27);
  return (
    <div className="cal" aria-label={t('parent.calendar')}>
      {Array.from({ length: 28 }, (_, i) => { const d = addDays(start, i); const s = states[d] ?? (d === today ? 'today' : 'none');
        return <i key={d} className={'c-' + s} title={d + ' · ' + t('kid.state.' + s)} />; })}
    </div>
  );
}
function SyncPill() {
  const t = useT();
  const [st, setSt] = useState<sync.SyncStatus | null>(null);
  useEffect(() => sync.onSyncStatus(setSt), []);
  if (!st || st.state === 'off') return null;
  const time = st.at ? new Date(st.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return <button className={'syncpill s-' + st.state} onClick={() => sync.syncNow()}><Icon name="cloud" size={18} />{t('parent.syncState.' + st.state, { t: time, e: st.error, n: st.pending })}</button>;
}

/* ---------- Canjear ---------- */
function Redeem({ family, toast }: { family: Family; toast: (m: string) => void }) {
  const t = useT();
  const data = useLive(async () => {
    const kids = await db.children.toCollection().sortBy('createdAt');
    const bals: Record<string, number> = {};
    for (const k of kids) bals[k.id] = balanceOf(await db.events.where('childId').equals(k.id).toArray());
    return { kids, bals, rewards: (await db.rewards.toArray()).filter(r => r.active).sort((a, b) => a.cost - b.cost), events: await db.events.toArray(), cfg: await sync.getSyncConfig() };
  }, [], { kids: [] as Child[], bals: {} as Record<string, number>, rewards: [] as Reward[], events: [] as StarEvent[], cfg: null as Awaited<ReturnType<typeof sync.getSyncConfig>> });
  const [kidId, setKidId] = useState<string | null>(null);
  const [reward, setReward] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<null | { kind: 'redeem' } | { kind: 'fix'; ev: StarEvent }>(null);
  const kid = data.kids.find(k => k.id === kidId) ?? data.kids[0];
  if (!kid) return <div className="pbody"><h2>{t('parent.redeemTitle')}</h2></div>;
  const bal = data.bals[kid.id] ?? 0;
  const r = data.rewards.find(x => x.id === reward);
  const amount = r ? r.cost : parseInt(custom, 10) || 0;
  const what = r ? r.name : reason.trim() || t('parent.redeemDefault');
  const valid = amount > 0 && bal - amount >= 0;
  const hist = data.events.filter(e => e.childId === kid.id && (e.type === 'canje' || e.type === 'ajuste')).sort((a, b) => b.ts - a.ts);
  const fixed = new Set(data.events.filter(e => e.ref).map(e => e.ref));
  const remote = !!data.cfg;

  async function doPin(pin: string): Promise<string | null> {
    try {
      if (confirm?.kind === 'fix') {
        if (remote) await sync.compensateRemote(confirm.ev, pin);
        else { const c = await repo.checkPin(pin); if (!c.ok) return pinError(t, c); await repo.compensate(confirm.ev.id); }
        toast(t('parent.fixed', { n: -confirm.ev.amount }));
      } else {
        if (remote) await sync.redeemRemote(kid.id, amount, what, pin);
        else { const c = await repo.checkPin(pin); if (!c.ok) return pinError(t, c); await repo.redeemLocal(kid.id, amount, what); }
        toast(t('parent.done', { n: amount, name: kid.name }));
        setReward(null); setCustom(''); setReason('');
      }
      setConfirm(null);
      return null;
    } catch (e) {
      if (e instanceof sync.SyncError) {
        if (e.code === 'pin') return t('parent.wrong', { count: (e.info.triesLeft as number) ?? 0 });
        if (e.code === 'bloqueado') return t('parent.locked', { m: 15 });
        if (e.code === 'saldo') { setConfirm(null); toast(t('parent.notEnough')); return null; }
        if (e.code === 'offline') { setConfirm(null); toast(t('parent.needOnline')); return null; }
        setConfirm(null); toast(t('parent.syncErr.' + e.code)); return null;
      }
      if (e instanceof repo.RedeemError) { setConfirm(null); toast(t('parent.notEnough')); return null; }
      throw e;
    }
  }
  return (
    <>
      <div className="pbody">
        <h2>{t('parent.redeemTitle')}</h2>
        <p className="lead">{t('parent.redeemLead')}</p>
        <div className="kidsel" role="group">
          {data.kids.map(c => <button key={c.id} aria-pressed={kid.id === c.id} onClick={() => { setKidId(c.id); setReward(null); }}><Mascot child={c} />{c.name}<b className="gold">{fmtNum(data.bals[c.id] ?? 0)} ★</b></button>)}
        </div>
        <div className="balbig">{t('parent.balanceOf', { name: kid.name })}<b>{fmtNum(bal)} ★</b></div>
        <div className="caps">{t('parent.rewards')}</div>
        {data.rewards.map(x => (
          <button key={x.id} className="rrow" aria-pressed={reward === x.id} disabled={x.cost > bal} onClick={() => { setReward(reward === x.id ? null : x.id); setCustom(''); }}>
            <span>{x.name}{x.note && <small>{x.note}</small>}{x.cost > bal && <small>{t('parent.missing', { n: x.cost - bal })}</small>}</span><b>{fmtNum(x.cost)} ★</b>
          </button>
        ))}
        <div className="caps">{t('parent.other')}</div>
        <label className="field">{t('parent.amount')}<input type="text" inputMode="numeric" value={custom} placeholder={t('parent.amountPh')} onChange={e => { setCustom(e.target.value.replace(/\D/g, '').slice(0, 4)); setReward(null); }} /></label>
        <label className="field">{t('parent.reason')}<input type="text" value={reason} maxLength={40} placeholder={t('parent.reasonPh')} onChange={e => setReason(e.target.value)} /></label>
        <div className="sumbar">
          <div className="sb"><span>{what}</span><b className="gold">{amount ? '−' + fmtNum(amount) + ' ★' : '—'}</b></div>
          <div className="sb"><span className="muted">{t('parent.after')}</span><b>{amount ? fmtNum(bal - amount) + ' ★' : '—'}</b></div>
          {amount > 0 && bal - amount < 0 && <span style={{ color: 'var(--soft-fail)' }}>{t('parent.notEnough')}</span>}
          {remote && <span className="muted" style={{ fontSize: 13 }}>{t('parent.needOnline')}</span>}
          <button className="pbtn full" disabled={!valid} onClick={() => setConfirm({ kind: 'redeem' })}><Icon name="lock" size={20} /> {t('parent.confirmPin')}</button>
        </div>
        <div className="caps">{t('parent.history')}</div>
        <div className="hist">
          {hist.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('parent.noRedeems')}</p>}
          {hist.map(e => (
            <div className="led" key={e.id}>
              <span>{noteText(e.note, t)}<br /><span className="muted">{new Date(e.ts).toLocaleDateString(family.settings.lang, { weekday: 'short', day: 'numeric', month: 'short' })}</span></span>
              <span className="lr"><b className={e.amount >= 0 ? 'pos' : 'neg'}>{e.amount > 0 ? '+' : '−'}{fmtNum(Math.abs(e.amount))} ★</b>
                {e.type === 'canje' && !fixed.has(e.id) && <button className="link" onClick={() => setConfirm({ kind: 'fix', ev: e })}>{t('parent.fix')}</button>}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t('parent.immutable')}</p>
      </div>
      {confirm && (
        <>
          <button className="scrim" onClick={() => setConfirm(null)} aria-label={t('common.cancel')} />
          <div className="sheet-p" role="dialog">
            <b style={{ fontSize: 20 }}>{confirm.kind === 'fix' ? t('parent.fixTitle', { n: -confirm.ev.amount }) : t('parent.deduct', { n: amount, name: kid.name })}</b>
            <span className="muted">{t('parent.pinPrompt', { what: confirm.kind === 'fix' ? noteText(confirm.ev.note, t) : what })}</span>
            <PinPad len={family.pinLength} onDone={doPin} small />
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Ajustes ---------- */
function Stepper({ value, label, sub, onChange, min, max, step = 1, fmt }: { value: number; label: string; sub?: string; onChange: (v: number) => void; min: number; max: number; step?: number; fmt?: (v: number) => string }) {
  const t = useT();
  return (
    <div className="srow"><span className="lb">{label}{sub && <small>{sub}</small>}</span>
      <span className="stepper">
        <button onClick={() => onChange(Math.max(min, value - step))} aria-label={t('common.less')}>−</button>
        <b>{fmt ? fmt(value) : value}</b>
        <button onClick={() => onChange(Math.min(max, value + step))} aria-label={t('common.more')}>+</button>
      </span>
    </div>
  );
}
function Segs<T extends string | number | boolean>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <span className="segs">{options.map(([v, l]) => <button key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</span>;
}
function SettingsScreen({ family, toast, onExit }: { family: Family; toast: (m: string) => void; onExit: () => void }) {
  const t = useT();
  const kids = useLive(() => db.children.toCollection().sortBy('createdAt'), [], [] as Child[]);
  const rewards = useLive(async () => (await db.rewards.toArray()).filter(r => r.active).sort((a, b) => a.createdAt - b.createdAt), [], [] as Reward[]);
  const R = family.settings.rules;
  const setRules = (patch: Partial<typeof R>) => repo.updateSettings({ rules: { ...R, ...patch } });
  const [pin, setPin] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  return (
    <div className="pbody">
      <h2>{t('parent.settings')}</h2>
      <section className="sect"><h3>{t('parent.s.children')}</h3>
        {kids.map(k => (
          <div key={k.id} className="kidset">
            <div className="kidhd"><Mascot child={k} /><b>{k.name}</b></div>
            <Stepper label={t('parent.level')} value={k.level} min={1} max={6} onChange={v => repo.updateChild(k.id, { level: v })} />
            <div className="srow"><span className="lb">{t('parent.maxLen')}<small>{t('parent.maxLenSub')}</small></span>
              <Segs value={k.maxLen} options={[[10, '10'], [15, '15'], [20, '20']]} onChange={v => repo.updateChild(k.id, { maxLen: v as 10 | 15 | 20 })} /></div>
            <div className="srow"><span className="lb">{t('parent.childLang')}</span>
              <Segs value={k.lang} options={LANGS.map(l => [l, l.toUpperCase()] as [Lang, string])} onChange={v => repo.updateChild(k.id, { lang: v })} /></div>
            <div className="srow"><span className="lb">{t('parent.tone')}</span>
              <Segs value={k.tone} options={[['young', t('parent.toneYoung')], ['older', t('parent.toneOlder')]]} onChange={v => repo.updateChild(k.id, { tone: v })} /></div>
            <div className="srow"><span className="lb">{t('kid.bigText')}</span>
              <Segs value={!!k.bigText} options={[[true, t('common.on')], [false, t('common.off')]]} onChange={v => repo.updateChild(k.id, { bigText: v })} /></div>
            {confirmDel === k.id ? (
              <div className="sug warn"><span>{t('parent.deleteChildConfirm', { name: k.name })}</span>
                <div className="acts"><button className="pbtn" onClick={async () => { await repo.deleteChild(k.id); setConfirmDel(null); }}>{t('common.delete')}</button>
                  <button className="pbtn line" onClick={() => setConfirmDel(null)}>{t('common.cancel')}</button></div></div>
            ) : <button className="link" onClick={() => setConfirmDel(k.id)}>{t('parent.deleteChild', { name: k.name })}</button>}
          </div>
        ))}
        {kids.length < 3 && (adding ? <NewKidForm lang={family.settings.lang} onDone={async c => { if (c) await repo.addChild(c); setAdding(false); }} />
          : <button className="pbtn line" onClick={() => setAdding(true)}>{t('parent.addChild')}</button>)}
      </section>
      <section className="sect"><h3>{t('parent.s.stars')}</h3>
        <Stepper label={t('parent.perCorrect')} value={R.perCorrect} min={1} max={5} onChange={v => setRules({ perCorrect: v })} />
        <Stepper label={t('parent.passPct')} sub={t('parent.passPctSub')} value={R.passPct} min={50} max={100} step={5} fmt={v => v + ' %'} onChange={v => setRules({ passPct: v })} />
        {[10, 15, 20].map(n => <Stepper key={n} label={t('parent.pb', { n })} value={R.passBonus[n]} min={0} max={20} onChange={v => setRules({ passBonus: { ...R.passBonus, [n]: v } })} />)}
        <Stepper label={t('parent.perfect')} value={R.perfect} min={0} max={20} onChange={v => setRules({ perfect: v })} />
        {[3, 7, 14, 30].map(n => <Stepper key={n} label={t('parent.sb', { n })} value={R.streakBonus[n]} min={0} max={200} step={n === 30 ? 5 : 1} onChange={v => setRules({ streakBonus: { ...R.streakBonus, [n]: v } })} />)}
        <div className="srow"><span className="lb">{t('parent.maxLenAll')}</span><Segs value={R.maxLen} options={[[10, '10'], [15, '15'], [20, '20']]} onChange={v => setRules({ maxLen: v })} /></div>
      </section>
      <section className="sect"><h3>{t('parent.s.rewards')}</h3>
        {rewards.map(r => <RewardRow key={r.id} r={r} />)}
        <button className="pbtn line" style={{ marginTop: 8 }} onClick={() => repo.addReward({ name: t('parent.newReward'), cost: 50, note: '' })}>{t('parent.addReward')}</button>
      </section>
      <section className="sect"><h3>{t('parent.s.equiv')}</h3>
        <label className="field">{t('parent.equivSub')}<DeferredInput value={family.settings.equivalence} placeholder={t('parent.equivPh')} onCommit={v => repo.updateSettings({ equivalence: v })} /></label>
      </section>
      <section className="sect"><h3>{t('parent.s.streaks')}</h3>
        <div className="srow"><span className="lb">{t('parent.shieldsSet')}<small>{t('parent.shieldsSub')}</small></span>
          <Segs value={family.settings.shieldsOn} options={[[true, t('common.on')], [false, t('common.off')]]} onChange={v => repo.updateSettings({ shieldsOn: v })} /></div>
        <Stepper label={t('parent.dayStart')} sub={t('parent.dayStartSub')} value={family.settings.dayStartHour} min={0} max={8} fmt={v => v + ':00'} onChange={v => repo.updateSettings({ dayStartHour: v })} />
      </section>
      <section className="sect"><h3>{t('parent.s.lang')}</h3>
        <div className="srow"><span className="lb">{t('parent.s.lang')}</span>
          <Segs value={family.settings.lang} options={LANGS.map(l => [l, l.toUpperCase()] as [Lang, string])} onChange={v => repo.updateSettings({ lang: v })} /></div>
      </section>
      <section className="sect"><h3>{t('parent.s.pin')}</h3>
        <label className="field">{t('parent.newPin')}<input type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        <button className="pbtn" style={{ marginTop: 8 }} disabled={!validPin(pin)} onClick={async () => { await repo.changePin(pin); sync.elevate(pin); setPin(''); toast(t('parent.pinChanged')); }}>{t('parent.changePin')}</button>
      </section>
      <InstallSection />
      <SyncSection toast={toast} />
      <section className="sect"><h3>{t('parent.s.data')}</h3>
        <div className="btncol">
          <button className="pbtn line" onClick={downloadExport}>{t('parent.export')}</button>
          <button className="pbtn line" onClick={() => setPrivacy(true)}>{t('parent.privacy')}</button>
          {confirmDel === '*' ? <DeleteAll onCancel={() => setConfirmDel(null)} pinLen={family.pinLength} />
            : <button className="pbtn line danger" onClick={() => setConfirmDel('*')}>{t('parent.deleteAll')}</button>}
        </div>
      </section>
      <RestoreBackup onDone={() => toast(t('extra.restoreDone'))} />
      <button className="pbtn line" onClick={onExit}>{t('parent.logout')}</button>
      {privacy && <PrivacySheet onClose={() => setPrivacy(false)} />}
    </div>
  );
}
function DeferredInput({ value, placeholder, onCommit, ...rest }: { value: string; placeholder?: string; onCommit: (v: string) => void } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input type="text" {...rest} value={v} placeholder={placeholder} onChange={e => setV(e.target.value)} onBlur={() => { if (v !== value) onCommit(v); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}
function RewardRow({ r }: { r: Reward }) {
  const t = useT();
  return (
    <div className="rw-edit">
      <DeferredInput value={r.name} aria-label={t('parent.rewardName')} onCommit={v => v.trim() && repo.updateReward(r.id, { name: v.trim().slice(0, 40) })} />
      <DeferredInput value={String(r.cost)} inputMode="numeric" style={{ flex: '0 0 72px' }} aria-label={t('parent.rewardCost')} onCommit={v => { const n = parseInt(v.replace(/\D/g, ''), 10); if (n > 0) repo.updateReward(r.id, { cost: n }); }} />
      <button className="x" onClick={() => repo.updateReward(r.id, { active: false })} aria-label={t('parent.removeReward')}><Icon name="x" size={20} /></button>
    </div>
  );
}
export function NewKidForm({ lang, onDone }: { lang: Lang; onDone: (c: repo.NewChild | null) => void }) {
  const t = useT();
  const [c, setC] = useState<repo.NewChild>({ name: '', kind: 'zorro', petName: '', level: 1, lang });
  return (
    <div className="kidform">
      <label className="field">{t('onb.name')}<input type="text" maxLength={20} value={c.name} onChange={e => setC({ ...c, name: e.target.value })} /></label>
      <Stepper label={t('onb.level')} sub={t('onb.levelHelp')} value={c.level} min={1} max={6} onChange={v => setC({ ...c, level: v })} />
      <div className="srow"><span className="lb">{t('onb.companion')}</span><Segs value={c.kind} options={[['zorro', t('kind.zorro')], ['robot', t('kind.robot')]]} onChange={v => setC({ ...c, kind: v })} /></div>
      <label className="field">{t('onb.petName')}<input type="text" maxLength={12} value={c.petName} placeholder={c.kind === 'zorro' ? 'Chispa' : 'Bip'} onChange={e => setC({ ...c, petName: e.target.value })} /></label>
      <div className="srow"><span className="lb">{t('parent.childLang')}</span><Segs value={c.lang} options={LANGS.map(l => [l, l.toUpperCase()] as [Lang, string])} onChange={v => setC({ ...c, lang: v })} /></div>
      <div className="acts"><button className="pbtn" disabled={!c.name.trim()} onClick={() => onDone(c)}>{t('common.save')}</button><button className="pbtn line" onClick={() => onDone(null)}>{t('common.cancel')}</button></div>
    </div>
  );
}
function DeleteAll({ onCancel, pinLen }: { onCancel: () => void; pinLen: number }) {
  const t = useT();
  const cfg = useLive(() => sync.getSyncConfig(), [], null);
  return (
    <div className="sug warn">
      <span>{t('parent.deleteAllConfirm', { cloud: cfg ? t('parent.andCloud') : '' })}</span>
      <PinPad len={pinLen} small onDone={async pin => {
        const c = await repo.checkPin(pin);
        if (!c.ok) return pinError(t, c);
        try { if (cfg) await sync.deleteRemoteAccount(pin); } catch (e) { return t('parent.syncErr.' + (e instanceof sync.SyncError ? e.code : 'error')); }
        await repo.wipeAll(); location.hash = '#/';
        return null;
      }} />
      <button className="pbtn line" onClick={onCancel}>{t('common.cancel')}</button>
    </div>
  );
}
function PrivacySheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const paras = (rawRes('privacy.body') as string[]) ?? [];
  return (
    <>
      <button className="scrim" onClick={onClose} aria-label={t('common.close')} />
      <div className="sheet-p privacy" role="dialog">
        <b style={{ fontSize: 20 }}>{t('privacy.title')}</b>
        <div className="ptext">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
        <button className="pbtn full" onClick={onClose}>{t('common.close')}</button>
      </div>
    </>
  );
}
export { PrivacySheet };

/* ---------- Nube y otros dispositivos ---------- */
function SyncSection({ toast }: { toast: (m: string) => void }) {
  const t = useT();
  const cfg = useLive(() => sync.getSyncConfig(), [], null);
  const [url, setUrl] = useState(sync.defaultServer());
  const [email, setEmail] = useState(''), [pass, setPass] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try { await f(); } catch (e) { toast(t('parent.syncErr.' + (e instanceof sync.SyncError ? e.code : 'error'))); } finally { setBusy(false); }
  };
  return (
    <section className="sect"><h3>{t('parent.s.sync')}</h3>
      {!cfg ? (
        <>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 14 }}>{t('parent.syncOff')}</p>
          <label className="field">{t('parent.syncUrl')}<input type="text" inputMode="url" value={url} onChange={e => setUrl(e.target.value.trim())} placeholder="https://" /></label>
          <label className="field">{t('parent.email')}<input type="text" inputMode="email" value={email} onChange={e => setEmail(e.target.value.trim())} /></label>
          <label className="field">{t('parent.password')}<input type="password" value={pass} onChange={e => setPass(e.target.value)} /></label>
          <div className="acts" style={{ marginTop: 8 }}>
            <button className="pbtn" disabled={busy || !url || !email || pass.length < 8} onClick={() => run(() => sync.register(url, email, pass))}>{t('parent.register')}</button>
            <button className="pbtn line" disabled={busy || !url || !email || !pass} onClick={() => run(() => sync.login(url, email, pass))}>{t('parent.login')}</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 6px', fontSize: 15 }}>{cfg.role === 'parent' ? t('parent.syncOnAs', { email: cfg.email }) : t('parent.syncTablet')}<br /><small className="muted">{cfg.url}</small></p>
          <SyncPill />
          <div className="btncol" style={{ marginTop: 8 }}>
            {cfg.role === 'parent' && <button className="pbtn" disabled={busy} onClick={() => run(async () => setCode((await sync.pairCreate()).code))}>{t('parent.pairCreate')}</button>}
            {code && <div className="paircode">{t('parent.pairCode')}<b>{code}</b></div>}
            <button className="pbtn line" disabled={busy} onClick={() => run(() => sync.syncNow())}>{t('parent.syncNow')}</button>
            <button className="pbtn line" onClick={() => run(() => sync.unlink())}>{t('parent.unlink')}</button>
          </div>
        </>
      )}
    </section>
  );
}
