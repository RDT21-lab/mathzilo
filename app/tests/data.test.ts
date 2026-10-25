import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { computeStreak, addDays, dayOf, levelSuggestion } from '../src/data/domain';
import { db } from '../src/data/db';
import * as repo from '../src/data/repo';
import type { ActiveTest } from '../src/data/types';

const T0 = '2026-10-01';
const days = (n: number, from = T0) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('rachas y escudos', () => {
  it('cuenta días seguidos con test superado', () => {
    const s = days(5).map(day => ({ day, passed: true }));
    const r = computeStreak(s, addDays(T0, 5), true);
    expect(r.streak).toBe(5);
    expect(r.doneToday).toBe(false);
  });
  it('a los 7 días se gana un escudo que protege un día sin test', () => {
    const s = days(7).map(day => ({ day, passed: true }));
    s.push({ day: addDays(T0, 8), passed: true });          // el día 7 (índice) no hay test
    const r = computeStreak(s, addDays(T0, 8), true);
    expect(r.shieldDays).toEqual([addDays(T0, 7)]);
    expect(r.streak).toBe(8);
    expect(r.shields).toBe(0);
  });
  it('como máximo 2 escudos, y sin escudo la racha descansa', () => {
    const s = days(28).map(day => ({ day, passed: true }));
    const r = computeStreak(s, addDays(T0, 28), true);
    expect(r.shields).toBe(2);
    const lost = computeStreak(days(12).map(day => ({ day, passed: true })), addDays(T0, 14), false);
    expect(lost.streak).toBe(0);
    expect(lost.rested).toBe(12);
    expect(lost.best).toBe(12);
  });
  it('un test suspendido no suma racha, pero cuenta como test del día', () => {
    const r = computeStreak([{ day: T0, passed: false }], T0, true);
    expect(r.streak).toBe(0);
    expect(r.doneToday).toBe(true);
    expect(r.passedToday).toBe(false);
  });
  it('las fechas del futuro (reloj adelantado) no cuentan; la del servidor manda', () => {
    const r = computeStreak([{ day: addDays(T0, 3), passed: true }, { day: addDays(T0, 2), serverDay: T0, passed: true }], T0, true);
    expect(r.streak).toBe(1);
  });
  it('medianoche: antes de la hora de inicio cuenta como el día anterior', () => {
    const t = new Date(2026, 9, 10, 2, 30).getTime();
    expect(dayOf(t, 4)).toBe('2026-10-09');
    expect(dayOf(t, 0)).toBe('2026-10-10');
  });
  it('la mejor racha guardada nunca baja', () => {
    expect(computeStreak([], T0, true, 30).best).toBe(30);
  });
  it('sugiere subir y bajar de nivel', () => {
    const mk = (pcts: number[]) => pcts.map((p, i) => ({ level: 2, correct: p / 10, length: 10, endedAt: i }));
    expect(levelSuggestion(mk([90, 100, 90, 100, 90]), 2)).toBe('up');
    expect(levelSuggestion(mk([90, 40, 30, 40]), 2)).toBe('down');
    expect(levelSuggestion(mk([90, 80, 100, 100, 100]), 2)).toBe(null);
  });
});

describe('saldo: tests y canjes en local', () => {
  beforeEach(async () => { await repo.wipeAll(); });

  async function playTest(childId: string, n: number, correct: number): Promise<repo.FinishResult> {
    const child = (await db.children.get(childId))!;
    const a: ActiveTest = await repo.startTest(child, n);
    a.answers = a.qs.map((q, i) => ({ skill: q.gen, seed: q.seed, given: '', ok: i < correct, ms: 5000, tag: i < correct ? 'ok' : 'cuenta-mal' }));
    return repo.finishTest(a);
  }

  it('el saldo cuadra tras una secuencia de tests y canjes de prueba', async () => {
    await repo.createFamily({ lang: 'es', pin: '1234', children: [{ name: 'Lucía', kind: 'zorro', petName: 'Chispa', level: 1, lang: 'es' }] });
    const [lucia] = await db.children.toArray();
    const r1 = await playTest(lucia.id, 10, 8);                // 8 + 2 = 10
    expect(r1.score.total).toBe(10);
    const r2 = await playTest(lucia.id, 10, 10);               // práctica: 0
    expect(r2.score.practice).toBe(true);
    expect(r2.score.total).toBe(0);
    expect(await repo.balance(lucia.id)).toBe(10);
    await repo.redeemLocal(lucia.id, 4, 'Cromos');
    expect(await repo.balance(lucia.id)).toBe(6);
    await expect(repo.redeemLocal(lucia.id, 7, 'Helado')).rejects.toThrow('balance');
    const canje = (await db.events.where('type').equals('canje').toArray())[0];
    await repo.compensate(canje.id);
    expect(await repo.compensate(canje.id)).toBe(null);         // no se compensa dos veces
    expect(await repo.balance(lucia.id)).toBe(10);
    const evs = await db.events.toArray();
    expect(evs.reduce((s, e) => s + e.amount, 0)).toBe(10);
    expect(evs.length).toBe(4);                                 // aciertos, aprobado, canje, ajuste
    // cada escritura está en la cola de sincronización
    expect(await db.outbox.count()).toBeGreaterThan(5);
  });

  it('PIN: 5 intentos fallidos bloquean', async () => {
    await repo.createFamily({ lang: 'es', pin: '2468', children: [] });
    expect((await repo.checkPin('2468')).ok).toBe(true);
    for (let i = 0; i < 4; i++) expect((await repo.checkPin('0000')).locked).toBe(false);
    const fifth = await repo.checkPin('0000');
    expect(fifth.locked).toBe(true);
    expect((await repo.checkPin('2468')).ok).toBe(false);       // bloqueado aunque sea correcto
  });

  it('el test en curso se guarda y se retoma', async () => {
    await repo.createFamily({ lang: 'es', pin: '1234', children: [{ name: 'Mateo', kind: 'robot', petName: 'Bip', level: 3, lang: 'es' }] });
    const [m] = await db.children.toArray();
    const a = await repo.startTest(m, 15);
    a.i = 4;
    await repo.saveActive(a);
    const back = await repo.getActive(m.id);
    expect(back?.i).toBe(4);
    expect(back?.qs.length).toBe(15);
  });
});
