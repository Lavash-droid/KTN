/** API müqaviləsinin testləri (mobile/docs/BACKEND.md) — real PostgreSQL ilə. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { emptyFarmData, TABLES, type FarmData } from '../../mobile/src/domain/types.ts';
import { client, jpegBytes, register, setup, uuid, type TestEnv } from './helpers.ts';

let env: TestEnv;
before(async () => {
  env = await setup();
});
after(async () => {
  await env?.close();
});

/** Bütün cədvəlləri dolu, tətbiqin göndərdiyi formada ferma. */
function sampleFarm(): FarmData {
  const cow = uuid();
  const calf = uuid();
  const breeding = uuid();
  const med = uuid();
  const feed = uuid();
  return {
    farm: { name: 'Qarabağ fermasi', owner: 'Əli Məmmədov', region: 'Ağdam' },
    animals: [
      { id: cow, tag: 'AZ-001', name: 'Maral', species: 'inek', breed: 'Holştin', sex: 'd', dob: '2021-03-04', damTag: '', group: 'Sağmal', status: 'aktiv', notes: 'qeyd', photo: null, createdAt: '2026-01-02' },
      { id: calf, tag: 'AZ-002', name: '', species: 'inek', breed: '', sex: 'e', dob: null, damTag: 'AZ-001', group: '', status: 'satilib', notes: '', photo: null, createdAt: '2026-02-03' },
    ],
    treatments: [{ id: uuid(), animalId: cow, batchId: uuid(), date: '2026-05-01', medicine: 'Penisillin', dose: '10 ml', reason: 'mastit', meatWd: 14, milkWd: 4 }],
    weights: [{ id: uuid(), animalId: cow, date: '2026-05-02', kg: 512.5 }],
    breedings: [{ id: breeding, animalId: cow, date: '2026-01-10', method: 'suni', sire: 'Bull-7', expected: '2026-10-17', outcome: '' }],
    tasks: [{ id: uuid(), title: 'Peyvənd', due: '2026-06-01', done: false }, { id: uuid(), title: 'Təmizlik', due: null, done: true }],
    meds: [{ id: med, name: 'Penisillin', qty: 90, unit: 'ml', minQty: 20, expiry: '2027-01-01', meatWd: 14, milkWd: 4, notes: '' }],
    pregChecks: [{ id: uuid(), animalId: cow, breedingId: breeding, date: '2026-02-20', result: 'positive', fetuses: 1, method: 'scan', notes: '' }],
    heats: [{ id: uuid(), animalId: cow, date: '2025-12-30', notes: 'aydın' }],
    movements: [{ id: uuid(), animalId: calf, date: '2026-04-04', type: 'sale', counterparty: 'Bazar', price: 1500, weight: 0, notes: '' }],
    feeds: [{ id: feed, name: 'Arpa', qty: 1200, unit: 'kq', minQty: 200, notes: '' }],
    purchases: [
      { id: uuid(), kind: 'med', itemId: med, itemName: 'Penisillin', date: '2026-04-01', qty: 100, unit: 'ml', price: 25.5, supplier: 'Vet-Aptek', batch: 'B12', expiry: '2027-01-01', notes: '' },
      { id: uuid(), kind: 'feed', itemId: feed, itemName: 'Arpa', date: '2026-04-02', qty: 1000, unit: 'kq', price: 0, supplier: '', batch: '', expiry: null, notes: '' },
    ],
    milkRecords: [{ id: uuid(), date: '2026-05-03', liters: 420.5, fat: 3.8, protein: 3.2, scc: 180000, buyer: 'Atena', price: 0.85, notes: '' }],
  };
}

const sortById = (d: FarmData) => {
  for (const t of TABLES) (d[t] as { id: string }[]).sort((a, b) => a.id.localeCompare(b.id));
  return d;
};

describe('auth', () => {
  test('qeydiyyat, təkrar qeydiyyat, giriş, çıxış', async () => {
    const api = client(env);
    const r = await api('POST', '/auth/register', { email: 'Fermer@Test.az', password: 'secret123' });
    assert.equal(r.status, 201);
    assert.ok(r.json.token);
    assert.equal(r.json.user.email, 'fermer@test.az');

    assert.equal((await api('POST', '/auth/register', { email: 'fermer@test.az', password: 'other123' })).status, 409);
    const short = await api('POST', '/auth/register', { email: 'a@b.az', password: '123' });
    assert.equal(short.status, 400);
    assert.match(short.json.message, /6 simvol/);

    const bad = await api('POST', '/auth/login', { email: 'fermer@test.az', password: 'wrong' });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.message, 'E-poçt və ya şifrə yanlışdır');
    assert.equal((await api('POST', '/auth/login', { email: 'nobody@test.az', password: 'x' })).status, 400);

    const ok = await api('POST', '/auth/login', { email: 'FERMER@test.az', password: 'secret123' });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.user.id, r.json.user.id);

    const authed = client(env, ok.json.token);
    assert.equal((await authed('GET', '/farm/data')).status, 200);
    assert.equal((await authed('POST', '/auth/logout')).status, 204);
    const after = await authed('GET', '/farm/data');
    assert.equal(after.status, 401);
    assert.ok(after.json.message);
    // Digər sessiya (qeydiyyat tokeni) hələ də işləyir
    assert.equal((await client(env, r.json.token)('GET', '/farm/data')).status, 200);
  });

  test('e-poçt üzrə giriş cəhdləri məhdudlaşdırılır (429)', async () => {
    const u = await register(env);
    const api = client(env);
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await api('POST', '/auth/login', { email: u.email, password: 'wrong' })).status;
    assert.equal(last, 429);
  });

  test('tokensiz və saxta tokenlə 401', async () => {
    assert.equal((await client(env)('GET', '/farm/data')).status, 401);
    assert.equal((await client(env, 'garbage')('GET', '/farm/data')).status, 401);
  });

  test('Supabase-dən gələn bcrypt şifrə qəbul olunur və scrypt-ə yenilənir', async () => {
    const hash = await bcrypt.hash('legacy-pass', 10);
    await env.db.query(`insert into users (email, password_hash) values ('legacy@test.az', $1)`, [hash]);
    const r = await client(env)('POST', '/auth/login', { email: 'legacy@test.az', password: 'legacy-pass' });
    assert.equal(r.status, 200);
    const { rows } = await env.db.query(`select password_hash from users where email = 'legacy@test.az'`);
    assert.match(rows[0].password_hash, /^scrypt\$/);
    assert.equal((await client(env)('POST', '/auth/login', { email: 'legacy@test.az', password: 'legacy-pass' })).status, 200);
  });
});

describe('ferma məlumatı', () => {
  test('ilk sorğuda boş ferma yaradılır', async () => {
    const u = await register(env);
    const r = await u.api('GET', '/farm/data');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, emptyFarmData());
  });

  test('PUT /farm/data → GET /farm/data: bütün cədvəllər dəyişmədən qayıdır', async () => {
    const u = await register(env);
    const data = sampleFarm();
    assert.equal((await u.api('PUT', '/farm/data', data)).status, 204);
    const got = await u.api('GET', '/farm/data');
    assert.equal(got.status, 200);
    assert.deepEqual(sortById(got.json), sortById(structuredClone(data)));

    // Bərpa köhnə məlumatı tam əvəz edir
    const next = sampleFarm();
    assert.equal((await u.api('PUT', '/farm/data', next)).status, 204);
    assert.deepEqual(sortById((await u.api('GET', '/farm/data')).json), sortById(structuredClone(next)));
  });

  test('upsert idempotentdir, PUT /farm, silmə və CASCADE', async () => {
    const u = await register(env);
    const d = sampleFarm();
    for (const t of TABLES) {
      const rows = d[t] as unknown[];
      assert.equal((await u.api('PUT', `/records/${t}`, rows)).status, 204, t);
      assert.equal((await u.api('PUT', `/records/${t}`, rows)).status, 204, `${t} təkrar`);
    }
    assert.equal((await u.api('PUT', '/farm', d.farm)).status, 204);
    let got = (await u.api('GET', '/farm/data')).json as FarmData;
    assert.deepEqual(got.farm, d.farm);
    assert.equal(got.animals.length, 2);

    const cow = d.animals[0].id;
    assert.equal((await u.api('PUT', '/records/animals', [{ ...d.animals[0], name: 'Yeni ad' }])).status, 204);
    got = (await u.api('GET', '/farm/data')).json;
    assert.equal(got.animals.find((a) => a.id === cow)!.name, 'Yeni ad');

    assert.equal((await u.api('POST', '/records/animals/delete', { ids: [cow] })).status, 204);
    got = (await u.api('GET', '/farm/data')).json;
    assert.equal(got.animals.length, 1);
    for (const t of ['treatments', 'weights', 'breedings', 'pregChecks', 'heats'] as const) assert.equal(got[t].length, 0, t);
    assert.equal(got.meds.length, 1);
  });

  test('xətalar: təkrar bırka 409, naməlum cədvəl 404, yanlış id 400, yanlış enum 400', async () => {
    const u = await register(env);
    const a = sampleFarm().animals[0];
    await u.api('PUT', '/records/animals', [a]);
    const dup = await u.api('PUT', '/records/animals', [{ ...a, id: uuid(), tag: ' az-001 ' }]);
    assert.equal(dup.status, 409);
    assert.match(dup.json.message, /bırka/);
    assert.equal((await u.api('PUT', '/records/users', [])).status, 404);
    assert.equal((await u.api('PUT', '/records/animals', [{ ...a, id: 'not-a-uuid' }])).status, 400);
    assert.equal((await u.api('PUT', '/records/animals', [{ ...a, id: uuid(), tag: 'X9', species: 'at' }])).status, 400);
    assert.equal((await u.api('PUT', '/records/animals', { not: 'array' })).status, 400);
  });

  test('göndərilməyən sahə (photo) köhnə dəyəri saxlayır', async () => {
    const u = await register(env);
    const a = sampleFarm().animals[0];
    await u.api('PUT', '/records/animals', [a]);
    const form = new FormData();
    form.append('file', new Blob([jpegBytes()], { type: 'image/jpeg' }), 'a.jpg');
    const { json } = await u.api('POST', `/photos/${a.id}`, form);
    await u.api('PUT', '/records/animals', [{ ...a, photo: json.ref }]);
    const { photo: _drop, ...noPhoto } = a;
    await u.api('PUT', '/records/animals', [{ ...noPhoto, notes: 'dəyişdi' }]);
    const got = (await u.api('GET', '/farm/data')).json as FarmData;
    assert.equal(got.animals[0].photo, json.ref);
    assert.equal(got.animals[0].notes, 'dəyişdi');
  });
});

describe('fermalar arası təcrid', () => {
  test('başqa fermanın qeydini nə oxumaq, nə dəyişmək, nə silmək olar', async () => {
    const a = await register(env);
    const b = await register(env);
    const d = sampleFarm();
    await a.api('PUT', '/farm/data', d);
    const cow = d.animals[0];

    assert.deepEqual((await b.api('GET', '/farm/data')).json, emptyFarmData());
    const steal = await b.api('PUT', '/records/animals', [{ ...cow, name: 'oğurlandı' }]);
    assert.equal(steal.status, 403);
    // B-nin fermasına A-nın heyvanına bağlı qeyd yazmaq olmaz
    assert.equal((await b.api('PUT', '/records/weights', [{ id: uuid(), animalId: cow.id, date: '2026-01-01', kg: 1 }])).status, 400);
    assert.equal((await b.api('POST', '/records/animals/delete', { ids: [cow.id] })).status, 204); // heç nə silinmir
    const got = (await a.api('GET', '/farm/data')).json as FarmData;
    assert.equal(got.animals.find((x) => x.id === cow.id)!.name, 'Maral');
  });

  test('viewer rolu oxuya bilir, yaza bilmir', async () => {
    const owner = await register(env);
    await owner.api('PUT', '/farm/data', sampleFarm());
    const { rows } = await env.db.query('select farm_id from farm_members where user_id = $1', [owner.userId]);
    const viewer = await register(env);
    await env.db.query(`insert into farm_members (farm_id, user_id, role) values ($1, $2, 'viewer')`, [rows[0].farm_id, viewer.userId]);
    const got = await viewer.api('GET', '/farm/data');
    assert.equal(got.json.animals.length, 2);
    const w = await viewer.api('PUT', '/records/tasks', [{ id: uuid(), title: 'x', due: null, done: false }]);
    assert.equal(w.status, 403);
  });
});

describe('şəkillər', () => {
  test('yükləmə → imzalı URL → fayl → silmə; icazələr', async () => {
    const a = await register(env);
    const b = await register(env);
    const animal = sampleFarm().animals[0];
    await a.api('PUT', '/records/animals', [animal]);
    const bytes = jpegBytes();
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'x.jpg');
    const up = await a.api('POST', `/photos/${animal.id}`, form);
    assert.equal(up.status, 201);
    assert.match(up.json.ref, new RegExp(`^[0-9a-f-]{36}/${animal.id}-\\d+\\.jpg$`));

    const u = await a.api('GET', `/photos/url?ref=${encodeURIComponent(up.json.ref)}`);
    assert.equal(u.status, 200);
    assert.ok(u.json.url.startsWith('https://api.test/photos/file/'));
    const p = u.json.url.replace('https://api.test', '');
    const file = await env.app.request(p);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
    assert.equal((await env.app.request(p.replace(/sig=./, 'sig=A'))).status, 403);

    assert.equal((await b.api('GET', `/photos/url?ref=${encodeURIComponent(up.json.ref)}`)).status, 403);
    assert.equal((await b.api('DELETE', `/photos?ref=${encodeURIComponent(up.json.ref)}`)).status, 403);
    assert.equal((await a.api('GET', `/photos/url?ref=${encodeURIComponent('../../etc/passwd')}`)).status, 400);

    const txt = new FormData();
    txt.append('file', new Blob(['salam'], { type: 'image/jpeg' }), 'x.jpg');
    assert.equal((await a.api('POST', `/photos/${animal.id}`, txt)).status, 415);

    assert.equal((await a.api('DELETE', `/photos?ref=${encodeURIComponent(up.json.ref)}`)).status, 204);
    assert.equal((await env.app.request(p)).status, 404);
  });

  test('heyvan silinəndə və bərpada köhnə şəkillər diskdən silinir', async () => {
    const a = await register(env);
    const d = sampleFarm();
    await a.api('PUT', '/farm/data', d);
    const refs: string[] = [];
    for (const an of d.animals) {
      const form = new FormData();
      form.append('file', new Blob([jpegBytes()]), 'x.jpg');
      const { json } = await a.api('POST', `/photos/${an.id}`, form);
      refs.push(json.ref);
      await a.api('PUT', '/records/animals', [{ ...an, photo: json.ref }]);
    }
    const exists = async (ref: string) => fs.access(path.join(env.storageDir, ref)).then(() => true, () => false);
    assert.ok(await exists(refs[0]));
    await a.api('POST', '/records/animals/delete', { ids: [d.animals[0].id] });
    assert.equal(await exists(refs[0]), false);
    assert.ok(await exists(refs[1]));
    await a.api('PUT', '/farm/data', emptyFarmData());
    assert.equal(await exists(refs[1]), false);
  });
});

describe('hesabın silinməsi', () => {
  test('ferma, məlumat, şəkillər və sessiyalar silinir', async () => {
    const a = await register(env);
    const d = sampleFarm();
    await a.api('PUT', '/farm/data', d);
    const form = new FormData();
    form.append('file', new Blob([jpegBytes()]), 'x.jpg');
    const { json } = await a.api('POST', `/photos/${d.animals[0].id}`, form);
    const farmId = json.ref.split('/')[0];

    assert.equal((await a.api('DELETE', '/auth/account')).status, 204);
    assert.equal((await a.api('GET', '/farm/data')).status, 401);
    assert.equal((await client(env)('POST', '/auth/login', { email: a.email, password: 'secret123' })).status, 400);
    const left = await env.db.query('select (select count(*) from farms where id = $1) f, (select count(*) from animals where farm_id = $1) a', [farmId]);
    assert.deepEqual(left.rows[0], { f: '0', a: '0' });
    await assert.rejects(fs.access(path.join(env.storageDir, farmId)));
  });
});

describe('sayt müraciətləri', () => {
  test('POST /leads', async () => {
    const api = client(env);
    const ok = await api('POST', '/leads', { name: 'Vüqar', phone: '+994501234567', region: 'Şəki', herd_size: '10-50', plan: 'standart', message: 'Salam' });
    assert.equal(ok.status, 201);
    assert.equal((await api('POST', '/leads', { name: '', phone: '1' })).status, 400);
    const { rows } = await env.db.query(`select name, region from leads where phone = '+994501234567'`);
    assert.deepEqual(rows[0], { name: 'Vüqar', region: 'Şəki' });
  });
});

test('GET /health', async () => {
  const r = await client(env)('GET', '/health');
  assert.deepEqual(r.json, { ok: true });
});
