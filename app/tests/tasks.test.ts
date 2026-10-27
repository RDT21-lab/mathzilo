/* Tareas: el padre las pone y las da por buenas (estrellas con un decimal y premios por conjunto);
   la tablet solo puede decir «hecha», y el móvil del padre recibe un aviso cifrado.            */
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { StarDB, useDatabase, db } from '../src/data/db';
import * as repo from '../src/data/repo';
import * as sync from '../src/sync/client';
import { ALL_DAYS, balanceOf, bonusesForDay, tasksForDay } from '../src/data/domain';
import type { Task } from '../src/data/types';
// @ts-expect-error módulo JS del servidor
import { createApp } from '../server/sync-server.mjs';

const task = (id: string, o: Partial<Task> = {}): Task => ({ id, childId: 'c', kind: 'task', title: id, stars: 1, days: [1, 2, 3, 4, 5], active: true, createdAt: 1, updatedAt: 1, ...o });

describe('reglas de las tareas', () => {
  // 2026-10-26 fue lunes; 2026-10-31, sábado
  it('cada tarea toca los días de la semana elegidos, o solo su fecha', () => {
    const ts = [task('cama'), task('perro', { days: ALL_DAYS }), task('excursion', { date: '2026-10-31', days: [] }), task('pausa', { active: false }), task('borrada', { deleted: true })];
    expect(tasksForDay(ts, '2026-10-26').map(t => t.id)).toEqual(['cama', 'perro']);
    expect(tasksForDay(ts, '2026-10-31').map(t => t.id)).toEqual(['perro', 'excursion']);
  });
  it('los días sin tareas del niño (fin de semana desconectado) no tienen ninguna', () => {
    expect(tasksForDay([task('perro', { days: ALL_DAYS })], '2026-10-31', [1, 2, 3, 4, 5])).toEqual([]);
  });
  it('premio por todas las tareas del día o por un grupo', () => {
    const ts = [task('a'), task('b'), task('c'), task('todas', { kind: 'bonus', days: ALL_DAYS }), task('ab', { kind: 'bonus', days: ALL_DAYS, taskIds: ['a', 'b'] })];
    const st = bonusesForDay(ts, '2026-10-26', new Set(['a', 'b']));
    expect(st.map(b => [b.bonus.id, b.done, b.tasks.length, b.complete])).toEqual([['todas', 2, 3, false], ['ab', 2, 2, true]]);
    expect(bonusesForDay(ts, '2026-10-31', new Set())).toEqual([]);          // sin tareas ese día, sin premio
  });
  it('el saldo con decimales no arrastra errores de coma flotante', () => {
    expect(balanceOf([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
    expect(balanceOf([{ amount: 1.5 }, { amount: 2.5 }, { amount: -3 }])).toBe(1);
  });
});

describe('tareas en un dispositivo', () => {
  it('el niño la marca, el padre la aprueba y suma 1,5; con todas, el premio', async () => {
    useDatabase(new StarDB('tareas-local'));
    await repo.createFamily({ lang: 'es', pin: '1234', children: [{ name: 'Ana', kind: 'zorro', petName: 'Nova', level: 2, lang: 'es' }] });
    const child = (await db.children.toArray())[0], day = await repo.today();
    const cama = await repo.addTask({ childId: child.id, kind: 'task', title: 'Hacer la cama', stars: 1.5, days: ALL_DAYS });
    const perro = await repo.addTask({ childId: child.id, kind: 'task', title: 'Pasear; al perro', stars: 0.25, days: ALL_DAYS });
    expect(perro.stars).toBe(0.3);                                           // un decimal como mucho
    await repo.addTask({ childId: child.id, kind: 'bonus', title: 'Todas', stars: 2, days: ALL_DAYS });

    await repo.claimTask(cama.id, day);
    expect((await repo.pendingChecks()).map(p => p.task?.title)).toEqual(['Hacer la cama']);
    await repo.approveTask(cama.id, day);
    await repo.approveTask(cama.id, day);                                    // dos veces no paga dos veces
    expect(await repo.balance(child.id)).toBe(1.5);
    expect(await repo.pendingChecks()).toEqual([]);

    await repo.rejectTask(cama.id, day);                                     // ya pagada: no cambia
    expect((await db.checks.get(cama.id + ':' + day))?.state).toBe('approved');
    await repo.claimTask(perro.id, day);
    await repo.rejectTask(perro.id, day);
    expect((await repo.taskBoard(child, day)).claimed).toBe(0);
    await repo.claimTask(perro.id, day);                                     // tras «aún no» puede volver a marcarla
    await repo.approveTask(perro.id, day);
    expect(await repo.balance(child.id)).toBe(3.8);                          // 1,5 + 0,3 + premio 2
    const notes = (await db.events.where('type').equals('tarea').toArray()).map(e => e.note).sort();
    expect(notes).toEqual(['@ev.bonus;n=Todas', '@ev.task;n=Hacer la cama', '@ev.task;n=Pasear, al perro']);
    const board = await repo.taskBoard(child, day);
    expect([board.approved, board.items.length, board.bonuses[0].complete]).toEqual([2, 2, true]);
  });
});

/* ---------- Dos dispositivos contra el servidor, con un servicio de avisos falso ---------- */
const phone = new StarDB('tareas-movil'), tablet = new StarDB('tareas-tablet');
let url = '', server: import('node:http').Server & { flushPush: () => Promise<unknown> }, dir = '';
const pushed: { url: string; headers: Record<string, string>; body: Buffer }[] = [];
const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
const auth = crypto.randomBytes(16);
const SUB = { endpoint: 'https://push.test/abc', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starmath-tareas-'));
  const fakeFetch = async (u: string, o: { headers: Record<string, string>; body: Buffer }) => { pushed.push({ url: u, headers: o.headers, body: o.body }); return { status: 201 }; };
  server = createApp({ dataDir: dir, fetchImpl: fakeFetch, pushHosts: /^push\.test$/ });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function on<T>(d: StarDB, f: () => Promise<T>): Promise<T> { useDatabase(d); return f(); }
const post = async (p: string, body: unknown, token: string) => {
  const r = await fetch(url + p, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
};
/** Lo que haría el navegador del padre: descifrar el aviso (RFC 8291) */
function decrypt(body: Buffer) {
  const salt = body.subarray(0, 16), idlen = body[20], as = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const shared = ua.computeSecret(as);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  expect(plain[plain.length - 1]).toBe(2);                                  // delimitador del último registro
  return JSON.parse(plain.subarray(0, -1).toString());
}
/** Y lo que haría el servicio de avisos: comprobar la firma VAPID con la clave pública del servidor */
function checkVapid(header: string, key: string) {
  const [, jwt, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
  expect(k).toBe(key);
  const [h, p, s] = jwt.split('.');
  const raw = Buffer.from(key, 'base64url');
  const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') }, format: 'jwk' });
  expect(crypto.verify('sha256', Buffer.from(h + '.' + p), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))).toBe(true);
  expect(JSON.parse(Buffer.from(p, 'base64url').toString()).aud).toBe('https://push.test');
}

describe('tareas entre el móvil del padre y la tablet', () => {
  let childId = '', taskId = '', day = '', parentToken = '', tabletToken = '';
  it('el padre pone una tarea de 1,5 ★ y la tablet la recibe', async () => {
    await on(phone, async () => {
      await repo.createFamily({ lang: 'es', pin: '4321', children: [{ name: 'Sara', kind: 'zorro', petName: 'Nova', level: 3, lang: 'es' }] });
      await sync.register(url, 'tareas@example.test', 'contraseña-larga');
      childId = (await db.children.toArray())[0].id; day = await repo.today();
      taskId = (await repo.addTask({ childId, kind: 'task', title: 'Recoger la mesa', stars: 1.5, days: ALL_DAYS })).id;
      await sync.syncNow();
      parentToken = (await sync.getSyncConfig())!.token;
    });
    const { code } = await on(phone, () => sync.pairCreate());
    await on(tablet, () => sync.pairClaim(url, code));
    tabletToken = (await on(tablet, () => sync.getSyncConfig()))!.token;
    expect((await on(tablet, () => db.tasks.get(taskId)))?.stars).toBe(1.5);
  });

  it('una versión anterior de la app no recibe tablas que no conoce; al actualizar, las recibe todas', async () => {
    const old = await post('/api/sync', { since: 0, push: [] }, tabletToken);
    expect(old.json.pull.some((p: { table: string }) => p.table === 'tasks')).toBe(false);
    expect(old.json.pull.some((p: { table: string }) => p.table === 'children')).toBe(true);
    // la tablet «se actualiza»: tenía el cursor al final y no sabía de las tareas
    await on(tablet, async () => {
      await db.tasks.clear(); await db.meta.put({ key: 'syncCursor', value: old.json.seq }); await db.meta.delete('syncTables');
      await sync.syncNow();
    });
    expect(await on(tablet, () => db.tasks.count())).toBe(1);
  });

  it('solo el móvil del padre se apunta a los avisos, y solo en servicios de avisos conocidos', async () => {
    expect((await post('/api/push/subscribe', { sub: SUB, lang: 'es' }, tabletToken)).status).toBe(403);
    expect((await post('/api/push/subscribe', { sub: { ...SUB, endpoint: 'https://evil.example/x' }, lang: 'es' }, parentToken)).status).toBe(400);
    expect((await post('/api/push/subscribe', { sub: { ...SUB, endpoint: 'http://push.test/x' }, lang: 'es' }, parentToken)).status).toBe(400);
    expect((await post('/api/push/subscribe', { sub: SUB, lang: 'es' }, parentToken)).status).toBe(200);
  });

  it('la tablet la marca como hecha → el padre recibe un aviso cifrado y la ve por revisar', async () => {
    await on(tablet, async () => { await repo.claimTask(taskId, day); await sync.syncNow(); });
    await server.flushPush();
    expect(pushed).toHaveLength(1);
    const key = (await (await fetch(url + '/api/push/key')).json()).key;
    checkVapid(pushed[0].headers.authorization, key);
    expect(pushed[0].headers['content-encoding']).toBe('aes128gcm');
    expect(decrypt(pushed[0].body)).toMatchObject({ title: 'Mathzilo', body: 'Sara dice que ha hecho: Recoger la mesa', url: './#/padre' });
    await on(phone, () => sync.syncNow());
    expect((await on(phone, () => repo.pendingChecks())).map(p => p.task?.title)).toEqual(['Recoger la mesa']);
  });

  it('el padre la aprueba y las dos tienen el mismo saldo con decimal', async () => {
    await on(phone, async () => { await repo.approveTask(taskId, day); await sync.syncNow(); });
    await on(tablet, () => sync.syncNow());
    expect(await on(tablet, () => repo.balance(childId))).toBe(1.5);
    expect(await on(phone, () => repo.balance(childId))).toBe(1.5);
    expect((await on(tablet, () => db.checks.get(taskId + ':' + day)))?.state).toBe('approved');
  });

  it('la tablet no puede pagarse tareas, aprobarlas, deshacer una aprobada ni cambiarlas', async () => {
    const later = Date.now() + 60_000;
    const t2 = await on(phone, async () => { const t = await repo.addTask({ childId, kind: 'task', title: 'Leer', stars: 2, days: ALL_DAYS }); await sync.syncNow(); return t; });
    await on(tablet, () => sync.syncNow());
    const res = await post('/api/sync', { since: 0, tz: 0, dayStart: 4, push: [
      { table: 'events', op: 'put', row: { id: 'tarea:' + t2.id + ':' + day, childId, ts: later, day, type: 'tarea', amount: 2, note: '', by: 'parent', device: 'x' } },
      { table: 'checks', op: 'put', row: { id: t2.id + ':' + day, taskId: t2.id, childId, day, state: 'approved', updatedAt: later } },
      { table: 'checks', op: 'put', row: { id: taskId + ':' + day, taskId, childId, day, state: 'claimed', updatedAt: later } },
      { table: 'tasks', op: 'put', row: { ...t2, stars: 500, updatedAt: later } }
    ] }, tabletToken);
    expect(res.json.rejected.map((r: { error: string }) => r.error)).toEqual(['rol', 'rol', 'rol', 'rol']);
    // el padre sí, pero no una cantidad con dos decimales ni una tarea que no existe
    const bad = await post('/api/sync', { since: 0, tz: 0, dayStart: 4, push: [
      { table: 'events', op: 'put', row: { id: 'tarea:' + t2.id + ':' + day, childId, ts: later, day, type: 'tarea', amount: 1.25, note: '', by: 'parent', device: 'x' } },
      { table: 'events', op: 'put', row: { id: 'tarea:nada:' + day, childId, ts: later, day, type: 'tarea', amount: 1, note: '', by: 'parent', device: 'x' } }
    ] }, parentToken);
    expect(bad.json.rejected.map((r: { error: string }) => r.error)).toEqual(['cantidad', 'tarea']);
    await on(phone, () => sync.syncNow());
    expect(await on(phone, () => repo.balance(childId))).toBe(1.5);
  });

  it('borrar al hijo borra también sus tareas en el servidor', async () => {
    await on(phone, async () => { await repo.deleteChild(childId); await sync.syncNow(); });
    await on(tablet, () => sync.syncNow());
    expect(await on(tablet, () => db.tasks.count())).toBe(0);
    expect(await on(tablet, () => db.checks.count())).toBe(0);
  });
});
