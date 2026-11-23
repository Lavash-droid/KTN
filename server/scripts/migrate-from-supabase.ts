/**
 * Supabase → daxili server: məlumatın köçürülməsi və keçid dövründə sinxronizasiya.
 *
 *   SUPABASE_DB_URL=postgres://postgres.<ref>:<şifrə>@<host>:5432/postgres \
 *   SUPABASE_URL=https://<ref>.supabase.co  SUPABASE_SERVICE_ROLE_KEY=<service_role açarı> \
 *   DATABASE_URL=postgres://suru:...@localhost:5432/suru  STORAGE_DIR=/data/photos \
 *   node dist/migrate-from-supabase.js [--reset | --continue | --since=<ISO vaxt>] [--skip-photos]
 *   (docker-də: docker compose run --rm supabase-sync [--reset | --continue])
 *
 * Nə köçürülür:
 *   auth.users (id, e-poçt, bcrypt şifrə hash-i, ad)  → users   — istifadəçilər EYNİ şifrə ilə girir
 *   farms, farm_members, bütün məlumat cədvəlləri, leads           — id-lər dəyişmir
 *   private.external_identities                                     → external_identities (myGov bağlılığı)
 *   Storage "animal-photos" faylları                                → STORAGE_DIR (eyni yol: <farm_id>/<fayl>)
 *
 * Rejimlər (ətraflı: server/README.md → "Supabase-dən keçid"):
 *   (standart)      upsert — təkrar işlətmək təhlükəsizdir; məşq üçün.
 *   --reset         hədəf bazanı tam təmizləyib sıfırdan köçürür — KEÇİD ANI üçün. Keçid nişanını qoyur.
 *   --continue      keçiddən sonra köhnə tətbiq versiyası ilə Supabase-ə yazılanları ötürür (cron, saatda bir):
 *                   yalnız əvvəlki işdən sonra dəyişən sətirlər, və yalnız serverdəki nüsxədən YENİDİRSƏ
 *                   (updated_at). Serverdə yeni tətbiqlə edilmiş dəyişikliklər əzilmir.
 *   --since=<vaxt>  --continue kimi, amma başlanğıc əl ilə verilir (nişana toxunmur).
 *
 * Sonda hər cədvəl üzrə say müqayisəsi çap olunur; uyğunsuzluq olarsa çıxış kodu 1-dir.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { createPool, type Db, type Tx } from '../src/db.ts';
import { migrate } from '../src/migrate.ts';
import { DiskPhotoStore, isValidRef } from '../src/storage.ts';

export interface Options {
  sourceUrl: string;
  targetUrl: string;
  supabaseUrl?: string;
  serviceKey?: string;
  storageDir: string;
  reset: boolean;
  /** Delta rejimi: yalnız bu andan sonra dəyişən sətirlər. */
  since?: Date;
  /** Delta rejimi, başlanğıc — hədəf bazadakı keçid nişanından (--reset qoyur); sonda nişan irəli çəkilir. */
  continue?: boolean;
  skipPhotos: boolean;
  fetch?: typeof fetch;
  log?: (...a: unknown[]) => void;
}

interface TableSpec {
  /** Supabase-dəki cədvəl. */
  source: string;
  target: string;
  pk: string[];
  /** Dəyişiklik vaxtı sütunu (delta rejimi üçün). */
  ts: string;
  /** true: delta rejimində mövcud sətir daha yeni versiya ilə yenilənir; false: yalnız yeni sətirlər əlavə olunur. */
  versioned: boolean;
  /** Mənbədə cədvəl olmaya bilər (məs. köhnə versiya) — ötürülür. */
  optional?: boolean;
}

const CORE = ['animals', 'meds', 'treatments', 'weights', 'breedings', 'tasks'];

/** Sıra vacibdir (xarici açarlar): istifadəçilər → fermalar → heyvanlar → onlara bağlı qeydlər. */
const DATA_TABLES: TableSpec[] = [
  { source: 'public.farms', target: 'farms', pk: ['id'], ts: 'updated_at', versioned: true },
  { source: 'public.farm_members', target: 'farm_members', pk: ['farm_id', 'user_id'], ts: 'created_at', versioned: false },
  ...[...CORE, 'preg_checks', 'heats', 'movements', 'feeds', 'purchases', 'milk_records'].map((t) => ({
    source: `public.${t}`,
    target: t,
    pk: ['id'],
    ts: 'updated_at',
    versioned: true,
    optional: !CORE.includes(t),
  })),
  { source: 'private.external_identities', target: 'external_identities', pk: ['provider', 'subject_hash'], ts: 'created_at', versioned: false, optional: true },
  { source: 'public.leads', target: 'leads', pk: ['id'], ts: 'created_at', versioned: false, optional: true },
];

const USER_COLS = ['id', 'email', 'password_hash', 'full_name', 'provider', 'email_confirmed_at', 'created_at', 'updated_at'];
const usersSql = (since: boolean) => `
  select u.id,
         coalesce(nullif(u.email, ''), 'no-email-' || u.id || '@legacy.suru.local') as email,
         nullif(u.encrypted_password, '') as password_hash,
         coalesce(u.raw_user_meta_data ->> 'full_name', '') as full_name,
         coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
         u.email_confirmed_at, u.created_at, coalesce(u.updated_at, u.created_at) as updated_at
    from auth.users u
   where u.deleted_at is null ${since ? 'and coalesce(u.updated_at, u.created_at) > $1' : ''}
   order by u.id`;

async function exists(src: pg.Client, qualified: string) {
  const { rows } = await src.query('select to_regclass($1) is not null as ok', [qualified]);
  return rows[0].ok as boolean;
}

async function targetColumns(t: Tx, table: string): Promise<string[]> {
  const { rows } = await t.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [table]);
  return rows.map((r) => r.column_name as string);
}

async function sourceColumns(src: pg.Client, qualified: string): Promise<Set<string>> {
  const [schema, table] = qualified.split('.');
  const { rows } = await src.query(`select column_name from information_schema.columns where table_schema = $1 and table_name = $2`, [schema, table]);
  return new Set(rows.map((r) => r.column_name as string));
}

type Conflict = 'overwrite' | 'newer' | 'skip';

export interface Skipped {
  table: string;
  key: string;
  reason: string;
}

/**
 * Sətirləri yazır. Delta rejimində (`skipped` verilibsə) yazıla bilməyən sətir (məs. keçid dövründə eyni
 * e-poçtla hər iki sistemdə qeydiyyat) bütün sinxronizasiyanı dayandırmır — ötürülür və hesabatda göstərilir.
 */
async function insertRows(t: Tx, table: string, cols: string[], pk: string[], rows: Record<string, unknown>[], conflict: Conflict, skipped?: Skipped[]): Promise<number> {
  const updates = cols.filter((c) => !pk.includes(c)).map((c) => `"${c}" = excluded."${c}"`);
  let action = 'nothing';
  if (conflict !== 'skip' && updates.length) {
    action = `update set ${updates.join(', ')}`;
    // Delta rejimi: serverdəki versiya daha yenidirsə (yeni tətbiqlə dəyişdirilib) — toxunulmur.
    if (conflict === 'newer') action += ` where ${table}.updated_at < excluded.updated_at`;
  }
  const write = async (chunk: Record<string, unknown>[]) => {
    const params: unknown[] = [];
    const values = chunk.map((r) => `(${cols.map((c) => (params.push(r[c]), `$${params.length}`)).join(', ')})`);
    const res = await t.query(
      `insert into ${table} (${cols.map((c) => `"${c}"`).join(', ')}) values ${values.join(', ')}
       on conflict (${pk.map((c) => `"${c}"`).join(', ')}) do ${action}`,
      params,
    );
    return res.rowCount ?? 0;
  };
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    if (!skipped) {
      written += await write(chunk);
      continue;
    }
    await t.query('savepoint chunk');
    try {
      written += await write(chunk);
      await t.query('release savepoint chunk');
    } catch {
      await t.query('rollback to savepoint chunk');
      for (const row of chunk) {
        await t.query('savepoint one');
        try {
          written += await write([row]);
          await t.query('release savepoint one');
        } catch (e) {
          await t.query('rollback to savepoint one');
          skipped.push({ table, key: pk.map((k) => String(row[k])).join('/'), reason: (e as Error).message });
        }
      }
    }
  }
  return written;
}

/**
 * Üst-üstə düşmə pəncərəsi: nişan mənbənin "indi"sindən bu qədər geri qoyulur — snapshot anında hələ
 * commit olunmamış (amma updated_at-i daha erkən olan) tranzaksiyalar növbəti işdə itməsin.
 */
const OVERLAP_MS = 60_000;

/** Pəncərədə artıq köçürülmüş sətirlər: "cədvəl:açar" → dəyişiklik vaxtı (ms). */
type Seen = Map<string, number>;

interface CopyCtx {
  conflict: Conflict;
  skipped?: Skipped[];
  /** Əvvəlki işdə pəncərədə köçürülənlər — dəyişməyibsə təkrar yazılmır (silinmiş qeyd "dirilməsin"). */
  prevSeen: Seen;
  /** Bu işdə pəncərəyə düşənlər (növbəti iş üçün). */
  nextSeen: Seen;
  /** Bu andan sonrakı sətirlər nextSeen-ə yazılır. */
  windowFrom: number;
  ts: string;
}

const tsOf = (v: unknown) => (v instanceof Date ? v.getTime() : new Date(String(v)).getTime());

/** Mənbədən səhifə-səhifə oxuyub hədəfə yazır. { read, written } */
async function copy(src: pg.Client, t: Tx, sql: string, params: unknown[], table: string, cols: string[], pk: string[], x: CopyCtx) {
  let read = 0;
  let written = 0;
  for (let offset = 0; ; offset += 5000) {
    const { rows } = await src.query(`${sql} limit 5000 offset ${offset}`, params);
    if (!rows.length) break;
    read += rows.length;
    const todo = rows.filter((r) => {
      const key = `${table}:${pk.map((k) => String(r[k])).join('/')}`;
      const ts = tsOf(r[x.ts]);
      if (ts >= x.windowFrom) x.nextSeen.set(key, ts);
      return x.prevSeen.get(key) !== ts;
    });
    written += await insertRows(t, table, cols, pk, todo, x.conflict, x.skipped);
    if (rows.length < 5000) break;
  }
  return { read, written };
}

/**
 * Keçid dövrü nişanı hədəf bazada saxlanılır: --reset onu keçid anına qoyur, hər --continue
 * oradan davam edib irəli çəkir. Belə ki, artıq ötürülmüş və sonra yeni tətbiqdə silinmiş qeyd
 * təkrar köçürülüb "dirilmir". Bu cədvəllər yalnız keçid üçündür (tətbiq sxeminə aid deyil).
 */
const STATE_DDL = `
  create table if not exists supabase_sync_state (id int primary key default 1 check (id = 1), since timestamptz not null, updated_at timestamptz not null default now());
  create table if not exists supabase_sync_seen (key text primary key, ts_ms bigint not null);`;

export async function migrateFromSupabase(o: Options) {
  const log = o.log ?? console.log;
  if ([o.reset, !!o.since, !!o.continue].filter(Boolean).length > 1) throw new Error('--reset, --since və --continue birlikdə işlədilə bilməz');
  const src = new pg.Client({ connectionString: o.sourceUrl });
  await src.connect();
  const db: Db = createPool(o.targetUrl);
  try {
    await migrate(db, undefined, log);
    await db.query(STATE_DDL);
    if (o.continue) {
      const { rows } = await db.query<{ since: Date }>('select since from supabase_sync_state');
      if (!rows[0]) throw new Error('Keçid nişanı yoxdur — əvvəlcə keçid anında --reset işlədin');
      o = { ...o, since: rows[0].since };
      log(`[köçürmə] davam: ${rows[0].since.toISOString()}-dan sonrakı dəyişikliklər`);
    }
    const delta = !!o.since;
    // Mənbədə ardıcıl görüntü: bütün cədvəllər eyni an üzrə oxunur.
    await src.query('begin isolation level repeatable read read only');
    const startedAt = (await src.query<{ now: Date }>('select now()')).rows[0].now;

    const copied: Record<string, { read: number; written: number }> = {};
    const skipped: Skipped[] | undefined = delta ? [] : undefined;
    const tracking = o.reset || !!o.continue;
    const windowFrom = startedAt.getTime() - OVERLAP_MS;
    const prevSeen: Seen = new Map();
    if (o.continue) {
      for (const r of (await db.query<{ key: string; ts_ms: string }>('select key, ts_ms from supabase_sync_seen')).rows) prevSeen.set(r.key, Number(r.ts_ms));
    }
    const nextSeen: Seen = new Map();
    const c = await db.connect();
    try {
      await c.query('begin');
      if (o.reset) {
        log('[köçürmə] --reset: hədəf baza təmizlənir');
        await c.query('truncate users, farms, leads, external_identities, sessions cascade');
      }
      const params = delta ? [o.since] : [];
      const ctx = (conflict: Conflict, ts: string): CopyCtx => ({ conflict, skipped, prevSeen, nextSeen, windowFrom: tracking ? windowFrom : Infinity, ts });

      copied.users = await copy(src, c, usersSql(delta), params, 'users', USER_COLS, ['id'], ctx(delta ? 'newer' : 'overwrite', 'updated_at'));
      log(`[köçürmə] users: ${copied.users.read} oxundu, ${copied.users.written} yazıldı`);

      for (const spec of DATA_TABLES) {
        if (!(await exists(src, spec.source))) {
          if (!spec.optional) throw new Error(`Mənbədə cədvəl yoxdur: ${spec.source}`);
          log(`[köçürmə] ${spec.source}: mənbədə yoxdur — ötürülür`);
          continue;
        }
        const have = await sourceColumns(src, spec.source);
        const cols = (await targetColumns(c, spec.target)).filter((col) => have.has(col));
        const where = delta ? `where "${spec.ts}" > $1` : '';
        const sql = `select ${cols.map((x) => `"${x}"`).join(', ')} from ${spec.source} ${where} order by ${spec.pk.map((x) => `"${x}"`).join(', ')}`;
        const conflict: Conflict = !delta ? 'overwrite' : spec.versioned ? 'newer' : 'skip';
        copied[spec.target] = await copy(src, c, sql, params, spec.target, cols, spec.pk, ctx(conflict, spec.ts));
        log(`[köçürmə] ${spec.target}: ${copied[spec.target].read} oxundu, ${copied[spec.target].written} yazıldı`);
      }
      if (tracking) {
        // Nişan və pəncərə məlumatı köçürmə ilə EYNİ tranzaksiyada — ya hamısı, ya heç nə.
        const next = new Date(windowFrom);
        await c.query('insert into supabase_sync_state (id, since) values (1, $1) on conflict (id) do update set since = excluded.since, updated_at = now()', [next]);
        await c.query('delete from supabase_sync_seen');
        const entries = [...nextSeen];
        for (let i = 0; i < entries.length; i += 1000) {
          const part = entries.slice(i, i + 1000);
          await c.query('insert into supabase_sync_seen (key, ts_ms) select * from unnest($1::text[], $2::bigint[])', [part.map((e) => e[0]), part.map((e) => e[1])]);
        }
        log(`[köçürmə] keçid nişanı: ${next.toISOString()} (növbəti --continue buradan davam edəcək)`);
      }
      await c.query('commit');
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    } finally {
      c.release();
    }

    /* ---- say müqayisəsi ---- */
    const counts: Record<string, { source: number; target: number }> = {};
    const srcUsers = await src.query('select count(*)::int as n from auth.users where deleted_at is null');
    counts.users = { source: srcUsers.rows[0].n, target: (await db.query('select count(*)::int as n from users')).rows[0].n };
    for (const spec of DATA_TABLES) {
      if (!(await exists(src, spec.source))) continue;
      const s = (await src.query(`select count(*)::int as n from ${spec.source}`)).rows[0].n;
      const t = (await db.query(`select count(*)::int as n from ${spec.target}`)).rows[0].n;
      counts[spec.target] = { source: s, target: t };
    }
    await src.query('commit');

    /* ---- şəkillər: serverdə olmayanlar yüklənir ---- */
    const photos = { downloaded: 0, missing: [] as string[] };
    if (!o.skipPhotos) {
      if (!o.supabaseUrl || !o.serviceKey) throw new Error('Şəkillər üçün SUPABASE_URL və SUPABASE_SERVICE_ROLE_KEY lazımdır (və ya --skip-photos)');
      const store = new DiskPhotoStore(o.storageDir);
      const refs = (await db.query<{ p: string }>('select distinct photo_path as p from animals where photo_path is not null')).rows.map((r) => r.p);
      const f = o.fetch ?? fetch;
      const base = o.supabaseUrl.replace(/\/+$/, '');
      const queue = [...refs];
      const worker = async () => {
        for (let ref = queue.shift(); ref; ref = queue.shift()) {
          if (!isValidRef(ref)) {
            photos.missing.push(ref);
            continue;
          }
          if (await fs.stat(path.join(o.storageDir, ref)).catch(() => null)) continue; // artıq var (fayl adları unikaldır)
          const res = await f(`${base}/storage/v1/object/animal-photos/${ref.split('/').map(encodeURIComponent).join('/')}`, {
            headers: { Authorization: `Bearer ${o.serviceKey}`, apikey: o.serviceKey! },
          }).catch(() => null);
          if (!res?.ok) {
            photos.missing.push(ref);
            continue;
          }
          await store.put(ref, new Uint8Array(await res.arrayBuffer()));
          photos.downloaded++;
        }
      };
      await Promise.all(Array.from({ length: 8 }, worker));
      log(`[köçürmə] şəkillər: ${photos.downloaded} yükləndi, ${refs.length - photos.downloaded - photos.missing.length} artıq var, ${photos.missing.length} tapılmadı`);
      if (photos.missing.length) log(`[köçürmə] tapılmayan şəkillər:\n  ${photos.missing.join('\n  ')}`);
    }

    if (skipped?.length) {
      log(`[köçürmə] ⚠ ${skipped.length} sətir köçürülmədi (əl ilə yoxlayın):`);
      for (const x of skipped) log(`  ${x.table} ${x.key}: ${x.reason}`);
    }
    // Delta rejimində serverdə yeni tətbiqlə yaradılmış qeydlər də var — say bərabərliyi gözlənilmir.
    const ok = delta ? !skipped?.length : Object.values(counts).every((x) => (o.reset ? x.source === x.target : x.target >= x.source));
    if (o.log === undefined) {
      console.table(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { Supabase: v.source, server: v.target, yazıldı: copied[k]?.written ?? 0 }])));
    }
    log(ok ? '✓ Köçürmə tamamlandı' : '✗ Saylar uyğun gəlmir — yuxarıdakı cədvələ baxın');
    return { ok, counts, copied, skipped: skipped ?? [], photos, startedAt };
  } finally {
    await src.end().catch(() => {});
    await db.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const sinceArg = argv.find((a) => a.startsWith('--since='))?.slice('--since='.length);
  const since = sinceArg ? new Date(sinceArg) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    console.error(`--since vaxtı yanlışdır: ${sinceArg} (nümunə: --since=2026-12-01T03:00:00Z)`);
    process.exit(2);
  }
  const need = (k: string) => {
    const v = process.env[k];
    if (!v) {
      console.error(`${k} təyin olunmayıb (skriptin başındakı şərhə baxın)`);
      process.exit(2);
    }
    return v;
  };
  const sourceUrl = need('SUPABASE_DB_URL');
  try {
    // pg kitabxanası şifrəsiz bağlantı sətrində aydın xəta vermir (SASL istisnası) — əvvəlcədən yoxlayırıq.
    if (!new URL(sourceUrl).password) throw new Error();
  } catch {
    console.error('SUPABASE_DB_URL düzgün deyil və ya şifrə yoxdur: postgres://postgres.<ref>:<DB-şifrə>@<host>:5432/postgres');
    process.exit(2);
  }
  const res = await migrateFromSupabase({
    sourceUrl,
    targetUrl: need('DATABASE_URL'),
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    storageDir: path.resolve(process.env.STORAGE_DIR ?? './data/photos'),
    reset: args.has('--reset'),
    since,
    continue: args.has('--continue'),
    skipPhotos: args.has('--skip-photos'),
  }).catch((e: Error) => {
    console.error(`✗ ${e.message}`);
    process.exit(2);
  });
  process.exit(res.ok && !res.photos.missing.length ? 0 : 1);
}
