/**
 * Supabase → server köçürməsi. Mənbə kimi Supabase-in özünə bənzər baza qurulur: auth/storage
 * sxemlərinin minimal əvəzləri + repodakı REAL supabase/migrations/*.sql faylları.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { migrateFromSupabase } from '../scripts/migrate-from-supabase.ts';
import { ADMIN_URL, client, setup, type TestEnv } from './helpers.ts';

const SUPABASE_MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');

const STUBS = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema auth;
create table auth.users (
  id uuid primary key, email text, encrypted_password text, raw_user_meta_data jsonb, raw_app_meta_data jsonb,
  email_confirmed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $f$ select null::uuid $f$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (bucket_id text, name text);
`;

let src: pg.Client;
let srcName: string;
let env: TestEnv;
const ids = { user: crypto.randomUUID(), mygovUser: crypto.randomUUID(), farm: crypto.randomUUID(), cow: crypto.randomUUID(), breeding: crypto.randomUUID() };
const photoRef = `${ids.farm}/${ids.cow}-1700000000000.jpg`;
const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 0xff, 0xd9]);

before(async () => {
  srcName = `suru_fake_supabase_${crypto.randomBytes(3).toString('hex')}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${srcName}`);
  await admin.end();
  const u = new URL(ADMIN_URL);
  u.pathname = `/${srcName}`;
  src = new pg.Client({ connectionString: u.toString() });
  await src.connect();
  await src.query(STUBS);
  for (const f of (await fs.readdir(SUPABASE_MIGRATIONS)).sort()) await src.query(await fs.readFile(path.join(SUPABASE_MIGRATIONS, f), 'utf8'));

  // Supabase-dəki kimi məlumat
  await src.query(
    `insert into auth.users (id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data, email_confirmed_at) values
       ($1, 'fermer@test.az', $2, '{}', '{"provider":"email"}', now()),
       ($3, 'mygov-abc@mygov.suru.az', '', '{"full_name":"Aysel Quliyeva"}', '{"provider":"mygov"}', now())`,
    [ids.user, await bcrypt.hash('kohne-sifre', 10), ids.mygovUser],
  );
  await src.query(`insert into public.farms (id, name, owner_name, region, created_by) values ($1, 'Köhnə ferma', 'Əli', 'Şəki', $2)`, [ids.farm, ids.user]);
  await src.query(`insert into public.farm_members (farm_id, user_id, role) values ($1, $2, 'owner')`, [ids.farm, ids.user]);
  await src.query(
    `insert into public.animals (id, farm_id, tag, name, species, sex, dob, photo_path, created_at) values ($1, $2, 'AZ-7', 'Maral', 'inek', 'd', '2021-03-04', $3, '2025-01-01')`,
    [ids.cow, ids.farm, photoRef],
  );
  await src.query(`insert into public.treatments (id, farm_id, animal_id, date, medicine, meat_wd, milk_wd) values (gen_random_uuid(), $1, $2, '2026-01-05', 'Penisillin', 14, 4)`, [ids.farm, ids.cow]);
  await src.query(`insert into public.weights (id, farm_id, animal_id, date, kg) values (gen_random_uuid(), $1, $2, '2026-01-06', 480.5)`, [ids.farm, ids.cow]);
  await src.query(`insert into public.breedings (id, farm_id, animal_id, date, expected) values ($1, $2, $3, '2026-01-10', '2026-10-17')`, [ids.breeding, ids.farm, ids.cow]);
  await src.query(`insert into public.preg_checks (id, farm_id, animal_id, breeding_id, date, result, fetuses) values (gen_random_uuid(), $1, $2, $3, '2026-02-20', 'positive', 1)`, [ids.farm, ids.cow, ids.breeding]);
  await src.query(`insert into public.heats (id, farm_id, animal_id, date) values (gen_random_uuid(), $1, $2, '2025-12-30')`, [ids.farm, ids.cow]);
  await src.query(`insert into public.movements (id, farm_id, animal_id, date, type, price) values (gen_random_uuid(), $1, $2, '2025-01-01', 'purchase', 2500)`, [ids.farm, ids.cow]);
  await src.query(`insert into public.tasks (id, farm_id, title, due) values (gen_random_uuid(), $1, 'Peyvənd', '2026-06-01')`, [ids.farm]);
  await src.query(`insert into public.meds (id, farm_id, name, qty) values (gen_random_uuid(), $1, 'Penisillin', 90)`, [ids.farm]);
  await src.query(`insert into public.feeds (id, farm_id, name, qty) values (gen_random_uuid(), $1, 'Arpa', 1200)`, [ids.farm]);
  await src.query(`insert into public.purchases (id, farm_id, kind, item_name, date, qty) values (gen_random_uuid(), $1, 'feed', 'Arpa', '2026-01-01', 1000)`, [ids.farm]);
  await src.query(`insert into public.milk_records (id, farm_id, date, liters, fat) values (gen_random_uuid(), $1, '2026-01-02', 410.5, 3.7)`, [ids.farm]);
  await src.query(`insert into private.external_identities (provider, subject_hash, user_id) values ('mygov', 'deadbeef', $1)`, [ids.mygovUser]);
  await src.query(`insert into public.leads (name, phone) values ('Vüqar', '+994501112233')`);

  env = await setup();
});

after(async () => {
  await src?.end();
  await env?.close();
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${srcName} with (force)`);
  await admin.end();
});

const fakeStorage = (async (url: RequestInfo | URL, init?: RequestInit) => {
  const h = new Headers(init?.headers);
  if (h.get('authorization') !== 'Bearer service-key') return new Response('no', { status: 401 });
  if (String(url) === `https://ref.supabase.co/storage/v1/object/animal-photos/${photoRef}`) return new Response(photoBytes);
  return new Response('not found', { status: 404 });
}) as typeof fetch;

const opts = () => ({
  sourceUrl: (() => {
    const u = new URL(ADMIN_URL);
    u.pathname = `/${srcName}`;
    return u.toString();
  })(),
  targetUrl: env.dbUrl,
  supabaseUrl: 'https://ref.supabase.co',
  serviceKey: 'service-key',
  storageDir: env.storageDir,
  reset: false,
  skipPhotos: false,
  fetch: fakeStorage,
  log: () => {},
});

test('köçürmə: məlumat, istifadəçilər (eyni şifrə), myGov bağlılığı, şəkillər', async () => {
  const res = await migrateFromSupabase(opts());
  assert.ok(res.ok, JSON.stringify(res.counts));
  assert.equal(res.photos.downloaded, 1);
  assert.deepEqual(res.photos.missing, []);
  for (const [t, c] of Object.entries(res.counts)) assert.equal(c.source, c.target, t);

  // Köhnə şifrə ilə giriş
  const login = await client(env)('POST', '/auth/login', { email: 'fermer@test.az', password: 'kohne-sifre' });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.id, ids.user);
  const api = client(env, login.json.token);
  const data = (await api('GET', '/farm/data')).json;
  assert.deepEqual(data.farm, { name: 'Köhnə ferma', owner: 'Əli', region: 'Şəki' });
  assert.equal(data.animals[0].photo, photoRef);
  assert.equal(data.weights[0].kg, 480.5);
  assert.equal(data.pregChecks[0].breedingId, ids.breeding);
  assert.equal(data.milkRecords[0].fat, 3.7);
  assert.equal(data.movements[0].price, 2500);
  for (const t of ['treatments', 'tasks', 'meds', 'heats', 'feeds', 'purchases']) assert.equal(data[t].length, 1, t);

  // Şəkil yeni serverdə imzalı URL ilə açılır
  const u = await api('GET', `/photos/url?ref=${encodeURIComponent(photoRef)}`);
  const file = await env.app.request(u.json.url.replace('https://api.test', ''));
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), photoBytes);

  // myGov istifadəçisi: ad və provayder köçüb, şifrəsi yoxdur
  const mg = await env.db.query('select full_name, provider, password_hash from users where id = $1', [ids.mygovUser]);
  assert.deepEqual(mg.rows[0], { full_name: 'Aysel Quliyeva', provider: 'mygov', password_hash: null });
  const ei = await env.db.query('select user_id from external_identities where subject_hash = $1', ['deadbeef']);
  assert.equal(ei.rows[0].user_id, ids.mygovUser);
});

test('təkrar işlətmək təhlükəsizdir; --reset silinənləri də əks etdirir', async () => {
  await src.query(`insert into public.tasks (id, farm_id, title) values (gen_random_uuid(), $1, 'Yeni tapşırıq')`, [ids.farm]);
  const again = await migrateFromSupabase(opts());
  assert.ok(again.ok);
  assert.equal(again.counts.tasks.target, 2);
  assert.equal(again.photos.downloaded, 0, 'artıq köçürülmüş şəkil yenidən yüklənmir');

  await src.query(`delete from public.tasks where title = 'Yeni tapşırıq'`);
  const plain = await migrateFromSupabase(opts());
  assert.equal(plain.counts.tasks.target, 2, 'upsert rejimi silinənləri silmir');
  const reset = await migrateFromSupabase({ ...opts(), reset: true });
  assert.ok(reset.ok);
  assert.deepEqual(reset.counts.tasks, { source: 1, target: 1 });
});

test('keçid dövrü (--since): köhnə tətbiqin yazıları ötürülür, serverdəki daha yeni dəyişikliklər əzilmir', async () => {
  const cut = (await src.query<{ n: Date }>('select now() as n')).rows[0].n;
  const sleep = () => new Promise((r) => setTimeout(r, 30));
  await sleep();

  // Köhnə tətbiq (Supabase): inəyin adı dəyişir, yeni çəki, dərman qalığı dəyişir
  await src.query(`update public.animals set name = 'Köhnə tətbiq' where id = $1`, [ids.cow]);
  const newWeight = crypto.randomUUID();
  await src.query(`insert into public.weights (id, farm_id, animal_id, date, kg) values ($1, $2, $3, '2026-12-01', 500)`, [newWeight, ids.farm, ids.cow]);
  await src.query(`update public.meds set qty = 42 where farm_id = $1`, [ids.farm]);
  await sleep();

  // Yeni tətbiq (server): eyni inəyi DAHA GEC dəyişir
  const login = await client(env)('POST', '/auth/login', { email: 'fermer@test.az', password: 'kohne-sifre' });
  const api = client(env, login.json.token);
  const cow = (await api('GET', '/farm/data')).json.animals[0];
  assert.equal((await api('PUT', '/records/animals', [{ ...cow, name: 'Yeni tətbiq' }])).status, 204);

  // Eyni e-poçt hər iki sistemdə ayrı-ayrı qeydiyyatdan keçib — konflikt
  assert.equal((await client(env)('POST', '/auth/register', { email: 'ikili@test.az', password: 'secret123' })).status, 201);
  const dupId = crypto.randomUUID();
  await src.query(`insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values ($1, 'ikili@test.az', 'x', '{}')`, [dupId]);

  // Nişan əvvəlki --reset tərəfindən qoyulub
  const marker = (await env.db.query('select since from supabase_sync_state')).rows[0].since as Date;
  assert.ok(marker < cut);
  const res = await migrateFromSupabase({ ...opts(), continue: true });
  const next = (await env.db.query('select since from supabase_sync_state')).rows[0].since as Date;
  assert.ok(next > marker, 'nişan irəli çəkilməlidir');
  const data = (await api('GET', '/farm/data')).json;
  assert.equal(data.animals[0].name, 'Yeni tətbiq', 'serverdəki daha yeni dəyişiklik qalmalıdır');
  assert.ok(data.weights.some((w: { id: string }) => w.id === newWeight), 'köhnə tətbiqdə əlavə olunan çəki ötürülməlidir');
  assert.equal(data.meds[0].qty, 42);
  assert.equal(res.copied.treatments.written, 0, 'dəyişməyən sətirlər yazılmır (1 dəq. üst-üstə düşmədə oxuna bilər)');
  assert.deepEqual(res.skipped.map((x) => [x.table, x.key]), [['users', dupId]]);
  assert.equal(res.ok, false, 'ötürülən sətir varsa diqqət üçün xəta kodu');

  // Növbəti --continue: köhnə tətbiqdə ötürülmüş, sonra yeni tətbiqdə silinmiş çəki "dirilmir"
  assert.equal((await api('POST', '/records/weights/delete', { ids: [newWeight] })).status, 204);
  await migrateFromSupabase({ ...opts(), continue: true });
  const after = (await api('GET', '/farm/data')).json;
  assert.ok(!after.weights.some((w: { id: string }) => w.id === newWeight));
});

test('--continue keçid nişanı olmadan işləmir', async () => {
  await env.db.query('delete from supabase_sync_state');
  await assert.rejects(migrateFromSupabase({ ...opts(), continue: true }), /--reset/);
});
