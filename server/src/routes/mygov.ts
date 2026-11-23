/**
 * /auth/mygov/start və /auth/mygov/callback — dövlət vahid girişi (OIDC).
 *
 * Protokol məntiqi Supabase Edge Function ilə ORTAQDIR (supabase/functions/mygov-auth/handler.ts);
 * burada yalnız istifadəçi bazası və sessiya hissəsi (Deps) daxili serverə uyğunlaşdırılıb.
 * Açarlar MYGOV_* mühit dəyişənləridir (mobile/docs/MYGOV.md). Qayıdış ünvanı:
 *   <PUBLIC_URL>/auth/mygov/callback   (və ya MYGOV_CALLBACK_URL)
 */
import { Hono } from 'hono';
import { handle, loadConfig, type Deps as MygovDeps } from '../../../supabase/functions/mygov-auth/handler.ts';
import { createSession } from '../auth.ts';
import type { Deps } from '../app.ts';

export function mygovRoutes({ db, cfg, env, fetch: fetchImpl }: Deps) {
  const r = new Hono();
  const provider = () => env.MYGOV_PROVIDER_ID ?? 'mygov';

  const deps: MygovDeps = {
    fetch: fetchImpl,
    async findUser(subjectHash) {
      const { rows } = await db.query<{ user_id: string }>(
        `update external_identities set last_login_at = now() where provider = $1 and subject_hash = $2 returning user_id`,
        [provider(), subjectHash],
      );
      return rows[0]?.user_id ?? null;
    },
    async findUserByEmail(email) {
      const { rows } = await db.query<{ id: string }>('select id from users where lower(email) = lower($1)', [email]);
      return rows[0]?.id ?? null;
    },
    async createUser(email, fullName) {
      const { rows } = await db.query<{ id: string }>(
        `insert into users (email, full_name, provider, email_confirmed_at) values ($1, $2, $3, now()) returning id`,
        [email, fullName, provider()],
      );
      return rows[0].id;
    },
    async linkIdentity(subjectHash, userId) {
      await db.query(
        `insert into external_identities (provider, subject_hash, user_id) values ($1, $2, $3) on conflict do nothing`,
        [provider(), subjectHash, userId],
      );
    },
    async updateName(userId, fullName) {
      await db.query('update users set full_name = $2 where id = $1', [userId, fullName]);
    },
    async getEmail(userId) {
      const { rows } = await db.query<{ email: string }>('select email from users where id = $1', [userId]);
      if (!rows[0]) throw new Error('istifadəçi tapılmadı');
      return rows[0].email;
    },
    async loginParams(userId, fullName) {
      const token = await createSession(db, userId, cfg.sessionTtlDays, 'mygov');
      return { token, user_id: userId, name: fullName };
    },
  };

  r.get('/:step{start|callback}', async (c) => {
    const mcfg = loadConfig((k) => (k === 'MYGOV_CALLBACK_URL' ? (env[k] ?? `${cfg.publicUrl}/auth/mygov/callback`) : env[k]));
    if ('error' in mcfg) {
      console.error('[mygov]', mcfg.error);
      return c.text('myGov girişi hələ aktiv deyil', 503);
    }
    return handle(c.req.raw, mcfg, deps);
  });

  return r;
}
