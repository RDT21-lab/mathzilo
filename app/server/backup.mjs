/* Mathzilo — copias de seguridad del servidor de sincronización (fase 10).
   Copia los archivos de DATA_DIR (familias e índice) a BACKUP_DIR/AAAA-MM-DD_HHMM/ y conserva las
   BACKUP_KEEP más recientes. La escritura del servidor es atómica (archivo temporal + rename), así que
   copiar en caliente es seguro.
   Uso: node server/backup.mjs                 → una copia y termina
        node server/backup.mjs --every 24h     → una copia cada 24 horas (servicio «backup» de Docker)
        node server/backup.mjs --restore <carpeta>  → restaura (con el servidor parado)          */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR ?? path.join(here, 'data');
const DEST = process.env.BACKUP_DIR ?? path.join(here, 'backups');
const KEEP = Number(process.env.BACKUP_KEEP ?? 30);

export function backupOnce(data = DATA, dest = DEST, keep = KEEP) {
  if (!fs.existsSync(data)) throw new Error('No existe ' + data);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
  const dir = path.join(dest, stamp);
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(data)) {
    if (!f.endsWith('.json')) continue;                  // ni temporales ni el registro de errores
    fs.copyFileSync(path.join(data, f), path.join(dir, f));
    n++;
  }
  const all = fs.readdirSync(dest).filter(d => /^\d{4}-\d\d-\d\d_\d{4}$/.test(d)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) fs.rmSync(path.join(dest, old), { recursive: true, force: true });
  return { dir, files: n };
}

export function restore(from, data = DATA) {
  fs.mkdirSync(data, { recursive: true });
  for (const f of fs.readdirSync(from)) if (f.endsWith('.json')) fs.copyFileSync(path.join(from, f), path.join(data, f));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args[0] === '--restore') { restore(args[1]); console.log('Restaurado desde', args[1]); }
  else {
    const run = () => { try { const r = backupOnce(); console.log(new Date().toISOString(), 'copia', r.dir, r.files, 'archivos'); } catch (e) { console.error('copia fallida:', e.message); } };
    run();
    if (args[0] === '--every') {
      const m = String(args[1] ?? '24h').match(/^(\d+)([hm])$/);
      const ms = m ? Number(m[1]) * (m[2] === 'h' ? 3600_000 : 60_000) : 86400_000;
      setInterval(run, ms);
    }
  }
}
