/** /auth/* — qeydiyyat, giriş, çıxış, hesabın silinməsi. */
import { Hono } from 'hono';
import { burnPasswordTime, createSession, hashPassword, requireAuth, revokeSession, verifyPassword, type AuthEnv } from '../auth.ts';
import { tx } from '../db.ts';
import { clientIp, HttpError, RateLimiter } from '../http.ts';
import type { Deps } from '../app.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function credentials(req: Request): Promise<{ email: string; password: string }> {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, 'E-poçt ünvanı düzgün deyil');
  if (!password || password.length > 200) throw new HttpError(400, 'Şifrə daxil edin');
  return { email, password };
}

export function authRoutes({ db, cfg, store }: Deps) {
  const r = new Hono<AuthEnv>();
  const auth = requireAuth(db, cfg.sessionTtlDays);
  const signupLimit = new RateLimiter(cfg.limits.signupPerIpHour, 3600_000);
  const loginIpLimit = new RateLimiter(cfg.limits.loginPerIp15m, 15 * 60_000);
  const loginEmailLimit = new RateLimiter(cfg.limits.loginPerEmail15m, 15 * 60_000);
  const tooMany = () => new HttpError(429, 'Çox cəhd edildi — bir neçə dəqiqə sonra yenidən yoxlayın');

  r.post('/register', async (c) => {
    if (!cfg.allowSignup) throw new HttpError(403, 'Yeni qeydiyyat müvəqqəti bağlıdır');
    if (!signupLimit.take(clientIp(c, cfg.trustProxy))) throw tooMany();
    const { email, password } = await credentials(c.req.raw);
    if (password.length < 6) throw new HttpError(400, 'Şifrə ən azı 6 simvol olmalıdır');
    const hash = await hashPassword(password);
    const user = await tx(db, async (t) => {
      const res = await t.query<{ id: string }>(
        `insert into users (email, password_hash, provider, email_confirmed_at) values ($1, $2, 'email', now())
         on conflict ((lower(email))) do nothing returning id`,
        [email, hash],
      );
      if (!res.rows[0]) throw new HttpError(409, 'Bu e-poçt artıq qeydiyyatdan keçib');
      const token = await createSession(t, res.rows[0].id, cfg.sessionTtlDays, c.req.header('user-agent'));
      return { id: res.rows[0].id, token };
    });
    // E-poçt təsdiqi hələlik yoxdur — token dərhal verilir (tətbiq `token: null`-u "təsdiq lazımdır" kimi başa düşür).
    return c.json({ token: user.token, user: { id: user.id, email } }, 201);
  });

  r.post('/login', async (c) => {
    const { email, password } = await credentials(c.req.raw);
    if (!loginIpLimit.take(clientIp(c, cfg.trustProxy)) || !loginEmailLimit.take(email)) throw tooMany();
    const { rows } = await db.query<{ id: string; email: string; password_hash: string | null }>(
      'select id, email, password_hash from users where lower(email) = $1',
      [email],
    );
    const u = rows[0];
    if (!u) {
      await burnPasswordTime(password);
      throw new HttpError(400, 'E-poçt və ya şifrə yanlışdır');
    }
    const check = await verifyPassword(password, u.password_hash);
    if (!check.ok) throw new HttpError(400, 'E-poçt və ya şifrə yanlışdır');
    if (check.rehash) await db.query('update users set password_hash = $2 where id = $1', [u.id, await hashPassword(password)]);
    const token = await createSession(db, u.id, cfg.sessionTtlDays, c.req.header('user-agent'));
    return c.json({ token, user: { id: u.id, email: u.email } });
  });

  r.post('/logout', auth, async (c) => {
    await revokeSession(db, c.get('user').sessionId);
    return c.body(null, 204);
  });

  r.get('/me', auth, (c) => {
    const u = c.get('user');
    return c.json({ id: u.id, email: u.provider === 'email' ? u.email : null, name: u.fullName || null, provider: u.provider });
  });

  /**
   * Hesabı silir (App Store 5.1.1(v)): istifadəçinin YEGANƏ sahibi olduğu fermalar bütün məlumatı və
   * şəkilləri ilə silinir, digər fermalardakı üzvlüyü ləğv olunur, bütün sessiyaları bağlanır.
   */
  r.delete('/account', auth, async (c) => {
    const uid = c.get('user').id;
    const farms = await tx(db, async (t) => {
      const sole = await t.query<{ id: string }>(
        `delete from farms f
          where exists (select 1 from farm_members m where m.farm_id = f.id and m.user_id = $1 and m.role = 'owner')
            and not exists (select 1 from farm_members m where m.farm_id = f.id and m.user_id <> $1 and m.role = 'owner')
          returning f.id`,
        [uid],
      );
      await t.query('delete from users where id = $1', [uid]); // sessions, farm_members, external_identities — CASCADE
      return sole.rows.map((x) => x.id);
    });
    for (const f of farms) await store.removeFarm(f).catch((e) => console.error('[account] şəkil qovluğu silinmədi', f, e));
    return c.body(null, 204);
  });

  return r;
}
