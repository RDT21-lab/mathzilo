/* Tareas en el modo padre: el padre las pone (un día o varios días de la semana), decide cuántas
   estrellas valen (con un decimal) y si hay premio por cumplir todas o un grupo. Cuando el niño
   dice que ha hecho una, aquí se da por buena o no.                                          */
import { useState } from 'react';
import { db } from '../../data/db';
import * as repo from '../../data/repo';
import type { Child, Family, Task } from '../../data/types';
import { ALL_DAYS, dayOf, roundStars } from '../../data/domain';
import { useT, fmtNum } from '../../i18n';
import { Icon, Mascot, useLive } from '../common';

const WEEK = [1, 2, 3, 4, 5, 6, 0];                    // la semana empieza en lunes
const WORKDAYS = [1, 2, 3, 4, 5];
const sameDays = (a: number[], b: number[]) => a.length === b.length && b.every(d => a.includes(d));
/** «1,5» o «1.5» → 1.5 (un decimal como mucho); null si no es un número válido */
export function parseStars(s: string): number | null {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() && Number.isFinite(n) && n >= 0 && n <= 1000 ? roundStars(n) : null;
}
function weekdayName(d: number, lang: string) {
  return new Date(Date.UTC(2026, 0, 4 + d, 12)).toLocaleDateString(lang, { weekday: 'long', timeZone: 'UTC' });   // 4/1/2026 fue domingo
}

export function useDays() {
  const t = useT();
  const letters = t('kid.weekLetters');
  return {
    letter: (d: number) => letters[d],
    summary: (task: Pick<Task, 'days' | 'date'>, lang: string) => task.date
      ? new Date(task.date + 'T12:00:00').toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' })
      : sameDays(task.days, ALL_DAYS) ? t('parent.t.everyDay') : sameDays(task.days, WORKDAYS) ? t('parent.t.workdays')
      : sameDays(task.days, [0, 6]) ? t('parent.t.weekend') : WEEK.filter(d => task.days.includes(d)).map(d => letters[d]).join(' ')
  };
}

function DayPick({ value, onChange, lang }: { value: number[]; onChange: (v: number[]) => void; lang: string }) {
  const { letter } = useDays();
  return (
    <div className="daypick" role="group">
      {WEEK.map(d => (
        <button key={d} aria-pressed={value.includes(d)} aria-label={weekdayName(d, lang)}
                onClick={() => onChange(value.includes(d) ? value.filter(x => x !== d) : [...value, d].sort())}>{letter(d)}</button>
      ))}
    </div>
  );
}

export function TasksScreen({ family, toast }: { family: Family; toast: (m: string) => void }) {
  const t = useT();
  const lang = family.settings.lang;
  const kids = useLive(() => db.children.toCollection().sortBy('createdAt'), [], [] as Child[]);
  const [kidId, setKidId] = useState<string | null>(null);
  const [form, setForm] = useState<null | { kind: 'task' | 'bonus'; task?: Task }>(null);
  const kid = kids.find(k => k.id === kidId) ?? kids[0];
  const today = dayOf(Date.now(), family.settings.dayStartHour);
  const data = useLive(async () => kid ? {
    tasks: (await db.tasks.where('childId').equals(kid.id).toArray()).filter(x => !x.deleted).sort((a, b) => a.createdAt - b.createdAt),
    board: await repo.taskBoard(kid, today)
  } : null, [kid?.id, kid?.taskDays, today], null);
  const { summary } = useDays();
  if (!kid) return <div className="pbody"><h2>{t('parent.t.title')}</h2></div>;
  const taskDays = kid.taskDays ?? ALL_DAYS;
  const tasks = data?.tasks.filter(x => x.kind === 'task') ?? [];
  const bonuses = data?.tasks.filter(x => x.kind === 'bonus') ?? [];
  const dateTxt = new Date(today + 'T12:00:00').toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="pbody">
      <h2>{t('parent.t.title')}</h2>
      <p className="lead">{t('parent.t.lead')}</p>
      {kids.length > 1 && (
        <div className="kidsel" role="group">
          {kids.map(c => <button key={c.id} aria-pressed={kid.id === c.id} onClick={() => { setKidId(c.id); setForm(null); }}><Mascot child={c} />{c.name}</button>)}
        </div>
      )}

      <section className="sect"><h3>{t('parent.t.today', { date: dateTxt })}</h3>
        {!data?.board.items.length && <p className="muted small" style={{ margin: 0 }}>{taskDays.includes(new Date(today + 'T12:00:00Z').getUTCDay()) ? t('parent.t.noneToday') : t('parent.t.dayOff')}</p>}
        {data?.board.items.map(({ task, check }) => (
          <div className="taskrow" key={task.id}>
            <span className="tx"><b>{task.title}</b><small>{task.stars > 0 ? '+' + fmtNum(task.stars) + ' ★' : t('parent.t.noStars')}</small></span>
            <span className="st">
              {check?.state === 'approved' ? <span className="ok-t"><Icon name="check" size={18} /> {t('parent.t.done')}</span> : (
                <>
                  {check?.state === 'claimed' && <span className="wait-t"><Icon name="clock" size={18} /></span>}
                  <button className="pbtn" onClick={async () => { await repo.approveTask(task.id, today); toast(t('parent.t.approved', { name: kid.name, n: fmtNum(task.stars) })); }}>
                    {check?.state === 'claimed' ? t('parent.t.yes') : t('parent.t.markDone')}</button>
                  {check?.state === 'claimed' && <button className="pbtn line" onClick={() => repo.rejectTask(task.id, today)}>{t('parent.t.notYet')}</button>}
                </>
              )}
            </span>
          </div>
        ))}
        {data?.board.bonuses.map(b => (
          <div className="taskrow" key={b.bonus.id}>
            <span className="tx"><b>{b.bonus.title}</b><small>{t('parent.t.bonusProgress', { a: b.done, n: b.tasks.length })} · +{fmtNum(b.bonus.stars)} ★</small></span>
            <span className="st">{b.complete && <span className="ok-t"><Icon name="check" size={18} /> {t('parent.t.done')}</span>}</span>
          </div>
        ))}
      </section>

      <section className="sect"><h3>{t('parent.t.listTitle', { name: kid.name })}</h3>
        {tasks.length === 0 && !form && <p className="muted small" style={{ margin: 0 }}>{t('parent.t.empty')}</p>}
        {tasks.map(task => form?.task?.id === task.id
          ? <TaskForm key={task.id} kind="task" lang={lang} task={task} today={today} tasks={tasks} onDone={async o => { if (o) await repo.updateTask(task.id, o); setForm(null); }} />
          : <TaskRow key={task.id} task={task} lang={lang} summary={summary(task, lang)} onEdit={() => setForm({ kind: 'task', task })} />)}
        {form?.kind === 'task' && !form.task
          ? <TaskForm kind="task" lang={lang} today={today} tasks={tasks} onDone={async o => { if (o) { await repo.addTask({ ...o, childId: kid.id, kind: 'task' }); toast(t('parent.t.added')); } setForm(null); }} />
          : <button className="pbtn line" style={{ marginTop: 8 }} onClick={() => setForm({ kind: 'task' })}>{t('parent.t.add')}</button>}
      </section>

      <section className="sect"><h3>{t('parent.t.bonusTitle')}</h3>
        <p className="muted small" style={{ margin: '0 0 4px' }}>{t('parent.t.bonusLead')}</p>
        {bonuses.map(b => form?.task?.id === b.id
          ? <TaskForm key={b.id} kind="bonus" lang={lang} task={b} today={today} tasks={tasks} onDone={async o => { if (o) await repo.updateTask(b.id, o); setForm(null); }} />
          : <TaskRow key={b.id} task={b} lang={lang} onEdit={() => setForm({ kind: 'bonus', task: b })}
                     summary={b.taskIds?.length ? t('parent.t.someTasks', { n: b.taskIds.filter(id => tasks.some(x => x.id === id)).length }) : t('parent.t.allTasks')} />)}
        {form?.kind === 'bonus' && !form.task
          ? <TaskForm kind="bonus" lang={lang} today={today} tasks={tasks} onDone={async o => { if (o) { await repo.addTask({ ...o, childId: kid.id, kind: 'bonus' }); toast(t('parent.t.added')); } setForm(null); }} />
          : <button className="pbtn line" style={{ marginTop: 8 }} onClick={() => setForm({ kind: 'bonus' })}>{t('parent.t.addBonus')}</button>}
      </section>

      <section className="sect"><h3>{t('parent.t.daysTitle')}</h3>
        <p className="muted small" style={{ margin: '0 0 6px' }}>{t('parent.t.daysLead', { name: kid.name })}</p>
        <DayPick value={taskDays} lang={lang} onChange={v => repo.updateChild(kid.id, { taskDays: v })} />
      </section>
    </div>
  );
}

function TaskRow({ task, summary, onEdit }: { task: Task; summary: string; onEdit: () => void; lang?: string }) {
  const t = useT();
  const [del, setDel] = useState(false);
  return (
    <div className={'taskrow' + (task.active ? '' : ' off')}>
      <span className="tx"><b>{task.title}</b><small>{(task.stars > 0 ? '+' + fmtNum(task.stars) + ' ★ · ' : '') + summary}{task.active ? '' : ' · ' + t('parent.t.paused')}</small></span>
      <span className="st">
        {del ? (
          <>
            <button className="pbtn" onClick={() => repo.deleteTask(task.id)}>{t('common.delete')}</button>
            <button className="pbtn line" onClick={() => setDel(false)}>{t('common.cancel')}</button>
          </>
        ) : (
          <>
            <button className="pbtn line" onClick={() => repo.updateTask(task.id, { active: !task.active })}
                    aria-label={(task.active ? t('parent.t.pause') : t('parent.t.resume')) + ': ' + task.title}>{task.active ? t('parent.t.pause') : t('parent.t.resume')}</button>
            <button className="pbtn line" onClick={onEdit} aria-label={t('parent.t.edit') + ': ' + task.title}>{t('parent.t.edit')}</button>
            <button className="pbtn line danger" onClick={() => setDel(true)} aria-label={t('common.delete') + ': ' + task.title}><Icon name="x" size={16} /></button>
          </>
        )}
      </span>
    </div>
  );
}

type FormOut = { title: string; stars: number; days: number[]; date?: string; taskIds?: string[] };
function TaskForm({ kind, task, tasks, today, lang, onDone }: { kind: 'task' | 'bonus'; task?: Task; tasks: Task[]; today: string; lang: string; onDone: (o: FormOut | null) => void }) {
  const t = useT();
  const [title, setTitle] = useState(task?.title ?? (kind === 'bonus' ? t('parent.t.bonusDefault') : ''));
  const [stars, setStars] = useState(task ? String(task.stars).replace('.', t('sym.dec')) : kind === 'bonus' ? '2' : '1');
  const [once, setOnce] = useState(!!task?.date);
  const [date, setDate] = useState(task?.date ?? today);
  const [days, setDays] = useState<number[]>(task?.days ?? WORKDAYS);
  const [some, setSome] = useState(!!task?.taskIds?.length);
  const [pick, setPick] = useState<string[]>(task?.taskIds ?? []);
  const n = parseStars(stars);
  const ok = title.trim() && n !== null && (kind === 'bonus' ? (!some || pick.length > 0) : once ? !!date : days.length > 0);
  return (
    <div className="taskform">
      <label className="field">{kind === 'bonus' ? t('parent.t.bonusName') : t('parent.t.name')}
        <input type="text" maxLength={60} value={title} placeholder={kind === 'bonus' ? '' : t('parent.t.namePh')} onChange={e => setTitle(e.target.value)} /></label>
      <label className="field">{t('parent.t.stars')}
        <input type="text" inputMode="decimal" value={stars} onChange={e => setStars(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} />
        {n === null && stars && <span className="err">{t('parent.t.starsBad')}</span>}</label>
      {kind === 'task' ? (
        <>
          <div className="srow"><span className="lb">{t('parent.t.when')}</span>
            <span className="segs">
              <button aria-pressed={!once} onClick={() => setOnce(false)}>{t('parent.t.repeat')}</button>
              <button aria-pressed={once} onClick={() => setOnce(true)}>{t('parent.t.once')}</button>
            </span></div>
          {once ? <label className="field">{t('parent.t.date')}<input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} /></label>
            : <><span className="muted small">{t('parent.t.daysHelp')}</span><DayPick value={days} lang={lang} onChange={setDays} /></>}
        </>
      ) : (
        <>
          <div className="srow"><span className="lb">{t('parent.t.which')}</span>
            <span className="segs">
              <button aria-pressed={!some} onClick={() => setSome(false)}>{t('parent.t.whichAll')}</button>
              <button aria-pressed={some} onClick={() => setSome(true)}>{t('parent.t.whichSome')}</button>
            </span></div>
          {some && (tasks.length ? tasks.map(x => (
            <label key={x.id} className="pickrow"><input type="checkbox" checked={pick.includes(x.id)}
              onChange={e => setPick(e.target.checked ? [...pick, x.id] : pick.filter(id => id !== x.id))} />{x.title}</label>
          )) : <span className="muted small">{t('parent.t.empty')}</span>)}
        </>
      )}
      <div className="acts">
        <button className="pbtn" disabled={!ok} onClick={() => onDone({ title: title.trim(), stars: n!, days: kind === 'bonus' ? ALL_DAYS : once ? [] : days,
          ...(kind === 'task' && once ? { date } : { date: undefined }), ...(kind === 'bonus' ? { taskIds: some ? pick : [] } : {}) })}>{t('common.save')}</button>
        <button className="pbtn line" onClick={() => onDone(null)}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}

/** Tareas que el niño ha marcado como hechas y esperan la decisión del padre */
export function ReviewBox({ family, toast }: { family: Family; toast: (m: string) => void }) {
  const t = useT();
  const list = useLive(() => repo.pendingChecks(), [], []);
  if (!list.length) return null;
  const today = dayOf(Date.now(), family.settings.dayStartHour);
  return (
    <section className="review-box" aria-live="polite">
      <h3><Icon name="bell" size={20} className="gold" />{t('parent.t.review', { count: list.length })}</h3>
      {list.map(({ check, task, child }) => (
        <div className="rvrow" key={check.id}>
          <div className="who"><span><b>{child!.name}</b> · {task!.title}{check.day !== today ? ' · ' + new Date(check.day + 'T12:00:00').toLocaleDateString(family.settings.lang, { weekday: 'short', day: 'numeric' }) : ''}</span>
            {task!.stars > 0 && <b className="gold">+{fmtNum(task!.stars)} ★</b>}</div>
          <div className="acts">
            <button className="pbtn" onClick={async () => { await repo.approveTask(task!.id, check.day); toast(t('parent.t.approved', { name: child!.name, n: fmtNum(task!.stars) })); }}>
              <Icon name="check" size={16} /> {t('parent.t.yes')}</button>
            <button className="pbtn line" onClick={() => repo.rejectTask(task!.id, check.day)}>{t('parent.t.notYet')}</button>
          </div>
        </div>
      ))}
    </section>
  );
}
export const usePendingCount = () => useLive(async () => (await repo.pendingChecks()).length, [], 0);
