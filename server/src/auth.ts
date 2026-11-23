/**
 * Kimlik yoxlaması: şifrələr (scrypt), sessiya tokenləri, Bearer middleware.
 *
 * Supabase-dən köçürülən istifadəçilərin şifrələri bcrypt-dir — onlar da qəbul olunur və
 * ilk uğurlu girişdə scrypt-ə yenilənir. Beləliklə istifadəçilər köçürmədən sonra eyni şifrə ilə girir.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { MiddlewareHandler } from 'hono';
import type { Db, Queryable } from './db.ts';
import { HttpError } from './http.ts';

const SCRYPT = { N: 16384, r: 8, p: 1, len: 32 };
const MAXMEM = 64 * 1024 * 1024;

function scrypt(pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => crypto.scrypt(pw, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: MAXMEM });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

/** { ok, rehash } — rehash: köhnə format (bcrypt və ya köhnə parametrlər), yenidən hash-lənməlidir. */
export async function verifyPassword(pw: string, stored: string | null): Promise<{ ok: boolean; rehash: boolean }> {
  if (!stored) return { ok: false, rehash: false };
  if (stored.startsWith('$2')) return { ok: await bcrypt.compare(pw, stored), rehash: true };
  const [alg, n, r, p, salt, key] = stored.split('$');
  if (alg !== 'scrypt' || !key) return { ok: false, rehash: false };
  const expected = Buffer.from(key, 'base64');
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return { ok: crypto.timingSafeEqual(got, expected), rehash: Number(n) !== SCRYPT.N };
}

/** İstifadəçi tapılmayanda da eyni vaxt sərf olunsun (e-poçtun mövcudluğu vaxtdan bilinməsin). */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordTime(pw: string) {
  dummyHash ??= hashPassword('suru-dummy-password');
  await verifyPassword(pw, await dummyHash);
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  provider: string;
  sessionId: string;
}

/** Yeni sessiya: tokeni (yalnız bir dəfə) qaytarır, bazada isə yalnız hash saxlanılır. */
export async function createSession(db: Queryable, userId: string, ttlDays: number, userAgent = ''): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `insert into sessions (token_hash, user_id, expires_at, user_agent)
     values ($1, $2, now() + make_interval(days => $3), $4)`,
    [sha256(token), userId, ttlDays, userAgent.slice(0, 200)],
  );
  return token;
}

export async function revokeSession(db: Queryable, sessionId: string) {
  await db.query('delete from sessions where id = $1', [sessionId]);
}

export type AuthEnv = { Variables: { user: AuthUser } };

/**
 * `Authorization: Bearer <token>` yoxlanılır. Sessiya müddəti sürüşkəndir: istifadə olunduqca uzanır
 * (tətbiq tokeni yeniləmir — aktiv istifadəçi heç vaxt çıxışa yönləndirilmir).
 */
export function requireAuth(db: Db, ttlDays: number): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const m = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '');
    if (!m) throw new HttpError(401, 'Giriş tələb olunur');
    const { rows } = await db.query(
      `select s.id as session_id, s.last_used_at, u.id, u.email, u.full_name, u.provider
         from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()`,
      [sha256(m[1])],
    );
    const r = rows[0];
    if (!r) throw new HttpError(401, 'Sessiya bitib — yenidən daxil olun');
    if (Date.now() - new Date(r.last_used_at).getTime() > 3600_000) {
      await db.query(
        `update sessions set last_used_at = now(), expires_at = now() + make_interval(days => $2) where id = $1`,
        [r.session_id, ttlDays],
      );
    }
    c.set('user', { id: r.id, email: r.email, fullName: r.full_name, provider: r.provider, sessionId: r.session_id });
    await next();
  };
}

export async function purgeExpiredSessions(db: Db) {
  await db.query('delete from sessions where expires_at < now()');
}
