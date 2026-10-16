// Eine Datenbank, zwei Treiber: PGlite (eingebettet, lokal und in Tests) oder echtes Postgres (Railway, Supabase).
// Alle Tabellen liegen im Schema "kommentar_dm"; Migrationen laufen mit search_path auf dieses Schema.
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';
import { SCHEMA } from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  db: Db;
  /** Mehrere SQL-Anweisungen ohne Parameter ausführen (für Migrationen). */
  exec(sqlText: string): Promise<void>;
}

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

export function postgresOptions(url: string) {
  return {
    // Serverless (Vercel): jede Instanz hält höchstens eine Verbindung, den Rest regelt der Supabase-Pooler
    max: process.env.VERCEL ? 1 : 5,
    onnotice: () => {},
    // Supabase-Pooler im Transaction-Modus (Port 6543) kennt keine Prepared Statements
    prepare: false,
    // Supabase verlangt TLS; Railway-intern und lokal nicht
    ssl: /supabase\.(co|com)/.test(url) && !/sslmode=/.test(url) ? ('require' as const) : undefined,
  };
}

export async function createDb(url: string): Promise<Database> {
  if (url.includes('${{')) {
    throw new Error(
      'DATABASE_URL ist ein unaufgelöster Railway-Verweis. Bei Railway: Variables → DATABASE_URL löschen und über "Add Reference" die Variable DATABASE_URL des Postgres-Dienstes auswählen, oder die Supabase-Adresse eintragen.',
    );
  }
  if (url.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const dir = url.slice('pglite:'.length);
    if (dir !== 'memory') fs.mkdirSync(path.resolve(dir), { recursive: true });
    const client = dir === 'memory' ? new PGlite() : new PGlite(path.resolve(dir));
    return {
      db: drizzle(client, { schema }) as unknown as Db,
      exec: async (t) => { await client.exec(t); },
    };
  }
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const client = postgres(url, postgresOptions(url));
  return {
    db: drizzle(client, { schema }) as unknown as Db,
    exec: async (t) => { await client.unsafe(t); },
  };
}

export function rowsOf<T>(res: unknown): T[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as T[];
}

export const MIGRATIONS_BOOTSTRAP = `create schema if not exists ${SCHEMA};
create table if not exists ${SCHEMA}._migrations (name text primary key, applied_at timestamptz not null default now());`;

export function migrationScript(name: string, body: string) {
  return `begin;\nset local search_path to ${SCHEMA}, public;\n${body}\ninsert into ${SCHEMA}._migrations (name) values ('${name.replace(/'/g, "''")}');\ncommit;`;
}

/** Wendet alle noch nicht angewendeten db/migrations/*.sql in Dateinamen-Reihenfolge an. */
export async function migrate({ db, exec }: Database, dir = MIGRATIONS_DIR): Promise<string[]> {
  await exec(MIGRATIONS_BOOTSTRAP);
  const applied = new Set(rowsOf<{ name: string }>(await db.execute(sql`select name from kommentar_dm._migrations`)).map((r) => r.name));
  const ran: string[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(f)) continue;
    await exec(migrationScript(f, fs.readFileSync(path.join(dir, f), 'utf8')));
    ran.push(f);
  }
  return ran;
}

const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

/** App-weite Verbindung; migriert beim ersten Zugriff. */
export function getDb(): Promise<Db> {
  if (!globalForDb.__db) {
    globalForDb.__db = (async () => {
      const database = await createDb(process.env.DATABASE_URL ?? 'pglite:./.data/db');
      await migrate(database);
      return database.db;
    })().catch((e) => {
      globalForDb.__db = undefined;
      throw e;
    });
  }
  return globalForDb.__db;
}

export { schema };
