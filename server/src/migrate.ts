/**
 * Sxem miqrasiyaları: db/migrations/*.sql faylları ad sırası ilə, hər biri bir dəfə tətbiq olunur.
 * Tətbiq olunanlar schema_migrations cədvəlində qeyd edilir. Server hər açılışda bunu avtomatik işlədir.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db.ts';

export function migrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) return path.resolve(process.env.MIGRATIONS_DIR);
  // src/migrate.ts (tsx) və dist/index.js (build) — hər ikisindən ../db/migrations
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations');
}

export async function migrate(db: Db, dir = migrationsDir(), log = console.log): Promise<string[]> {
  const c = await db.connect();
  try {
    // Eyni anda iki server nüsxəsi miqrasiya etməsin.
    await c.query('select pg_advisory_lock(7310431)');
    await c.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await c.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name));
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    const applied: string[] = [];
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await fs.readFile(path.join(dir, f), 'utf8');
      try {
        await c.query('begin');
        await c.query(sql);
        await c.query('insert into schema_migrations (name) values ($1)', [f]);
        await c.query('commit');
      } catch (e) {
        await c.query('rollback').catch(() => {});
        throw new Error(`Miqrasiya alınmadı: ${f}: ${(e as Error).message}`);
      }
      log(`[migrate] tətbiq olundu: ${f}`);
      applied.push(f);
    }
    return applied;
  } finally {
    await c.query('select pg_advisory_unlock(7310431)').catch(() => {});
    c.release();
  }
}
