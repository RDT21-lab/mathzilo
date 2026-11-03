/* Servidor: copias de seguridad, registro de errores sin datos personales, marcas «no lo entiendo» y defensas. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
// @ts-expect-error módulo JS del servidor
import { createApp } from '../server/sync-server.mjs';
// @ts-expect-error módulo JS del servidor
import { backupOnce, restore } from '../server/backup.mjs';
import { scrub } from '../src/errors';

let url = '', server: import('node:http').Server, dir = '';
const post = async (p: string, body: unknown, token?: string) => {
  const r = await fetch(url + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
};

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starmath-srv-'));
  server = createApp({ dataDir: path.join(dir, 'data') });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

describe('servidor', () => {
  let token = '';
  it('registro de errores: exige token, limpia datos personales y limita el volumen', async () => {
    token = (await post('/api/register', { email: 'log@example.test', password: 'clave-larga-1' })).json.token;
    expect((await post('/api/log', { errors: [] })).status).toBe(401);
    const r = await post('/api/log', { errors: [{ ts: 1, v: '0.9.0', where: '#/', msg: 'fallo de ana@example.com token=abc123', stack: 'at x' }] }, token);
    expect(r.json.saved).toBe(1);
    const log = fs.readFileSync(path.join(dir, 'data', 'errors.log'), 'utf8');
    expect(log).not.toContain('ana@example.com');
    expect(log).not.toContain('abc123');
    expect(log).not.toContain('log@example.test');
    const many = Array.from({ length: 20 }, () => ({ ts: 1, v: 'x', where: '', msg: 'm', stack: '' }));
    let last = 200;
    for (let i = 0; i < 4; i++) last = (await post('/api/log', { errors: many }, token)).status;
    expect(last).toBe(429);
  });

  it('la app limpia el mensaje antes de enviarlo', () => {
    expect(scrub('Error al guardar "Lucía" de ana@x.es con id 1234567')).toBe('Error al guardar "…" de <email> con id <n>');
  });

  it('marcas «no lo entiendo»: se aceptan si el hijo existe', async () => {
    const child = { id: 'c1', name: 'Ana', kind: 'zorro', petName: 'Nova', level: 2, lang: 'es', tone: 'young', maxLen: 20, bestStreak: 0, sound: true, createdAt: 1, updatedAt: 1 };
    const flag = (id: string, childId: string) => ({ table: 'flags', op: 'put', row: { id, childId, ts: 1, gen: 'add-carry', tag: 'olvido-llevada', lang: 'es', tone: 'young' } });
    const r = await post('/api/sync', { since: 0, push: [{ table: 'children', op: 'put', row: child }, flag('f1', 'c1'), flag('f2', 'nadie')] }, token);
    expect(r.json.rejected.map((x: { id: string }) => x.id)).toEqual(['f2']);
    expect(r.json.pull.some((p: { table: string }) => p.table === 'flags')).toBe(true);
  });

  it('una dirección mal formada no tumba el servidor ni sale de la carpeta de la app', async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starmath-static-'));
    fs.mkdirSync(path.join(d, 'dist')); fs.mkdirSync(path.join(d, 'dist-secreto'));
    fs.writeFileSync(path.join(d, 'dist', 'index.html'), 'app'); fs.writeFileSync(path.join(d, 'dist-secreto', 'x.txt'), 'secreto');
    const s2 = createApp({ dataDir: path.join(d, 'data'), staticDir: path.join(d, 'dist') });
    await new Promise<void>(r => s2.listen(0, '127.0.0.1', () => r()));
    const u = 'http://127.0.0.1:' + (s2.address() as AddressInfo).port;
    expect((await fetch(u + '/%zz')).status).toBe(400);
    expect(await (await fetch(u + '/..%2Fdist-secreto%2Fx.txt')).text()).not.toContain('secreto');
    expect(await (await fetch(u + '/')).text()).toBe('app');                     // sigue vivo
    s2.close(); fs.rmSync(d, { recursive: true, force: true });
  });

  it('cada familia solo ve lo suyo: otra familia no puede leer ni escribir sus datos', async () => {
    const a = (await post('/api/register', { email: 'familia-a@example.test', password: 'clave-larga-a' })).json;
    const b = (await post('/api/register', { email: 'familia-b@example.test', password: 'clave-larga-b' })).json;
    expect(a.familyId).not.toBe(b.familyId);
    const kid = { id: 'kid-a', name: 'Hijo de A', kind: 'zorro', petName: 'Nova', level: 2, lang: 'es', tone: 'young', maxLen: 20, bestStreak: 0, sound: true, createdAt: 1, updatedAt: 1 };
    await post('/api/sync', { since: 0, push: [{ table: 'children', op: 'put', row: kid }] }, a.token);
    // B pide todo desde el principio: no recibe nada de A
    const pullB = (await post('/api/sync', { since: 0, push: [] }, b.token)).json.pull;
    expect(pullB.some((p: { row?: { id: string } }) => p.row?.id === 'kid-a')).toBe(false);
    // B intenta canjear estrellas del hijo de A: el hijo no existe en su familia
    const redeem = await post('/api/redeem', { pin: '1234', event: { id: 'x', childId: 'kid-a', type: 'canje', amount: 1 } }, b.token);
    expect(redeem.status).toBeGreaterThanOrEqual(400);
    // un código de vinculación de A une la tablet a A, nunca a B
    const code = (await post('/api/pair/create', {}, a.token)).json.code;
    const tablet = (await post('/api/pair/claim', { code })).json;
    expect(tablet.familyId).toBe(a.familyId);
    const pullTablet = (await post('/api/sync', { since: 0, push: [] }, tablet.token)).json.pull;
    expect(pullTablet.some((p: { row?: { id: string } }) => p.row?.id === 'kid-a')).toBe(true);
    // sin token o con uno inventado, nada
    expect((await post('/api/sync', { since: 0 })).status).toBe(401);
    expect((await post('/api/sync', { since: 0 }, 'f'.repeat(64))).status).toBe(401);
  });

  // al final: deja bloqueada la vinculación en este servidor durante 15 min
  it('fuerza bruta: contraseña y código de vinculación se bloquean tras muchos fallos', async () => {
    await post('/api/register', { email: 'bruta@example.test', password: 'clave-buena-1' });
    for (let i = 0; i < 10; i++) expect((await post('/api/login', { email: 'bruta@example.test', password: 'mala-' + i })).status).toBe(401);
    expect((await post('/api/login', { email: 'bruta@example.test', password: 'clave-buena-1' })).json.error).toBe('intentos');
    let st = 0;
    for (let i = 0; i < 31; i++) st = (await post('/api/pair/claim', { code: String(100000 + i) })).status;
    expect(st).toBe(429);
  });

  it('copia de seguridad y restauración', () => {
    const data = path.join(dir, 'data'), dest = path.join(dir, 'backups');
    const a = backupOnce(data, dest, 2);
    expect(a.files).toBeGreaterThanOrEqual(2);                    // índice + familia
    expect(fs.readdirSync(a.dir).some((f: string) => f.startsWith('family-'))).toBe(true);
    const restored = path.join(dir, 'restored');
    restore(a.dir, restored);
    expect(fs.readdirSync(restored).sort()).toEqual(fs.readdirSync(a.dir).sort());
  });
});
