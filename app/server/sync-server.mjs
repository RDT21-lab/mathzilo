/* Mathzilo — servidor de sincronización (sustituye a Supabase). Node 20+, sin dependencias.
   - Cuentas de adulto (email + contraseña con scrypt) y tablets vinculadas con un código.
   - Sincronizar es unir apuntes: los movimientos de estrellas, sesiones y respuestas no se
     sobrescriben nunca; hijos, premios y ajustes ganan por fecha de modificación.
   - Los canjes y ajustes solo nacen aquí, tras comprobar el PIN (mismo PBKDF2 que la app).
   - La tablet no puede tocar reglas, PIN, niveles ni premios, ni crear apuntes negativos.
   - Aviso en tiempo real por Server-Sent Events, y Web Push al móvil del padre cuando un niño
     marca una tarea como hecha.
   - Tareas: solo el padre las crea y las da por buenas; la tablet solo puede decir «hecha».
   Datos: un archivo JSON por familia en DATA_DIR. Uso: node server/sync-server.mjs          */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { sendPush, vapidKeys } from './webpush.mjs';

const PIN_ITER = 120_000, MAX_TRIES = 5, LOCK_MS = 15 * 60_000, PAIR_MS = 10 * 60_000;
const IMMUTABLE = new Set(['sessions', 'answers', 'events', 'flags']);
const LWW = new Set(['family', 'children', 'rewards', 'tasks', 'checks']);
const TABLES = [...IMMUTABLE, ...LWW];
const CHILD_SAFE = ['petName', 'kind', 'lang', 'sound', 'bigText', 'bestStreak', 'updatedAt'];
const BY_CHILD = ['sessions', 'answers', 'events', 'flags', 'tasks', 'checks'];
// Servicios de avisos de los navegadores: el servidor no envía nada a otras direcciones
const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
const PUSH_TXT = {
  es: { claim: '{name} dice que ha hecho: {task}', more: '{name} ha marcado {n} tareas como hechas', test: 'Los avisos de Mathzilo funcionan en este dispositivo.' },
  en: { claim: '{name} says this is done: {task}', more: '{name} marked {n} tasks as done', test: 'Mathzilo notifications work on this device.' },
  fr: { claim: '{name} dit avoir fait : {task}', more: '{name} a marqué {n} tâches comme faites', test: 'Les notifications Mathzilo fonctionnent sur cet appareil.' },
  de: { claim: '{name} sagt, erledigt: {task}', more: '{name} hat {n} Aufgaben als erledigt markiert', test: 'Mathzilo-Benachrichtigungen funktionieren auf diesem Gerät.' }
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
const round1 = n => Math.round(n * 10) / 10;

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const rnd = n => crypto.randomBytes(n).toString('hex');
function hashPass(p, salt = rnd(16)) { return { salt, hash: crypto.scryptSync(p, salt, 32).toString('hex') }; }
function pinOk(fam, pin) {
  if (!fam?.pinHash || !/^\d{4,6}$/.test(String(pin ?? ''))) return false;
  const h = crypto.pbkdf2Sync(String(pin), Buffer.from(fam.pinSalt, 'hex'), PIN_ITER, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(fam.pinHash));
}
export function dayOf(ts, tzOffsetMin, dayStartHour) {
  return new Date(ts - tzOffsetMin * 60_000 - dayStartHour * 3600_000).toISOString().slice(0, 10);
}

export function createApp({ dataDir, staticDir = null, now = () => Date.now(), fetchImpl = (...a) => fetch(...a), pushHosts = PUSH_HOSTS,
                           pushSubject = process.env.PUSH_SUBJECT || 'https://github.com/RDT21-lab/mathzilo' } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  const indexFile = path.join(dataDir, 'index.json');
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { emails: {}, tokens: {} };
  const cache = new Map();
  const streams = new Map();                                   // familyId → Set<res>
  const compressed = new Map();                                // archivos estáticos ya comprimidos
  const logRate = new Map();                                   // familyId → marcas de tiempo de errores recibidos
  const pending = new Set();                                   // avisos en camino (las pruebas esperan a que terminen)
  if (!index.vapid) { index.vapid = vapidKeys(); fs.writeFileSync(indexFile, JSON.stringify(index)); }

  const saveIndex = () => fs.writeFileSync(indexFile, JSON.stringify(index));
  const famFile = id => path.join(dataDir, 'family-' + id.replace(/[^a-z0-9-]/gi, '') + '.json');
  function load(id) {
    if (!cache.has(id)) cache.set(id, fs.existsSync(famFile(id)) ? JSON.parse(fs.readFileSync(famFile(id), 'utf8'))
      : { id, seq: 0, rows: Object.fromEntries(TABLES.map(t => [t, {}])), log: [], pair: {}, pinLock: { fails: 0, until: 0 } });
    const st = cache.get(id);
    for (const t of TABLES) st.rows[t] ??= {};                     // familias creadas antes de las tareas
    return st;
  }
  function save(st) { const tmp = famFile(st.id) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(st)); fs.renameSync(tmp, famFile(st.id)); }
  function record(st, table, op, id, row) {
    st.seq++;
    if (op === 'put') st.rows[table][id] = { row, seq: st.seq };
    else delete st.rows[table][id];
    st.log.push({ seq: st.seq, table, op, id });
  }
  function notify(st) { for (const res of streams.get(st.id) ?? []) res.write('event: change\ndata: ' + JSON.stringify({ seq: st.seq }) + '\n\n'); }
  function newToken(familyId, role, label) {
    const tok = rnd(32);
    index.tokens[sha(tok)] = { familyId, role, label, createdAt: now() };
    saveIndex();
    return tok;
  }
  function auth(req) {
    const m = (req.headers.authorization ?? '').match(/^Bearer (\w+)$/) ?? [null, new URL(req.url, 'http://x').searchParams.get('token')];
    const t = m[1] && index.tokens[sha(m[1])];
    return t ? { ...t } : null;
  }
  const balance = (st, childId) => round1(Object.values(st.rows.events).reduce((s, { row }) => s + (row.childId === childId ? row.amount : 0), 0));

  /* Avisos al móvil del padre. Se envían después de responder; las suscripciones caducadas se borran */
  function push(st, payloadFor) {
    const subs = Object.entries(st.push ?? {});
    if (!subs.length) return Promise.resolve(0);
    const job = Promise.all(subs.map(async ([k, s]) => {
      try {
        const status = await sendPush(s.sub, payloadFor(PUSH_TXT[s.lang] ?? PUSH_TXT.es), index.vapid, pushSubject, fetchImpl);
        if ((status === 404 || status === 410) && cache.get(st.id) === st) { delete st.push[k]; save(st); }   // no si la cuenta se borró
        return status < 300 ? 1 : 0;
      } catch { return 0; }
    })).then(r => r.reduce((a, b) => a + b, 0));
    pending.add(job); job.finally(() => pending.delete(job));
    return job;
  }
  function pushClaims(st, claims) {
    const byChild = new Map();
    for (const c of claims) byChild.set(c.childId, [...(byChild.get(c.childId) ?? []), c]);
    for (const [childId, list] of byChild) {
      const name = st.rows.children[childId]?.row.name ?? '';
      const task = st.rows.tasks[list[0].taskId]?.row.title ?? '';
      push(st, T => ({ title: 'Mathzilo', body: list.length > 1 ? fill(T.more, { name, n: list.length }) : fill(T.claim, { name, task }),
                       tag: 'tareas-' + childId, url: './#/padre' }));
    }
  }

  /* PIN con bloqueo en el servidor */
  function checkPin(st, pin) {
    const t = now();
    if (st.pinLock.until > t) return { ok: false, locked: true };
    const fam = st.rows.family.family?.row;
    if (pinOk(fam, pin)) { st.pinLock = { fails: 0, until: 0 }; return { ok: true }; }
    const fails = st.pinLock.fails + 1;
    st.pinLock = fails >= MAX_TRIES ? { fails: 0, until: t + LOCK_MS } : { fails, until: 0 };
    save(st);
    return { ok: false, locked: fails >= MAX_TRIES, triesLeft: Math.max(0, MAX_TRIES - fails) };
  }

  /* Reglas de lo que cada rol puede subir */
  function accept(st, role, item, ctx) {
    const { table, op } = item;
    if (!TABLES.includes(table)) return 'tabla';
    if (op === 'del') {
      if (table !== 'children' || role !== 'parent') return 'rol';
      const id = item.id;
      for (const t of BY_CHILD) for (const [rid, { row }] of Object.entries(st.rows[t] ?? {})) if (row.childId === id) record(st, t, 'del', rid);
      if (st.rows.children[id]) record(st, 'children', 'del', id);
      return null;
    }
    const row = item.row;
    if (!row || typeof row.id !== 'string') return 'fila';
    const prev = st.rows[table][row.id]?.row;
    if (IMMUTABLE.has(table)) {
      if (prev) return null;                                     // ya estaba: unir, no sobrescribir
      if (table === 'flags' && (typeof row.gen !== 'string' || typeof row.tag !== 'string' || !st.rows.children[row.childId])) return 'fila';
      if (table === 'sessions') {
        const serverDay = dayOf(Math.min(row.endedAt, now()), ctx.tz, ctx.dayStart);
        if (row.endedAt > now() + 10 * 60_000 || serverDay < row.day) row.serverDay = serverDay;   // reloj adelantado
      }
      if (table === 'events') {
        if (row.type === 'canje' || row.type === 'ajuste' || row.amount < 0) {
          if (!ctx.import) return 'solo-servidor';                // solo al subir por primera vez los datos de un dispositivo
          record(st, table, 'put', row.id, row);
          return null;
        }
        if (row.type === 'tarea') {
          // solo el padre paga tareas; el identificador fija la tarea y el día (no se paga dos veces)
          if (role !== 'parent') return 'rol';
          const m = /^tarea:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(row.id), task = m && st.rows.tasks[m[1]]?.row;
          if (!task || task.childId !== row.childId || row.day !== m[2]) return 'tarea';
          if (!(row.amount > 0 && row.amount <= 1000 && round1(row.amount) === row.amount)) return 'cantidad';
          record(st, table, 'put', row.id, row);
          return null;
        }
        const rules = st.rows.family.family?.row?.settings?.rules;
        const ses = row.sessionId && st.rows.sessions[row.sessionId]?.row;
        if (!ses || ses.childId !== row.childId) return 'sin-sesion';
        if (row.type === 'racha' && rules && !Object.values(rules.streakBonus).includes(row.amount)) return 'racha';
        if (row.type === 'test' && rules) {
          const cap = ses.length * rules.perCorrect + Math.max(0, ...Object.values(rules.passBonus)) + rules.perfect;
          const already = Object.values(st.rows.events).filter(e => e.row.sessionId === ses.id && e.row.type === 'test').reduce((s, e) => s + e.row.amount, 0);
          if (already + row.amount > cap) return 'tope';
          // un solo test con estrellas por hijo y día
          const day = ses.serverDay ?? ses.day;
          const other = Object.values(st.rows.events).find(e => e.row.type === 'test' && e.row.childId === row.childId && e.row.sessionId !== ses.id &&
            ((st.rows.sessions[e.row.sessionId]?.row.serverDay ?? st.rows.sessions[e.row.sessionId]?.row.day) === day));
          if (other) return 'segundo-test';
        }
      }
      record(st, table, 'put', row.id, row);
      return null;
    }
    // LWW: gana el cambio más reciente
    if (prev && (prev.updatedAt ?? 0) >= (row.updatedAt ?? 0)) return null;
    if (table === 'tasks') {
      if (role !== 'parent') return 'rol';
      if (!st.rows.children[row.childId]) return 'fila';
    }
    if (table === 'checks') {
      const task = st.rows.tasks[row.taskId]?.row;
      if (!task || task.childId !== row.childId || row.id !== row.taskId + ':' + row.day || !['claimed', 'approved', 'rejected'].includes(row.state)) return 'fila';
      if (role !== 'parent' && (row.state !== 'claimed' || prev?.state === 'approved')) return 'rol';   // la tablet solo dice «hecha»
      if (row.state === 'claimed' && prev?.state !== 'claimed' && task.active && !task.deleted) ctx.claims.push(row);
      record(st, table, 'put', row.id, row);
      return null;
    }
    if (role !== 'parent') {
      if (table === 'family' || table === 'rewards') return 'rol';
      if (table === 'children') {
        if (!prev) return 'rol';
        const merged = { ...prev };
        for (const k of CHILD_SAFE) if (k in row) merged[k] = row[k];
        merged.bestStreak = Math.max(prev.bestStreak ?? 0, merged.bestStreak ?? 0);
        record(st, table, 'put', row.id, merged);
        return null;
      }
    }
    if (table === 'children' && prev) row.bestStreak = Math.max(prev.bestStreak ?? 0, row.bestStreak ?? 0);
    record(st, table, 'put', row.id, row);
    return null;
  }

  const routes = {
    'POST /api/register': (b) => {
      const email = String(b.email ?? '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+$/.test(email) || String(b.password ?? '').length < 8) return [400, { error: 'datos' }];
      if (index.emails[email]) return [409, { error: 'existe' }];
      const familyId = 'f-' + rnd(8);
      index.emails[email] = { familyId, ...hashPass(String(b.password)) };
      const st = load(familyId); st.importOpen = true; save(st);
      return [200, { familyId, token: newToken(familyId, 'parent', email) }];
    },
    'POST /api/login': (b) => {
      const email = String(b.email ?? '').trim().toLowerCase(), acc = index.emails[email];
      if (!acc || hashPass(String(b.password ?? ''), acc.salt).hash !== acc.hash) return [401, { error: 'login' }];
      return [200, { familyId: acc.familyId, token: newToken(acc.familyId, 'parent', email) }];
    },
    'POST /api/pair/create': (b, a) => {
      if (a?.role !== 'parent') return [403, { error: 'rol' }];
      const st = load(a.familyId), code = String(crypto.randomInt(100000, 1000000));
      st.pair[code] = now() + PAIR_MS; save(st);
      index.pairs = { ...(index.pairs ?? {}), [code]: a.familyId }; saveIndex();
      return [200, { code, expiresIn: PAIR_MS / 1000 }];
    },
    'POST /api/pair/claim': (b) => {
      const code = String(b.code ?? ''), familyId = index.pairs?.[code];
      const st = familyId && load(familyId);
      if (!st || !(st.pair[code] > now())) return [404, { error: 'codigo' }];
      delete st.pair[code]; delete index.pairs[code]; save(st);
      return [200, { familyId, token: newToken(familyId, 'tablet', 'tablet') }];
    },
    'POST /api/sync': (b, a) => {
      if (!a) return [401, { error: 'token' }];
      const st = load(a.familyId);
      let role = a.role;
      if (role !== 'parent' && b.pin !== undefined) { if (!checkPin(st, b.pin).ok) return [403, { error: 'pin' }]; role = 'parent'; }
      const ctx = { tz: Number(b.tz) || 0, dayStart: Number(b.dayStart) || 0, import: !!b.import && role === 'parent' && !!st.importOpen, claims: [] };
      const before = st.seq, rejected = [];
      // la familia primero: sus reglas validan lo demás
      const push = Array.isArray(b.push) ? [...b.push].sort((x, y) => (x.table === 'family' ? -1 : 0) - (y.table === 'family' ? -1 : 0)) : [];
      for (const item of push) {
        const err = accept(st, role, item, ctx);
        if (err) rejected.push({ table: item.table, id: item.row?.id ?? item.id, error: err });
      }
      if (ctx.import) st.importOpen = false;
      if (st.seq !== before || ctx.import) { save(st); notify(st); }
      if (ctx.claims.length) pushClaims(st, ctx.claims);
      const since = Number(b.since) || 0;
      // cada versión de la app dice qué tablas conoce; las anteriores a las tareas no lo dicen
      const known = new Set(Array.isArray(b.tables) ? b.tables : ['family', 'children', 'rewards', 'sessions', 'answers', 'events', 'flags']);
      const seen = new Map();
      for (const e of st.log) if (e.seq > since && known.has(e.table)) seen.set(e.table + ':' + e.id, e);
      const pull = [...seen.values()].sort((x, y) => x.seq - y.seq).map(e => e.op === 'put' && st.rows[e.table][e.id]
        ? { table: e.table, op: 'put', row: st.rows[e.table][e.id].row } : { table: e.table, op: 'del', id: e.id });
      return [200, { seq: st.seq, pull, rejected, serverTime: now(), role }];
    },
    'POST /api/redeem': (b, a) => {
      if (!a) return [401, { error: 'token' }];
      const st = load(a.familyId);
      const pin = checkPin(st, b.pin);
      if (!pin.ok) return [403, { error: pin.locked ? 'bloqueado' : 'pin', triesLeft: pin.triesLeft }];
      const e = b.event ?? {};
      if (typeof e.id !== 'string' || st.rows.events[e.id]) return [400, { error: 'id' }];
      if (!st.rows.children[e.childId]) return [404, { error: 'hijo' }];
      let amount;
      if (e.type === 'canje') {
        amount = -Math.abs(Math.trunc(Number(e.amount)));
        if (!amount) return [400, { error: 'cantidad' }];
        if (round1(balance(st, e.childId) + amount) < 0) return [409, { error: 'saldo', balance: balance(st, e.childId) }];
      } else if (e.type === 'ajuste') {
        const ref = st.rows.events[e.ref]?.row;
        if (!ref || ref.childId !== e.childId) return [404, { error: 'ref' }];
        if (Object.values(st.rows.events).some(x => x.row.ref === e.ref)) return [409, { error: 'ya-corregido' }];
        amount = -ref.amount;
      } else return [400, { error: 'tipo' }];
      const t = now();
      const row = { id: e.id, childId: e.childId, ts: t, day: dayOf(t, Number(b.tz) || 0, Number(b.dayStart) || 0), type: e.type, amount,
        note: String(e.note ?? '').slice(0, 60), by: 'parent', device: String(e.device ?? ''), ...(e.ref ? { ref: e.ref } : {}) };
      record(st, 'events', 'put', row.id, row);
      save(st); notify(st);
      return [200, { event: row, seq: st.seq, balance: balance(st, e.childId) }];
    },
    /* Avisos: clave pública, alta y baja de un móvil del padre, y aviso de prueba */
    'GET /api/push/key': () => [200, { key: index.vapid.publicKey }],
    'POST /api/push/subscribe': (b, a) => {
      if (a?.role !== 'parent') return [403, { error: 'rol' }];
      const sub = b.sub ?? {}, keys = sub.keys ?? {};
      let host = '';
      try { const u = new URL(String(sub.endpoint)); if (u.protocol === 'https:') host = u.hostname; } catch { /* no es una dirección */ }
      if (!host || !pushHosts.test(host) || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return [400, { error: 'suscripcion' }];
      const st = load(a.familyId);
      st.push ??= {};
      st.push[sha(sub.endpoint)] = { sub: { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, lang: PUSH_TXT[b.lang] ? b.lang : 'es', at: now() };
      st.push = Object.fromEntries(Object.entries(st.push).sort((x, y) => y[1].at - x[1].at).slice(0, 10));   // como mucho 10 móviles
      save(st);
      return [200, { ok: true }];
    },
    'POST /api/push/unsubscribe': (b, a) => {
      if (a?.role !== 'parent') return [403, { error: 'rol' }];
      const st = load(a.familyId);
      if (st.push) { delete st.push[sha(String(b.endpoint ?? ''))]; save(st); }
      return [200, { ok: true }];
    },
    'POST /api/push/test': async (b, a) => {
      if (a?.role !== 'parent') return [403, { error: 'rol' }];
      const sent = await push(load(a.familyId), T => ({ title: 'Mathzilo', body: T.test, tag: 'prueba', url: './#/padre' }));
      return [200, { sent }];
    },
    /* Registro de errores de la app, sin datos personales: solo mensaje, pila y versión */
    'POST /api/log': (b, a) => {
      if (!a) return [401, { error: 'token' }];
      const t = now(), bucket = (logRate.get(a.familyId) ?? []).filter(x => x > t - 3600_000);
      const list = (Array.isArray(b.errors) ? b.errors : []).slice(0, 20);
      if (bucket.length + list.length > 60) return [429, { error: 'limite' }];
      logRate.set(a.familyId, [...bucket, ...list.map(() => t)]);
      const clean = s => String(s ?? '').replace(/[^\s@"'<>]+@[^\s@"'<>]+/g, '<email>').replace(/token=\w+/g, 'token=<x>').slice(0, 2000);
      const file = path.join(dataDir, 'errors.log');
      if (fs.existsSync(file) && fs.statSync(file).size > 1_000_000) fs.renameSync(file, file + '.1');
      fs.appendFileSync(file, list.map(e => JSON.stringify({ ts: new Date(t).toISOString(), at: Number(e.ts) || 0, v: clean(e.v).slice(0, 20),
        where: clean(e.where).slice(0, 40), msg: clean(e.msg).slice(0, 300), stack: clean(e.stack), role: a.role }) + '\n').join(''));
      return [200, { ok: true, saved: list.length }];
    },
    'POST /api/account/delete': (b, a) => {
      if (a?.role !== 'parent') return [403, { error: 'rol' }];
      const st = load(a.familyId);
      if (!checkPin(st, b.pin).ok) return [403, { error: 'pin' }];
      for (const [k, v] of Object.entries(index.emails)) if (v.familyId === a.familyId) delete index.emails[k];
      for (const [k, v] of Object.entries(index.tokens)) if (v.familyId === a.familyId) delete index.tokens[k];
      saveIndex(); cache.delete(a.familyId);
      fs.rmSync(famFile(a.familyId), { force: true });
      return [200, { ok: true }];
    }
  };

  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
                 '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/api/events') {
      const a = auth(req);
      if (!a) { res.writeHead(401); res.end(); return; }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write('retry: 5000\n\n');
      if (!streams.has(a.familyId)) streams.set(a.familyId, new Set());
      streams.get(a.familyId).add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => { clearInterval(ping); streams.get(a.familyId)?.delete(res); });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/time') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ serverTime: now() })); return; }
    const route = routes[req.method + ' ' + url.pathname];
    if (route) {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 5_000_000) req.destroy(); });
      req.on('end', async () => {
        let out;
        try { out = await route(body ? JSON.parse(body) : {}, auth(req)); } catch (e) { out = [400, { error: 'json', detail: String(e.message) }]; }
        res.writeHead(out[0], { 'content-type': 'application/json' });
        res.end(JSON.stringify(out[1]));
      });
      return;
    }
    if (staticDir && req.method === 'GET') {
      let file = path.join(staticDir, decodeURIComponent(url.pathname));
      if (!file.startsWith(staticDir)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, 'index.html');
      if (fs.existsSync(file)) {
        const type = MIME[path.extname(file)] ?? 'application/octet-stream';
        const headers = { 'content-type': type, vary: 'accept-encoding', 'cache-control': file.endsWith('index.html') || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=31536000' };
        const accept = String(req.headers['accept-encoding'] ?? '');
        const enc = /^(text|application\/(json|manifest)|image\/svg)/.test(type) || type === 'text/javascript' ? (accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : null) : null;
        if (enc) {
          // comprimido una vez y guardado en memoria (los archivos de dist/ no cambian mientras corre)
          const key = enc + ':' + file + ':' + fs.statSync(file).mtimeMs;
          if (!compressed.has(key)) {
            const raw = fs.readFileSync(file);
            compressed.set(key, enc === 'br' ? zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }) : zlib.gzipSync(raw, { level: 9 }));
          }
          const body = compressed.get(key);
          res.writeHead(200, { ...headers, 'content-encoding': enc, 'content-length': body.length });
          res.end(body);
          return;
        }
        res.writeHead(200, headers);
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404); res.end();
  });
  /** Para las pruebas: espera a que salgan los avisos pendientes */
  server.flushPush = () => Promise.all([...pending]);
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const port = Number(process.env.PORT ?? 8787);
  const dist = path.resolve(here, '..', 'dist');
  createApp({ dataDir: process.env.DATA_DIR ?? path.join(here, 'data'), staticDir: fs.existsSync(dist) ? dist : null })
    .listen(port, () => console.log('Mathzilo sync en http://localhost:' + port + (fs.existsSync(dist) ? ' (sirviendo la app de dist/)' : '')));
}
