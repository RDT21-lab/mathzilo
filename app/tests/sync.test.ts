/* Fase 7: dos dispositivos (móvil del padre y tablet) contra el servidor de sincronización real.
   Criterio: con la tablet en modo avión se hace un test; al volver la conexión y tras un canje
   del padre, el saldo es idéntico en ambos dispositivos. Además, pruebas de seguridad.      */
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { StarDB, useDatabase, db } from '../src/data/db';
import * as repo from '../src/data/repo';
import * as sync from '../src/sync/client';
// @ts-expect-error módulo JS del servidor
import { createApp } from '../server/sync-server.mjs';

const phone = new StarDB('phone'), tablet = new StarDB('tablet');
let url = '', server: import('node:http').Server, dir = '';
let fakeNow: number | null = null;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starmath-'));
  server = createApp({ dataDir: dir, now: () => fakeNow ?? Date.now() });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function on<T>(d: StarDB, f: () => Promise<T>): Promise<T> { useDatabase(d); return f(); }
async function play(d: StarDB, correct: number, n = 10) {
  return on(d, async () => {
    const child = (await db.children.toArray())[0];
    const a = await repo.startTest(child, n);
    a.answers = a.qs.map((q, i) => ({ skill: q.gen, seed: q.seed, given: '', ok: i < correct, ms: 4000, tag: i < correct ? 'ok' : 'cuenta-mal' }));
    return repo.finishTest(a);
  });
}
const bal = (d: StarDB) => on(d, async () => repo.balance((await db.children.toArray())[0].id));
async function cfgToken(d: StarDB) { return on(d, async () => (await sync.getSyncConfig())!.token); }
async function rawSync(token: string, body: unknown) {
  const r = await fetch(url + '/api/sync', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  return r.json();
}

describe('sincronización entre móvil y tablet', () => {
  it('alta del padre, subida inicial y vinculación de la tablet', async () => {
    await on(phone, async () => {
      await repo.createFamily({ lang: 'es', pin: '4321', children: [{ name: 'Sara', kind: 'zorro', petName: 'Nova', level: 3, lang: 'es' }] });
      // un canje hecho antes de tener cuenta también sube (importación inicial)
      await play(phone, 9);
      await repo.redeemLocal((await db.children.toArray())[0].id, 3, 'Cromos');
      await sync.register(url, 'familia@example.com', 'contraseña-larga');
      expect(await db.outbox.count()).toBe(0);
    });
    const { code } = await on(phone, () => sync.pairCreate());
    await on(tablet, () => sync.pairClaim(url, code));
    expect(await on(tablet, () => db.children.count())).toBe(1);
    expect(await bal(tablet)).toBe(await bal(phone));
    expect(await bal(phone)).toBe(9 + 2 - 3);
  });

  it('test en modo avión + canje del padre → mismo saldo en los dos', async () => {
    // mañana: la tablet hace el test sin conexión (no sincroniza)
    const realNow = Date.now;
    Date.now = () => realNow() + 86400_000;
    fakeNow = Date.now();
    const r = await play(tablet, 8);
    expect(r.score.total).toBeGreaterThan(0);
    const tabletBal = await bal(tablet);
    expect(tabletBal).toBe(8 + 8 + 2);
    expect(await bal(phone)).toBe(8);                          // el móvil aún no lo sabe
    // vuelve la conexión
    await on(tablet, () => sync.syncNow());
    await on(phone, () => sync.syncNow());
    expect(await bal(phone)).toBe(tabletBal);
    // canje del padre desde el móvil, validado en el servidor
    const childId = await on(phone, async () => (await db.children.toArray())[0].id);
    await on(phone, () => sync.redeemRemote(childId, 10, 'Helado', '4321'));
    await on(tablet, () => sync.syncNow());
    await on(phone, () => sync.syncNow());
    expect(await bal(phone)).toBe(tabletBal - 10);
    expect(await bal(tablet)).toBe(tabletBal - 10);
    Date.now = realNow; fakeNow = null;
  });

  it('un canje sin saldo suficiente o con PIN erróneo se rechaza', async () => {
    const childId = await on(phone, async () => (await db.children.toArray())[0].id);
    await expect(on(phone, () => sync.redeemRemote(childId, 999, 'Bici', '4321'))).rejects.toThrow('saldo');
    await expect(on(phone, () => sync.redeemRemote(childId, 1, 'Chicle', '0000'))).rejects.toThrow('pin');
  });

  it('la tablet no puede alterar el saldo ni las reglas desde la consola', async () => {
    const token = await cfgToken(tablet);
    const childId = await on(tablet, async () => (await db.children.toArray())[0].id);
    const before = await bal(phone);
    const res = await rawSync(token, { since: 0, tz: 0, dayStart: 4, push: [
      { table: 'events', op: 'put', row: { id: 'x1', childId, ts: Date.now(), day: '2026-01-01', type: 'ajuste', amount: 500, note: 'truco', by: 'parent', device: 'x' } },
      { table: 'events', op: 'put', row: { id: 'x2', childId, ts: Date.now(), day: '2026-01-01', type: 'test', amount: 50, note: 'truco', by: 'child', device: 'x' } },
      { table: 'family', op: 'put', row: { id: 'family', updatedAt: Date.now() + 1e9, settings: { rules: { perCorrect: 100 } } } }
    ] });
    expect(res.rejected.map((r: { error: string }) => r.error).sort()).toEqual(['rol', 'sin-sesion', 'solo-servidor']);
    await on(phone, () => sync.syncNow());
    expect(await bal(phone)).toBe(before);
    expect(await on(phone, async () => (await repo.getFamily())!.settings.rules.perCorrect)).toBe(1);
  });

  it('el segundo test del día no da estrellas aunque la tablet lo intente', async () => {
    const token = await cfgToken(tablet);
    const childId = await on(tablet, async () => (await db.children.toArray())[0].id);
    const now = Date.now() - 3 * 86400_000, day = new Date(now - 4 * 3600_000).toISOString().slice(0, 10);   // un día sin tests
    const ses = (id: string) => ({ id, childId, startedAt: now, endedAt: now, day, length: 10, level: 3, correct: 10, stars: 15, passed: true, practice: false, fast: false, device: 'x' });
    const ev = (id: string, sid: string) => ({ id, childId, ts: now, day, type: 'test', amount: 10, note: '', by: 'child', device: 'x', sessionId: sid });
    const res = await rawSync(token, { since: 0, tz: 0, dayStart: 4, push: [
      { table: 'sessions', op: 'put', row: ses('s-a') }, { table: 'events', op: 'put', row: ev('e-a', 's-a') },
      { table: 'sessions', op: 'put', row: ses('s-b') }, { table: 'events', op: 'put', row: ev('e-b', 's-b') }] });
    expect(res.rejected.map((r: { error: string }) => r.error)).toEqual(['segundo-test']);
  });

  it('reloj de la tablet adelantado: el servidor fija la fecha', async () => {
    const token = await cfgToken(tablet);
    const childId = await on(tablet, async () => (await db.children.toArray())[0].id);
    const future = Date.now() + 5 * 86400_000;
    await rawSync(token, { since: 0, tz: 0, dayStart: 0, push: [{ table: 'sessions', op: 'put', row: {
      id: 's-fut', childId, startedAt: future, endedAt: future, day: new Date(future).toISOString().slice(0, 10), length: 10, level: 3, correct: 9, stars: 0, passed: true, practice: false, fast: false, device: 'x' } }] });
    await on(phone, () => sync.syncNow());
    const s = await on(phone, () => db.sessions.get('s-fut'));
    expect(s?.serverDay).toBe(new Date().toISOString().slice(0, 10));
  });

  it('5 PIN erróneos bloquean los canjes en el servidor', async () => {
    const childId = await on(phone, async () => (await db.children.toArray())[0].id);
    // ya hubo un intento fallido en la prueba anterior: 3 más dan 4, y el quinto bloquea
    for (let i = 0; i < 3; i++) await expect(on(phone, () => sync.redeemRemote(childId, 1, 'x', '1111'))).rejects.toThrow('pin');
    await expect(on(phone, () => sync.redeemRemote(childId, 1, 'x', '1111'))).rejects.toThrow('bloqueado');
    await expect(on(phone, () => sync.redeemRemote(childId, 1, 'x', '4321'))).rejects.toThrow('bloqueado');
  });
});
