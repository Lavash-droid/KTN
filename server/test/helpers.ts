/** Test mühiti: hər test faylı üçün ayrıca, təmiz verilənlər bazası və şəkil qovluğu. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createPool, type Db } from '../src/db.ts';
import { migrate } from '../src/migrate.ts';
import { DiskPhotoStore } from '../src/storage.ts';

/** Məs. postgres://postgres@127.0.0.1:5432/postgres — test bazaları bu serverdə yaradılıb silinir. */
export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/postgres';

export interface TestEnv {
  app: ReturnType<typeof createApp>;
  db: Db;
  dbUrl: string;
  storageDir: string;
  close(): Promise<void>;
}

export async function setup(env: Record<string, string> = {}, fetchImpl: typeof fetch = fetch): Promise<TestEnv> {
  const name = `suru_test_${crypto.randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const db = createPool(url.toString());
  await migrate(db, undefined, () => {});
  const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'suru-photos-'));
  const allEnv = {
    DATABASE_URL: url.toString(),
    PUBLIC_URL: 'https://api.test',
    PHOTO_URL_SECRET: 'x'.repeat(40),
    STORAGE_DIR: storageDir,
    LIMIT_SIGNUP_PER_IP_HOUR: '10000',
    ...env,
  };
  const cfg = loadConfig(allEnv);
  const app = createApp({ db, cfg, store: new DiskPhotoStore(storageDir), env: allEnv, fetch: fetchImpl });
  return {
    app,
    db,
    dbUrl: url.toString(),
    storageDir,
    async close() {
      await db.end();
      await fs.rm(storageDir, { recursive: true, force: true });
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

/** JSON sorğu köməkçisi. */
export function client(env: TestEnv, token?: string) {
  return async (method: string, p: string, body?: unknown) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await env.app.request(p, { method, headers, body: payload });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  };
}

export async function register(env: TestEnv, email = `u${crypto.randomBytes(3).toString('hex')}@test.az`, password = 'secret123') {
  const res = await client(env)('POST', '/auth/register', { email, password });
  if (res.status !== 201) throw new Error(`register ${res.status} ${JSON.stringify(res.json)}`);
  return { token: res.json.token as string, userId: res.json.user.id as string, email, api: client(env, res.json.token) };
}

export const uuid = () => crypto.randomUUID();

/** Kiçik, düzgün JPEG başlığı olan bayt massivi. */
export const jpegBytes = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, ...crypto.randomBytes(64), 0xff, 0xd9]);
