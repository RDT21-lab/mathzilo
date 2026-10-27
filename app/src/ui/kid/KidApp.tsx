/* Modo niño (tablet en horizontal): perfiles → inicio → longitud → preguntas → resultado.
   Un solo objetivo por pantalla, botones de 56 px o más, sin rojo ni sonido de fallo.     */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { db } from '../../data/db';
import * as repo from '../../data/repo';
import type { ActiveTest, Child, Family, Lang, Session } from '../../data/types';
import { LANGS } from '../../data/types';
import { balanceOf, computeStreak, dayOf, addDays, roundStars, FAST_MS, FAST_RUN } from '../../data/domain';
import { explain, inputToVal, isCorrect, makeQuestion, similar, tagFor, valKey, type Explanation, type Question, type Val } from '../../engine';
import i18n, { useT, setLang, renderTpl, tplText, ValView, valText, noteText, fmtNum } from '../../i18n';
import markUrl from '../../assets/mark.svg';
import wordUrl from '../../assets/wordmark.svg';
import { Icon, KidStage, Mascot, useLive, useToast, Toast, stageFor, STAGE_STREAK, type Emo, EMOS } from '../common';
import { VisualView } from '../visuals';
import { playOk, playWin } from '../../sound';

type Screen = 'profiles' | 'home' | 'length' | 'question' | 'result' | 'mascot' | 'tasks';

export function KidApp({ family, onParent, needRefresh, onRefresh }: { family: Family; onParent: () => void; needRefresh: boolean; onRefresh: () => void }) {
  const [screen, setScreen] = useState<Screen>('profiles');
  const [childId, setChildId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'stars' | 'settings'>(null);
  const [active, setActive] = useState<ActiveTest | null>(null);
  const [result, setResult] = useState<repo.FinishResult | null>(null);
  const [toast, setToast] = useToast();
  const children = useLive(() => db.children.toCollection().sortBy('createdAt'), [], [] as Child[]);
  const child = children.find(c => c.id === childId) ?? null;

  useEffect(() => { if (child) setLang(child.lang); else setLang(family.settings.lang); }, [child?.lang, family.settings.lang, child]);
  useEffect(() => { if (childId && !child && children.length) { setChildId(null); setScreen('profiles'); } }, [children, child, childId]);

  const go = (s: Screen) => { setSheet(null); setScreen(s); };

  let body;
  if (!child || screen === 'profiles') body = <Profiles children={children} family={family} onPick={c => { setChildId(c.id); go('home'); }} onParent={onParent} needRefresh={needRefresh} onRefresh={onRefresh} />;
  else if (screen === 'home') body = <Home child={child} family={family} onStart={go} onSheet={setSheet} onResume={a => { setActive(a); go('question'); }} />;
  else if (screen === 'length') body = <Length child={child} family={family} onBack={() => go('home')} onSheet={setSheet}
                                   onStart={async n => { setActive(await repo.startTest(child, n)); go('question'); }} />;
  else if (screen === 'question' && active) body = <QuestionScreen child={child} active={active} toast={setToast}
                                   onPause={() => { setToast(i18n.t('kid.paused')); go('home'); }}
                                   onDone={r => { setResult(r); if (child.sound && r.score.passed) playWin(); go('result'); }} />;
  else if (screen === 'result' && result) body = <Result child={child} family={family} r={result} onGo={go} onSheet={setSheet} />;
  else if (screen === 'mascot') body = <MascotScreen child={child} onBack={() => go('home')} onSheet={setSheet} />;
  else if (screen === 'tasks') body = <TasksScreen child={child} family={family} onBack={() => go('home')} onSheet={setSheet} toast={setToast} />;
  else body = <Home child={child} family={family} onStart={go} onSheet={setSheet} onResume={a => { setActive(a); go('question'); }} />;

  return (
    <KidStage big={!!child?.bigText}>
      {body}
      {child && sheet === 'stars' && <StarsSheet child={child} onClose={() => setSheet(null)} />}
      {child && sheet === 'settings' && <KidSettings child={child} onClose={() => setSheet(null)} />}
      <Toast msg={toast} />
    </KidStage>
  );
}

/* ---------- Cabecera ---------- */
function Top({ child, left, onSheet, onProfiles, onTasks, family }: { child?: Child; left?: React.ReactNode; onSheet?: (s: 'stars' | 'settings') => void; onProfiles?: () => void;
                                                     onTasks?: () => void; family?: Family }) {
  const t = useT();
  const bal = useLive(async () => child ? balanceOf(await db.events.where('childId').equals(child.id).toArray()) : 0, [child?.id], 0);
  const board = useLive(async () => child && family && onTasks ? repo.taskBoard(child, dayOf(Date.now(), family.settings.dayStartHour)) : null,
                        [child?.id, child?.taskDays, family?.settings.dayStartHour, !!onTasks], null);
  return (
    <div className="top">
      <div className="l">{left ?? <Brand />}</div>
      {child && onSheet && (
        <div className="r">
          {board && board.items.length > 0 && (
            <button className={'pill tpill' + (board.approved === board.items.length ? ' ok' : '')} onClick={onTasks}
                    aria-label={t('kid.tasksTitle') + ': ' + t('kid.tasksDone', { a: board.approved, n: board.items.length })}>
              <Icon name="list" size={22} />{t('kid.tasksPill')} {board.approved}/{board.items.length}
            </button>
          )}
          <button className="pill gold" onClick={() => onSheet('stars')} aria-label={t('kid.myStars')}><Icon name="star" size={22} />{fmtNum(bal)}</button>
          <button className="icon-btn" onClick={() => onSheet('settings')} aria-label={t('kid.settingsTitle')}><Icon name="gear" size={26} /></button>
          {onProfiles && <button className="icon-btn" onClick={onProfiles} aria-label={t('kid.switch')}><Icon name="users" size={26} /></button>}
        </div>
      )}
    </div>
  );
}
export function Brand() {
  return <div className="brand-in"><img className="mk" src={markUrl} alt="" /><img className="wm" src={wordUrl} alt="Mathzilo" /></div>;
}
function BackBtn({ onClick }: { onClick: () => void }) {
  const t = useT();
  return <button className="icon-btn" onClick={onClick} aria-label={t('common.back')}><Icon name="back" size={26} /></button>;
}

/* ---------- Perfiles ---------- */
function Profiles({ children, family, onPick, onParent, needRefresh, onRefresh }: { children: Child[]; family: Family; onPick: (c: Child) => void; onParent: () => void; needRefresh: boolean; onRefresh: () => void }) {
  const t = useT();
  const info = useLive(async () => {
    const out: Record<string, ProfileInfo> = {};
    const today = dayOf(Date.now(), family.settings.dayStartHour);
    for (const c of children) {
      const sessions = await db.sessions.where('childId').equals(c.id).toArray();
      const s = computeStreak(sessions, today, family.settings.shieldsOn, c.bestStreak);
      const last = [...sessions].sort((a, b) => b.endedAt - a.endedAt)[0];
      const week = sessions.filter(x => x.endedAt > Date.now() - 7 * 86400_000);
      const qs = week.reduce((n, x) => n + x.length, 0);
      out[c.id] = { bal: balanceOf(await db.events.where('childId').equals(c.id).toArray()), streak: s.streak, last,
                    weekPct: qs ? Math.round(week.reduce((n, x) => n + x.correct, 0) / qs * 100) : null, board: await repo.taskBoard(c, today) };
    }
    return out;
  }, [children, family], {});
  return (
    <div className="tscr">
      <Top />
      <h1 className="ttl">{t('kid.who')}</h1>
      <p className="sub">{t('kid.whoSub')}</p>
      <div className="pcards">
        {children.map((c, i) => (
          <button key={c.id} className="pcard pop" style={{ ['--i' as string]: i }} onClick={() => onPick(c)} aria-label={t('kid.play', { name: c.name })}>
            <Mascot child={c} style={{ width: 120, height: 120 }} />
            <span className="nm">{c.name}</span>
            <span className="row">
              <span className="chip">{t('kid.level', { n: c.level })}</span>
              <span className="chip"><Icon name="flame" size={16} className="gold" />{info[c.id]?.streak ? t('kid.days', { count: info[c.id].streak }) : t('kid.newStreak')}</span>
            </span>
            <span className="pstar"><Icon name="star" size={28} />{fmtNum(info[c.id]?.bal ?? 0)}<small>{t('kid.available')}</small></span>
            <ProfileStats info={info[c.id]} />
          </button>
        ))}
      </div>
      <div className="corner">
        {needRefresh && <button className="pill gold" onClick={onRefresh}>{t('kid.update')}</button>}
        <button className="pill" onClick={onParent}><Icon name="lock" size={20} />{t('kid.parentMode')}</button>
      </div>
    </div>
  );
}

interface ProfileInfo { bal: number; streak: number; last?: Session; weekPct: number | null; board: repo.TaskBoard }
function ProfileStats({ info }: { info?: ProfileInfo }) {
  const t = useT();
  if (!info) return <span className="pinfo" />;
  const b = info.board, n = b.items.length;
  return (
    <span className="pinfo">
      <span className="pl"><span>{t('kid.lastTestL')}</span><b className={info.last ? (info.last.passed ? 'ok' : '') : 'muted'}>{info.last ? info.last.correct + '/' + info.last.length : '—'}</b></span>
      <span className="pl"><span>{t('kid.weekL')}</span><b className={info.weekPct === null ? 'muted' : ''}>{info.weekPct === null ? '—' : fmtNum(info.weekPct) + ' %'}</b></span>
      {n > 0 && (
        <span className="pl"><span>{t('kid.tasksL')}</span>
          <b className={b.approved === n ? 'ok' : ''}>{b.approved}/{n}{b.claimed > 0 && <span className="wait"> · <Icon name="clock" size={15} />{b.claimed}</span>}</b>
        </span>
      )}
    </span>
  );
}

/* ---------- Inicio ---------- */
function useChildState(child: Child, family: Family) {
  return useLive(async () => {
    const sessions = await db.sessions.where('childId').equals(child.id).toArray();
    const today = dayOf(Date.now(), family.settings.dayStartHour);
    const streak = computeStreak(sessions, today, family.settings.shieldsOn, child.bestStreak);
    const bal = balanceOf(await db.events.where('childId').equals(child.id).toArray());
    const rewards = (await db.rewards.toArray()).filter(r => r.active).sort((a, b) => a.cost - b.cost);
    const active = await repo.getActive(child.id);
    return { streak, bal, rewards, active, today };
  }, [child.id, child.bestStreak, family], null);
}
function WeekDots({ states, today, small }: { states: Record<string, string>; today: string; small?: boolean }) {
  const t = useT();
  const letters = t('kid.weekLetters');
  return (
    <div className="week">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(today, i - 6);
        const st = states[d] ?? (d === today ? 'today' : 'none');
        const cls = st === 'none' ? 'miss' : st;
        const dow = new Date(d + 'T12:00:00').getDay();
        return (
          <div className="day" key={d}>
            <span className={'dot ' + cls} role="img" style={small ? { width: 32, height: 32 } : undefined}
                  aria-label={new Date(d + 'T12:00:00').toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric' }) + ': ' + t('kid.state.' + st)}>
              {st === 'done' && <Icon name="check" size={small ? 16 : 22} />}{st === 'shield' && <Icon name="shield" size={small ? 14 : 20} />}
            </span>
            {i === 6 ? t('kid.today') : letters[dow]}
          </div>
        );
      })}
    </div>
  );
}
export { WeekDots };

function Home({ child, family, onStart, onSheet, onResume }: { child: Child; family: Family; onStart: (s: Screen) => void; onSheet: (s: 'stars' | 'settings') => void; onResume: (a: ActiveTest) => void }) {
  const t = useT();
  const st = useChildState(child, family);
  if (!st) return <div className="tscr" />;
  const { streak, bal, rewards, active } = st;
  const stage = stageFor(Math.max(child.bestStreak, streak.best));
  const goal = rewards.find(r => r.cost > bal) ?? rewards[rewards.length - 1];
  const milestone = [3, 7, 14, 30].includes(streak.streak + 1) && !streak.passedToday;
  const msg = streak.doneToday ? t('kid.doneToday', { name: child.name })
    : streak.rested ? t('kid.rested', { n: streak.rested })
    : milestone ? t('kid.helloMilestone', { name: child.name, n: streak.streak + 1 })
    : t('kid.hello', { name: child.name, pet: child.petName });
  const pct = goal ? Math.min(100, Math.round((bal / goal.cost) * 100)) : 0;
  return (
    <div className="tscr">
      <Top child={child} family={family} onSheet={onSheet} onProfiles={() => onStart('profiles')} onTasks={() => onStart('tasks')} />
      <div className="home">
        <div className="stagepane">
          <div className="bubble rise">{msg}</div>
          <div className="planet" />
          <Mascot child={child} emo={streak.doneToday ? 'animando' : 'contenta'} />
          <button className="pill nametag" onClick={() => onStart('mascot')} aria-label={t('kid.mascot', { pet: child.petName })}>
            {child.petName} · <span className="gold">{t('stage.' + stage)}</span>
          </button>
        </div>
        <div className="rcol">
          <section className="card streak rise d1" aria-label={t('kid.streakTitle')}>
            <div className="hd">
              <Icon name="flame" size={44} className="gold" />
              <span className="big">{streak.streak}</span>
              <div><b style={{ fontSize: 20 }}>{t('kid.streakDays', { count: streak.streak })}</b><div className="muted">{t('kid.record', { count: streak.best })}</div></div>
            </div>
            <WeekDots states={streak.states} today={st.today} />
            <div className="shields">
              {[0, 1].map(i => <Icon key={i} name="shield" size={22} className={'sh' + (i < streak.shields ? '' : ' off')} />)}
              <span>{family.settings.shieldsOn ? (streak.shields ? t('kid.shieldsHave', { n: streak.shields }) : t('kid.shieldsNone')) : t('kid.shieldsOff')}</span>
            </div>
          </section>
          <button className="card starscard rise d2 plain" onClick={() => onSheet('stars')}>
            <div className="hd"><span className="num">{fmtNum(bal)}</span><b style={{ fontSize: 22 }}>{t('kid.stars')}</b></div>
            <div className="bar" role="progressbar" aria-label={goal ? goal.name : t('kid.stars')} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>
            <span className="muted">{!goal ? t('kid.noGoal') : bal >= goal.cost ? t('kid.goalReady', { name: goal.name }) : t('kid.goal', { name: goal.name, n: fmtNum(roundStars(goal.cost - bal)) })}</span>
          </button>
          <div className="cta">
            {active ? (
              <div className="resume">
                <span className="muted">{t('kid.resumeInfo', { i: active.i + 1, n: active.n })}</span>
                <div className="resbtns">
                  <button className="btn btn-line" onClick={async () => { await repo.dropActive(child.id); onStart('length'); }}>{t('kid.newTest')}</button>
                  <button className="btn btn-gold" onClick={() => onResume(active)}><Icon name="play" size={26} />{t('kid.resume')}</button>
                </div>
              </div>
            ) : streak.doneToday
              ? <button className="btn btn-line" onClick={() => onStart('length')}>{t('kid.practice')}</button>
              : <button className="btn btn-gold" onClick={() => onStart('length')}><Icon name="play" size={30} />{t('kid.start')}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Longitud ---------- */
function Length({ child, family, onBack, onStart, onSheet }: { child: Child; family: Family; onBack: () => void; onStart: (n: number) => void; onSheet: (s: 'stars' | 'settings') => void }) {
  const t = useT();
  const st = useChildState(child, family);
  const practice = !!st?.streak.doneToday;
  const max = Math.min(child.maxLen, family.settings.rules.maxLen);
  return (
    <div className="tscr">
      <Top child={child} onSheet={onSheet} left={<BackBtn onClick={onBack} />} />
      <h1 className="ttl">{t('kid.howMany')}</h1>
      <div className="lens">
        {[10, 15, 20].map((n, i) => {
          const dis = n > max;
          return (
            <button key={n} className="lencard pop" style={{ ['--i' as string]: i }} disabled={dis} onClick={() => onStart(n)}>
              <span className="n">{n}</span><span className="u">{t('kid.questions')}</span>
              <span className="muted">{dis ? t('kid.limited') : t('kid.minutes', { n: Math.round(n * 0.5) })}</span>
              {!practice && !dis && <span className="chip gold"><Icon name="star" size={16} />{t('kid.bonus', { n: family.settings.rules.passBonus[n] ?? 0 })}</span>}
            </button>
          );
        })}
      </div>
      <p className="note">{practice ? t('kid.notePractice') : t('kid.notePass', { p: family.settings.rules.passPct })}</p>
    </div>
  );
}

/* ---------- Pregunta ---------- */
type Phase = 'ask' | 'ok' | 'fail' | 'mini' | 'miniok' | 'minifail';
const BIG_PROMPTS = /^(add|sub|mul|div|addN|subN|cmp|series|pow|sqrt|gcd|lcm|fracOf|fracEquiv|pct)$/;

export function PromptView({ q, reveal }: { q: Question; reveal: boolean }) {
  const t = useT();
  const text = tplText('q.' + q.prompt.key, q.prompt.vars);
  const hasSlot = text.includes('?');
  const len = text.length;
  const size = BIG_PROMPTS.test(q.prompt.key) ? (len <= 13 ? 70 : len <= 18 ? 58 : len <= 26 ? 44 : 34) : (len <= 30 ? 34 : len <= 70 ? 27 : 23);
  const ans = <span className="ans"><ValView v={q.answer} /></span>;
  const ref = useRef<HTMLDivElement>(null);
  // Encoge el enunciado hasta que quepa en la tarjeta (los textos alemanes son los más largos)
  useLayoutEffect(() => {
    const el = ref.current, card = el?.closest('.qcard') as HTMLElement | null;
    if (!el) return;
    let s = size;
    el.style.fontSize = s + 'px';
    while (s > 18 && (el.scrollWidth > el.clientWidth + 1 || (card && card.scrollHeight > card.clientHeight + 1))) { s -= 2; el.style.fontSize = s + 'px'; }
  }, [size, reveal, q]);
  return (
    <>
      <div ref={ref} className={'qtext' + (BIG_PROMPTS.test(q.prompt.key) ? '' : ' wrap')} style={{ fontSize: size }} aria-live="polite">
        {renderTpl('q.' + q.prompt.key, q.prompt.vars, reveal ? ans : '?')}
      </div>
      {!hasSlot && reveal && <div className="qanswer">{t('kid.answerIs')}{ans}</div>}
      {q.prompt.key.startsWith('place') && <div className="legend">{t('q.pvLegend')}</div>}
    </>
  );
}

const PADS: Record<string, string | null> = { int: null, dec: 'dec', money: 'dec', frac: '/', neg: '-' };

function QuestionScreen({ child, active: initial, onPause, onDone, toast }: { child: Child; active: ActiveTest; onPause: () => void; onDone: (r: repo.FinishResult) => void; toast: (m: string) => void }) {
  const t = useT();
  const [active, setActive] = useState<ActiveTest>(initial);
  const [shown, setShown] = useState(initial.i);            // pregunta en pantalla (puede ir por detrás de active.i durante la explicación)
  const [phase, setPhase] = useState<Phase>('ask');
  const [sel, setSel] = useState<number | null>(null);
  const [entry, setEntry] = useState('');
  const [given, setGiven] = useState<Val | string | null>(null);
  const [expl, setExpl] = useState<Explanation | null>(null);
  const [mini, setMini] = useState<Question | null>(null);
  const [shownAt, setShownAt] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const main = useMemo(() => makeQuestion(active.qs[Math.min(shown, active.n - 1)].gen, active.qs[Math.min(shown, active.n - 1)].seed), [active.qs, shown, active.n]);
  const isMini = phase === 'mini' || phase === 'miniok' || phase === 'minifail';
  const q = isMini && mini ? mini : main;
  const feedback = phase !== 'ask' && phase !== 'mini';
  const decSym = t('sym.dec');

  function pick(): Val | string | null {
    if (q.type === 'num') return entry ? entry.replace(',', '.').replace('−', '-') : null;
    return sel === null ? null : q.options[sel].v;
  }
  async function check() {
    const g = pick();
    if (g === null || busy) return;
    const ok = isCorrect(q, g);
    setGiven(g);
    if (phase === 'mini') { setPhase(ok ? 'miniok' : 'minifail'); if (ok && child.sound) playOk(); return; }
    const ms = Date.now() - shownAt;
    const quick = ms < FAST_MS ? active.quick + 1 : 0;
    let fast = active.fast;
    if (quick >= FAST_RUN && !fast) { fast = true; toast(t('kid.slow', { pet: child.petName })); }
    const tag = tagFor(q, g);
    const next: ActiveTest = { ...active, i: active.i + 1, quick, fast,
      answers: [...active.answers, { skill: q.gen, seed: q.seed, given: typeof g === 'string' ? g : valKey(g), ok, ms, tag }] };
    setActive(next);
    await repo.saveActive(next);                                 // si la app se cierra aquí, no se pierde nada
    if (ok) { setPhase('ok'); if (child.sound) playOk(); }
    else {
      setPhase('fail');
      setExpl(explain(q, tag, typeof g === 'string' ? inputToVal(q, g) : g));
    }
  }
  async function next() {
    if (busy) return;
    if (active.i >= active.n) { setBusy(true); onDone(await repo.finishTest(active)); return; }
    setShown(active.i); setPhase('ask'); setSel(null); setEntry(''); setGiven(null); setExpl(null); setMini(null); setShownAt(Date.now());
  }
  function understood() {
    setFlagged(false);
    setMini(similar(main, Math.floor(Math.random() * 1e9)));
    setPhase('mini'); setSel(null); setEntry(''); setGiven(null);
  }
  function key(k: string) {
    setEntry(e => {
      if (k === 'del') return e.slice(0, -1);
      if (e.length >= 7) return e;
      if (k === 'dec') return e.includes(decSym) || e.includes('/') ? e : (e || '0') + decSym;
      if (k === '/') return !e || e.includes('/') || e.includes(decSym) ? e : e + '/';
      if (k === '-') return e.startsWith('−') ? e.slice(1) : '−' + e;
      return (e === '0' ? '' : e) + k;
    });
  }
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      const asking = phase === 'ask' || phase === 'mini';
      if (asking && q.type === 'num' && /^[0-9]$/.test(ev.key)) key(ev.key);
      else if (asking && q.type === 'num' && ev.key === 'Backspace') key('del');
      else if (asking && q.type === 'num' && (ev.key === ',' || ev.key === '.') && PADS[q.pad] === 'dec') key('dec');
      else if (asking && q.type === 'num' && ev.key === '/' && q.pad === 'frac') key('/');
      else if (asking && q.type === 'num' && ev.key === '-' && q.pad === 'neg') key('-');
      else if (asking && q.type === 'mc' && /^[1-4]$/.test(ev.key) && +ev.key <= q.options.length) setSel(+ev.key - 1);
      else if (ev.key === 'Enter') { if (asking) check(); else if (phase === 'fail') understood(); else next(); }
      else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const doneCount = phase === 'ask' ? shown : active.i;
  const emo: Emo = phase === 'ok' || phase === 'miniok' ? 'animando' : feedback ? 'pensando' : 'contenta';
  const wrongShown = phase === 'fail' || phase === 'minifail';
  const last = active.i >= active.n;
  const optLong = q.options.some(o => valText(o.v).length > 5);

  let right;
  if (phase === 'ok') {
    right = (
      <div className="fbcard ok">
        <div className="big"><Icon name="check" size={44} /> {t('praise.' + (shown % 6))}</div>
        {active.practice ? <p className="muted">{t('kid.practiceOk')}</p> : <div className="stars-plus">+1 ★</div>}
        <p>{t('kid.okSay', { pet: child.petName })}</p>
        <button className="btn btn-gold" onClick={next} disabled={busy}>{last ? t('kid.seeResult') : t('kid.next')}<Icon name="arrow" size={26} /></button>
      </div>
    );
  } else if (phase === 'fail' && expl) {
    const vkey = expl.tagVars.p !== undefined ? '-xyp' : expl.tagVars.x !== undefined ? '-xy' : '';
    right = (
      <div className="fbcard">
        <h3>{t('kid.lead')}</h3>
        <p>{renderTpl('tag.' + child.tone + '.' + expl.tag + vkey, expl.tagVars)}</p>
        {expl.visual && <div className="vis"><VisualView v={expl.visual} size="sm" /></div>}
        <ol className="steps">{expl.steps.map((s, i) => <li key={i}><span>{renderTpl(s.k, s.v)}</span></li>)}</ol>
        <div className="fbbtns">
          <button className="btn btn-line" disabled={flagged} onClick={async () => { setFlagged(true); await repo.addFlag(child, q.gen, expl.tag); toast(t('kid.flagThanks')); }}>{flagged ? '✓ ' : ''}{t('kid.dontGet')}</button>
          <button className="btn btn-ok" onClick={understood}>{t('kid.understood')}</button>
        </div>
      </div>
    );
  } else if (phase === 'miniok' || phase === 'minifail') {
    right = (
      <div className="fbcard ok">
        {phase === 'miniok' ? <><div className="big"><Icon name="check" size={44} /> {t('kid.miniOk')}</div><p>{t('kid.miniOkSub')}</p></>
          : <><h3>{t('kid.miniFail')}</h3><p>{t('kid.miniFailSub', { v: valText(q.answer) })}</p></>}
        <button className="btn btn-gold" onClick={next} disabled={busy}>{last ? t('kid.seeResult') : t('kid.goOn')}<Icon name="arrow" size={26} /></button>
      </div>
    );
  } else if (q.type === 'num') {
    const extra = PADS[q.pad];
    right = (
      <div className="answers">
        <div className={'numdisplay' + (entry ? '' : ' empty')} aria-live="polite">{entry || t('kid.type')}</div>
        <div className="numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} className="nk" onClick={() => key(String(n))}>{n}</button>)}
          {extra ? <button className="nk" onClick={() => key(extra)} aria-label={extra}>{extra === 'dec' ? decSym : extra === '-' ? '−' : '/'}</button> : <span />}
          <button className="nk" onClick={() => key('0')}>0</button>
          <button className="nk del" onClick={() => key('del')} aria-label={t('kid.delete')}><Icon name="del" size={30} /></button>
        </div>
        <button className="btn btn-gold" onClick={check} disabled={!entry}>{t('kid.check')}</button>
      </div>
    );
  } else {
    right = (
      <div className="answers">
        <div className={'opts' + (q.options.length === 3 ? ' three' : '')}>
          {q.options.map((o, i) => (
            <button key={i} className={'opt' + (optLong ? ' long' : '')} aria-pressed={sel === i} onClick={() => setSel(i)}><ValView v={o.v} /></button>
          ))}
        </div>
        <button className="btn btn-gold" onClick={check} disabled={sel === null}>{t('kid.check')}</button>
      </div>
    );
  }
  return (
    <div className="tscr">
      <div className="top">
        <div className="l"><button className="icon-btn" onClick={onPause} aria-label={t('kid.pause')}><Icon name="x" size={24} /></button></div>
        <div className="prog" aria-hidden="true">{Array.from({ length: active.n }, (_, i) => <i key={i} className={i < doneCount ? 'done' : i === shown ? 'cur' : ''} />)}</div>
        <div className="count">{t('kid.qOf', { i: Math.min(shown + 1, active.n), n: active.n })}</div>
      </div>
      {isMini ? <div className="minibanner">{t('kid.miniBanner')}</div> : active.practice ? <div className="minibanner">{t('kid.practiceBanner')}</div> : null}
      <div className="qgrid">
        <div className="qcard">
          <span className="chip skill">{t('skill.' + q.gen)}</span>
          {q.visual && <div className="qvis"><VisualView v={q.visual} /></div>}
          <PromptView q={q} reveal={feedback} />
          {wrongShown && given !== null && (
            <div className="gave cmp">
              <span className="chip bad">{t('kid.yourAnswer', { v: typeof given === 'string' ? given.replace('.', decSym).replace('-', '−') : valText(given) })}</span>
              <span className="chip good">{t('kid.correct', { v: valText(q.answer) })}</span>
            </div>
          )}
          <Mascot child={child} emo={emo} />
        </div>
        {right}
      </div>
    </div>
  );
}

/* ---------- Resultado ---------- */
function Donut({ pct, passed }: { pct: number; passed: boolean }) {
  const r = 44, c = 2 * Math.PI * r, len = (c * pct) / 100;
  return (
    <svg className="donut" width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={Math.round(pct) + ' %'}>
      <circle cx="56" cy="56" r={r} fill="none" stroke="#22397c" strokeWidth="12" />
      <circle cx="56" cy="56" r={r} fill="none" stroke={passed ? '#3DDC97' : '#FF8A5B'} strokeWidth="12" strokeLinecap="round" strokeDasharray={len.toFixed(1) + ' ' + c.toFixed(1)} transform="rotate(-90 56 56)" />
      <text x="56" y="63" textAnchor="middle" fontSize="24" fontWeight="800" fill="#F7F7FA" fontFamily="Lexend, system-ui">{fmtNum(Math.round(pct))}%</text>
    </svg>
  );
}
function Result({ child, family, r, onGo, onSheet }: { child: Child; family: Family; r: repo.FinishResult; onGo: (s: Screen) => void; onSheet: (s: 'stars' | 'settings') => void }) {
  const t = useT();
  const s = r.score;
  const title = s.passed ? (r.session.correct === r.session.length ? t('kid.perfect') : t('kid.passed')) : t('kid.effort');
  const best = r.after.best;
  return (
    <div className="tscr">
      <Top child={child} family={family} onSheet={onSheet} onTasks={() => onGo('tasks')} />
      <div className="res">
        <div className="resl">
          <Donut pct={s.pct} passed={s.passed} />
          <Mascot child={{ ...child, bestStreak: best }} emo={s.passed ? 'animando' : 'contenta'} />
          <h2>{title}</h2>
          <p className="sub">{s.passed ? t('kid.scoreSub', { c: r.session.correct, n: r.session.length }) : t('kid.scoreFail', { c: r.session.correct, n: r.session.length })}</p>
          <div style={{ marginTop: 8 }}>
            <span className={'chip' + (s.streakExtended ? ' gold' : '')}><Icon name="flame" size={16} />
              {s.streakExtended ? t('kid.streakNow', { count: s.newStreak }) : r.before.passedToday ? t('kid.streakCounted') : t('kid.streakNeed')}</span>
          </div>
        </div>
        <div className="resr">
          <div className="caps">{t('kid.todayStars')}</div>
          {s.practice ? <div className="rw"><span>{t('kid.practiceRow')}</span><b>0 ★</b></div>
            : s.items.map((it, i) => (
              <div key={it.id} className={'rw rise' + (it.id === 'racha' ? ' hl' : '')} style={{ ['--i' as string]: i + 1 }}>
                <span>{t('res.' + it.id, { n: it.n, p: family.settings.rules.perCorrect, d: it.days })}</span><b>+{it.stars} ★</b>
              </div>
            ))}
          {s.fast && <div className="rw"><span className="muted">{t('kid.fastRow')}</span><b className="muted">—</b></div>}
          <div className="tot"><span>{t('kid.total')}</span><b>+{s.total} ★</b></div>
          {r.stageAfter > r.stageBefore ? (
            <div className="evo pop" style={{ ['--i' as string]: 4 }}>
              <Mascot child={child} emo="animando" stage={r.stageAfter} />
              <div><b style={{ fontSize: 20 }}>{t('kid.evolved', { pet: child.petName, stage: t('stage.' + r.stageAfter) })}</b><div className="muted">{t('kid.evolvedSub')}</div></div>
            </div>
          ) : r.stageAfter < 4 ? (
            <div className="evo">
              <Mascot child={child} stage={r.stageAfter + 1} className="sil" />
              <div><b style={{ fontSize: 18 }}>{t('kid.nextStage', { stage: t('stage.' + (r.stageAfter + 1)) })}</b>
                <div className="muted">{t('kid.nextStageSub', { count: Math.max(1, STAGE_STREAK[r.stageAfter] - best) })}</div></div>
            </div>
          ) : null}
          {r.gotShield && <div className="evo"><Icon name="shield" size={40} className="sh" /><div><b>{t('kid.gotShield')}</b><div className="muted">{t('kid.gotShieldSub')}</div></div></div>}
          <div className="resbtns">
            <button className="btn btn-line" onClick={() => onGo('mascot')}>{t('kid.mascot', { pet: child.petName })}</button>
            <button className="btn btn-gold" onClick={() => onGo('home')}>{t('kid.home')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Mi mascota ---------- */
function MascotScreen({ child, onBack, onSheet }: { child: Child; onBack: () => void; onSheet: (s: 'stars' | 'settings') => void }) {
  const t = useT();
  const [emo, setEmo] = useState<Emo>('contenta');
  const [preview, setPreview] = useState<number | null>(null);
  const [name, setName] = useState(child.petName);
  const cur = stageFor(child.bestStreak), view = preview ?? cur;
  const save = () => { const n = name.trim(); if (n && n !== child.petName) repo.updateChild(child.id, { petName: n.slice(0, 12) }); else setName(child.petName); };
  return (
    <div className="tscr">
      <Top child={child} onSheet={onSheet} left={<div className="brand-in"><BackBtn onClick={() => { save(); onBack(); }} /><b style={{ fontSize: 26 }}>{t('kid.myMascot')}</b></div>} />
      <div className="mas">
        <div className="masl">
          <div className="planet" />
          <Mascot child={child} emo={emo} stage={view} className={view > cur ? 'sil' : ''} />
          <label className="nameedit">
            <span className="sr-only">{t('kid.petNameLabel')}</span>
            <input value={name} maxLength={12} aria-label={t('kid.petNameLabel')} onChange={e => setName(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            <Icon name="check" size={24} className="gold" />
          </label>
          <div className="emos" role="group">
            {EMOS.map(e => <button key={e} aria-pressed={emo === e} onClick={() => setEmo(e)}>{t('emo.' + e)}</button>)}
          </div>
        </div>
        <div className="masr">
          <div className="caps">{t('kid.stagesNote')}</div>
          <div className="ladder">
            {[1, 2, 3, 4].map(n => {
              const lock = n > cur;
              return (
                <button key={n} className={'step' + (n === cur ? ' now' : '') + (lock ? ' lock' : '')} aria-pressed={view === n && n !== cur} onClick={() => setPreview(preview === n ? null : n)}>
                  <Mascot child={child} stage={n} />
                  <span><span className="nm">{t('stage.' + n)}</span><br /><span className="rq">{STAGE_STREAK[n - 1] ? t('kid.bestOf', { n: STAGE_STREAK[n - 1] }) : t('kid.atStart')}</span></span>
                  <span className="st">{n === cur ? <span className="chip gold">{t('kid.now')}</span> : n < cur ? <span className="chip good"><Icon name="check" size={16} />{t('kid.got')}</span>
                    : <span className="chip">{t('kid.left', { count: STAGE_STREAK[n - 1] - child.bestStreak })}</span>}</span>
                </button>
              );
            })}
          </div>
          <div className="kindsel">{t('kid.companion')}
            <span className="segs">{(['zorro', 'robot'] as const).map(k => <button key={k} aria-pressed={child.kind === k} onClick={() => repo.updateChild(child.id, { kind: k })}>{t('kind.' + k)}</button>)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Mis tareas ---------- */
function TasksScreen({ child, family, onBack, onSheet, toast }: { child: Child; family: Family; onBack: () => void; onSheet: (s: 'stars' | 'settings') => void; toast: (m: string) => void }) {
  const t = useT();
  const day = dayOf(Date.now(), family.settings.dayStartHour);
  const board = useLive(() => repo.taskBoard(child, day), [child.id, child.taskDays, day], null);
  if (!board) return <div className="tscr" />;
  return (
    <div className="tscr">
      <Top child={child} onSheet={onSheet} left={<div className="brand-in"><BackBtn onClick={onBack} /><b style={{ fontSize: 26 }}>{t('kid.tasksTitle')}</b></div>} />
      {board.items.length === 0 ? <p className="sub" style={{ marginTop: 40 }}>{t('kid.noTasks')}</p> : (
        <div className="tasklist">
          {board.items.map(({ task, check }, i) => {
            const st = check?.state;
            return (
              <div key={task.id} className={'tcard pop' + (st ? ' ' + st : '')} style={{ ['--i' as string]: i }}>
                <div className="tt">{task.title}</div>
                {task.stars > 0 && <span className="chip gold"><Icon name="star" size={16} />+{fmtNum(task.stars)}</span>}
                {st === 'approved' ? <span className="tstate ok"><Icon name="check" size={26} />{t('kid.taskOk')}</span>
                  : st === 'claimed' ? <span className="tstate wait"><Icon name="clock" size={24} />{t('kid.taskWait')}</span>
                  : (
                    <>
                      {st === 'rejected' && <span className="muted">{t('kid.taskAgain')}</span>}
                      <button className="btn btn-gold" onClick={async () => { await repo.claimTask(task.id, day); if (child.sound) playOk(); toast(t('kid.taskSent')); }}>
                        <Icon name="check" size={24} />{t('kid.taskDone')}</button>
                    </>
                  )}
              </div>
            );
          })}
          {board.bonuses.map(b => (
            <div key={b.bonus.id} className={'tcard bonus' + (b.complete ? ' approved' : '')}>
              <div className="tt">{b.bonus.title}</div>
              {b.bonus.stars > 0 && <span className="chip gold"><Icon name="star" size={16} />+{fmtNum(b.bonus.stars)}</span>}
              <span className={'tstate' + (b.complete ? ' ok' : '')}>{b.complete ? <><Icon name="check" size={26} />{t('kid.bonusOk')}</> : t('kid.bonusInfo', { a: b.done, n: b.tasks.length })}</span>
              <div className="bar" role="progressbar" aria-label={b.bonus.title} aria-valuenow={b.done} aria-valuemin={0} aria-valuemax={b.tasks.length}>
                <i style={{ width: Math.round(b.done / b.tasks.length * 100) + '%' }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Hojas: mis estrellas y ajustes del niño ---------- */
function StarsSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const t = useT();
  const data = useLive(async () => ({
    events: (await db.events.where('childId').equals(child.id).sortBy('ts')).reverse(),
    rewards: (await db.rewards.toArray()).filter(r => r.active).sort((a, b) => a.cost - b.cost)
  }), [child.id], { events: [], rewards: [] });
  const bal = balanceOf(data.events);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheetbox" role="dialog" aria-label={t('kid.myStars')} onClick={e => e.stopPropagation()}>
        <div className="sheethd"><h3>{t('kid.myStars')}</h3><button className="icon-btn" onClick={onClose} aria-label={t('kid.close')}><Icon name="x" size={24} /></button></div>
        <div className="starscard"><div className="hd"><span className="num">{fmtNum(bal)}</span><b>{t('kid.stars')}</b></div></div>
        <div className="caps">{t('kid.goals')}</div>
        {data.rewards.map(r => (
          <div className="led goalrow" key={r.id}>
            <span className="gl"><span>{r.name}</span><b className="gold">{fmtNum(r.cost)} ★</b></span>
            <div className="bar"><i style={{ width: Math.min(100, Math.round((bal / r.cost) * 100)) + '%' }} /></div>
          </div>
        ))}
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>{t('kid.askFamily')}</p>
        <div className="caps">{t('kid.history')}</div>
        {data.events.length === 0 && <p className="muted" style={{ margin: 0 }}>{t('kid.noHistory')}</p>}
        {data.events.map(e => (
          <div className="led" key={e.id}>
            <span>{noteText(e.note, t)}<br /><span className="muted" style={{ fontSize: 14 }}>{new Date(e.ts).toLocaleDateString(child.lang, { weekday: 'short', day: 'numeric', month: 'short' })}</span></span>
            <b className={e.amount >= 0 ? 'pos' : 'neg'}>{e.amount > 0 ? '+' : '−'}{fmtNum(Math.abs(e.amount))} ★</b>
          </div>
        ))}
      </div>
    </div>
  );
}
function KidSettings({ child, onClose }: { child: Child; onClose: () => void }) {
  const t = useT();
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheetbox" role="dialog" aria-label={t('kid.settingsTitle')} onClick={e => e.stopPropagation()}>
        <div className="sheethd"><h3>{t('kid.settingsTitle')}</h3><button className="icon-btn" onClick={onClose} aria-label={t('kid.close')}><Icon name="x" size={24} /></button></div>
        <div className="caps">{t('kid.language')}</div>
        <div className="langs">
          {LANGS.map((l: Lang) => <button key={l} className="lencard langcard" aria-pressed={child.lang === l} onClick={() => repo.updateChild(child.id, { lang: l })}>{t('lang.' + l)}</button>)}
        </div>
        <div className="caps">{t('kid.sound')}</div>
        <div className="emos">
          <button aria-pressed={child.sound} onClick={() => repo.updateChild(child.id, { sound: true })}><Icon name="sound" size={20} /> {t('common.on')}</button>
          <button aria-pressed={!child.sound} onClick={() => repo.updateChild(child.id, { sound: false })}>{t('common.off')}</button>
        </div>
        <div className="caps">{t('kid.bigText')}</div>
        <div className="emos">
          <button aria-pressed={!!child.bigText} onClick={() => repo.updateChild(child.id, { bigText: true })}>{t('common.on')}</button>
          <button aria-pressed={!child.bigText} onClick={() => repo.updateChild(child.id, { bigText: false })}>{t('common.off')}</button>
        </div>
      </div>
    </div>
  );
}
