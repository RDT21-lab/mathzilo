/* Base de datos local (IndexedDB con Dexie). Todo lo que el niño necesita vive aquí y funciona
   sin conexión; la nube solo recibe copias desde la cola `outbox`.                           */
import Dexie, { type Table } from 'dexie';
import type { Answer, Child, Family, Flag, Mastery, OutboxItem, Reward, Session, StarEvent } from './types';

export class StarDB extends Dexie {
  family!: Table<Family, string>;
  children!: Table<Child, string>;
  sessions!: Table<Session, string>;
  answers!: Table<Answer, string>;
  events!: Table<StarEvent, string>;
  rewards!: Table<Reward, string>;
  mastery!: Table<Mastery, [string, string]>;
  meta!: Table<{ key: string; value: unknown }, string>;
  outbox!: Table<OutboxItem, number>;
  flags!: Table<Flag, string>;

  constructor(name = 'starmath') {
    super(name);
    this.version(1).stores({
      family: 'id',
      children: 'id',
      sessions: 'id, childId, day, endedAt',
      answers: 'id, sessionId, childId, skill',
      events: 'id, childId, ts, type',
      rewards: 'id',
      mastery: '[childId+skill], childId',
      meta: 'key',
      outbox: '++seq'
    });
    // v2: marcas «no lo entiendo» del piloto (fase 11)
    this.version(2).stores({ flags: 'id, childId, ts' });
  }
}

export let db = new StarDB();
/** Para las pruebas: otra base de datos con otro nombre (dos dispositivos simulados) */
export function useDatabase(d: StarDB) { db = d; }

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const r = await db.meta.get(key);
  return r ? (r.value as T) : fallback;
}
export async function setMeta(key: string, value: unknown) { await db.meta.put({ key, value }); }

export async function deviceId(): Promise<string> {
  let id = await getMeta<string>('device', '');
  if (!id) { id = 'dev-' + crypto.randomUUID().slice(0, 8); await setMeta('device', id); }
  return id;
}
