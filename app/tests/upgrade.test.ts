/* Actualizar la app no puede borrar datos: una base creada con el esquema v1 se abre con el v3 intacta. */
import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import Dexie from 'dexie';
import { StarDB } from '../src/data/db';

it('el esquema v3 conserva los datos de la v1', async () => {
  const old = new Dexie('upgrade-check');
  old.version(1).stores({
    family: 'id', children: 'id', sessions: 'id, childId, day, endedAt', answers: 'id, sessionId, childId, skill',
    events: 'id, childId, ts, type', rewards: 'id', mastery: '[childId+skill], childId', meta: 'key', outbox: '++seq'
  });
  await old.table('children').put({ id: 'c1', name: 'Lucía' });
  await old.table('events').put({ id: 'e1', childId: 'c1', ts: 1, type: 'test', amount: 12 });
  old.close();

  const db = new StarDB('upgrade-check');
  expect((await db.children.get('c1'))?.name).toBe('Lucía');
  expect((await db.events.get('e1'))?.amount).toBe(12);
  expect(await db.flags.count()).toBe(0);
  expect(await db.tasks.count()).toBe(0);
  expect(await db.checks.count()).toBe(0);
  expect(db.verno).toBe(3);
  db.close();
});
