/* Primera vez: idioma y consentimiento del adulto, PIN, hijos (1 a 3). O vincular el dispositivo
   a una familia que ya existe en la nube (tablet con código, móvil con email).            */
import { useEffect, useState } from 'react';
import * as repo from '../../data/repo';
import type { Lang } from '../../data/types';
import { LANGS } from '../../data/types';
import { validPin } from '../../data/pin';
import * as sync from '../../sync/client';
import { useT, setLang } from '../../i18n';
import { Mascot, ParentStage } from '../common';
import { NewKidForm, PrivacySheet } from './ParentApp';
import { RestoreBackup } from './Extras';
import markUrl from '../../assets/mark.svg';
import wordUrl from '../../assets/wordmark.svg';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [step, setStep] = useState<'start' | 'pin' | 'kids' | 'link' | 'restore'>('start');
  const [lang, setL] = useState<Lang>(() => (LANGS.find(l => navigator.language.startsWith(l)) ?? 'es'));
  const [ok, setOk] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [pin, setPin] = useState(''), [pin2, setPin2] = useState('');
  const [kids, setKids] = useState<repo.NewChild[]>([]);
  const [adding, setAdding] = useState(true);
  const [busy, setBusy] = useState(false);
  const chooseLang = (l: Lang) => { setL(l); setLang(l); };
  useEffect(() => { setLang(lang); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (step === 'start') body = (
    <>
      <div className="onbbrand"><img src={markUrl} alt="" width={72} height={72} /><img src={wordUrl} alt="Mathzilo" height={34} /></div>
      <h2>{t('onb.welcome')}</h2>
      <p className="lead">{t('onb.lead')}</p>
      <div className="caps">{t('onb.langQ')}</div>
      <div className="langgrid">{LANGS.map(l => <button key={l} className="rrow" aria-pressed={lang === l} onClick={() => chooseLang(l)}>{t('lang.' + l)}</button>)}</div>
      <label className="check"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} /> <span>{t('onb.accept')}</span></label>
      <button className="link" onClick={() => setPrivacy(true)}>{t('parent.privacy')}</button>
      <button className="pbtn full" disabled={!ok} onClick={() => setStep('pin')}>{t('onb.next')}</button>
      <button className="link" onClick={() => setStep('link')}>{t('onb.haveAccount')}</button>
      <button className="link" onClick={() => setStep('restore')}>{t('extra.restoreOnb')}</button>
    </>
  );
  else if (step === 'pin') body = (
    <>
      <h2>{t('onb.pinTitle')}</h2>
      <p className="lead">{t('onb.pinLead')}</p>
      <label className="field">{t('onb.pin')}<input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
      <label className="field">{t('onb.pinRepeat')}<input type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
      <p className="err">{pin2.length >= pin.length && pin2 && pin !== pin2 ? t('onb.pinMismatch') : ''}</p>
      <button className="pbtn full" disabled={!validPin(pin) || pin !== pin2} onClick={() => setStep('kids')}>{t('onb.next')}</button>
      <button className="pbtn line" onClick={() => setStep('start')}>{t('common.back')}</button>
    </>
  );
  else if (step === 'kids') body = (
    <>
      <h2>{t('onb.kidsTitle')}</h2>
      <p className="lead">{t('onb.kidsLead')}</p>
      {kids.map((k, i) => (
        <div key={i} className="kidcard static"><div className="hd"><Mascot child={{ kind: k.kind, petName: k.petName || (k.kind === 'zorro' ? 'Chispa' : 'Bip'), bestStreak: 0 }} />
          <div><div className="nm">{k.name}</div><div className="muted">{t('kid.level', { n: k.level })} · {k.petName || (k.kind === 'zorro' ? 'Chispa' : 'Bip')}</div></div>
          <button className="link" style={{ marginLeft: 'auto' }} onClick={() => setKids(kids.filter((_, j) => j !== i))}>{t('common.delete')}</button></div></div>
      ))}
      {adding && kids.length < 3 ? <NewKidForm lang={lang} onDone={c => { if (c) setKids([...kids, c]); setAdding(false); }} />
        : kids.length < 3 && <button className="pbtn line" onClick={() => setAdding(true)}>{t('onb.addKid')}</button>}
      <button className="pbtn full" disabled={!kids.length || busy} onClick={async () => {
        setBusy(true);
        await repo.createFamily({ lang, pin, children: kids });
        onDone();
      }}>{t('onb.finish')}</button>
    </>
  );
  else if (step === 'restore') body = (
    <>
      <h2>{t('extra.restoreTitle')}</h2>
      <RestoreBackup compact onDone={onDone} />
      <button className="pbtn line" onClick={() => setStep('start')}>{t('common.back')}</button>
    </>
  );
  else body = <LinkDevice onBack={() => setStep('start')} onDone={onDone} />;

  return (
    <ParentStage>
      <div className="pscr"><div className="pbody onb">{body}</div>{privacy && <PrivacySheet onClose={() => setPrivacy(false)} />}</div>
    </ParentStage>
  );
}

function LinkDevice({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<'tablet' | 'parent'>('tablet');
  const [url, setUrl] = useState(sync.defaultServer());
  const [code, setCode] = useState(''), [email, setEmail] = useState(''), [pass, setPass] = useState('');
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr('');
    try {
      if (mode === 'tablet') await sync.pairClaim(url, code); else await sync.login(url, email, pass);
      if (!(await repo.getFamily())) throw new sync.SyncError('vacia');
      onDone();
    } catch (e) { setErr(t('parent.syncErr.' + (e instanceof sync.SyncError ? e.code : 'error'))); }
    finally { setBusy(false); }
  }
  return (
    <>
      <h2>{t('onb.linkTitle')}</h2>
      <div className="langgrid">
        <button className="rrow" aria-pressed={mode === 'tablet'} onClick={() => setMode('tablet')}>{t('onb.linkTablet')}</button>
        <button className="rrow" aria-pressed={mode === 'parent'} onClick={() => setMode('parent')}>{t('onb.linkParent')}</button>
      </div>
      <label className="field">{t('parent.syncUrl')}<input type="text" inputMode="url" value={url} onChange={e => setUrl(e.target.value.trim())} placeholder="https://" /></label>
      {mode === 'tablet'
        ? <label className="field">{t('onb.code')}<input type="text" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        : <>
            <label className="field">{t('parent.email')}<input type="text" inputMode="email" value={email} onChange={e => setEmail(e.target.value.trim())} /></label>
            <label className="field">{t('parent.password')}<input type="password" value={pass} onChange={e => setPass(e.target.value)} /></label>
          </>}
      <p className="err">{err}</p>
      <button className="pbtn full" disabled={busy || !url || (mode === 'tablet' ? code.length !== 6 : !email || !pass)} onClick={go}>{t('onb.link')}</button>
      <button className="pbtn line" onClick={onBack}>{t('common.back')}</button>
    </>
  );
}
