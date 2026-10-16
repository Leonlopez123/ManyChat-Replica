// Wendet db/migrations/*.sql an. Railway: läuft vor jedem Start (siehe railway.json).
// Die App migriert beim ersten Zugriff ohnehin selbst; das Skript macht Fehler beim Deploy früh sichtbar.
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL ?? 'pglite:./.data/db';
const dir = path.join(process.cwd(), 'db', 'migrations');

let exec, query, close;
if (url.startsWith('pglite:')) {
  const { PGlite } = await import('@electric-sql/pglite');
  const target = url.slice('pglite:'.length);
  fs.mkdirSync(path.resolve(target), { recursive: true });
  const db = new PGlite(path.resolve(target));
  exec = (t) => db.exec(t);
  query = async (t) => (await db.query(t)).rows;
  close = () => db.close();
} else {
  const postgres = (await import('postgres')).default;
  const db = postgres(url, { max: 1, onnotice: () => {} });
  exec = (t) => db.unsafe(t);
  query = (t) => db.unsafe(t);
  close = () => db.end();
}

await exec('create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())');
const applied = new Set((await query('select name from _migrations')).map((r) => r.name));
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (applied.has(f)) continue;
  const body = fs.readFileSync(path.join(dir, f), 'utf8');
  await exec(`begin;\n${body}\ninsert into _migrations (name) values ('${f.replace(/'/g, "''")}');\ncommit;`);
  console.log('angewendet:', f);
}
console.log('Migrationen aktuell.');
await close();
