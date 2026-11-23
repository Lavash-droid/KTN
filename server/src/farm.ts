/**
 * Ferma və icazələr. Supabase-də bunu Row Level Security edirdi; burada hər sorğu
 * istifadəçinin fermasının id-si ilə məhdudlaşdırılır.
 */
import type { Db } from './db.ts';
import { HttpError } from './http.ts';

export type Role = 'owner' | 'worker' | 'vet' | 'viewer';

export interface FarmAccess {
  farmId: string;
  role: Role;
}

/** İstifadəçinin fermasını qaytarır; yoxdursa yaradır və onu sahib edir (Supabase: ensure_farm()). */
export async function ensureFarm(db: Db, userId: string): Promise<FarmAccess> {
  const found = await db.query<FarmAccess>(
    `select farm_id as "farmId", role from farm_members where user_id = $1
      order by (role = 'owner') desc, created_at limit 1`,
    [userId],
  );
  if (found.rows[0]) return found.rows[0];

  const c = await db.connect();
  try {
    await c.query('begin');
    // Eyni istifadəçinin paralel sorğuları iki ferma yaratmasın.
    await c.query('select pg_advisory_xact_lock(hashtext($1))', [userId]);
    const again = await c.query<FarmAccess>(
      `select farm_id as "farmId", role from farm_members where user_id = $1
        order by (role = 'owner') desc, created_at limit 1`,
      [userId],
    );
    let access = again.rows[0];
    if (!access) {
      const f = await c.query<{ id: string }>(
        `insert into farms (created_by, owner_name) values ($1, coalesce((select full_name from users where id = $1), ''))
         returning id`,
        [userId],
      );
      await c.query(`insert into farm_members (farm_id, user_id, role) values ($1, $2, 'owner')`, [f.rows[0].id, userId]);
      access = { farmId: f.rows[0].id, role: 'owner' };
    }
    await c.query('commit');
    return access;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

export function assertWrite(a: FarmAccess) {
  if (a.role === 'viewer') throw new HttpError(403, 'Bu əməliyyat üçün icazəniz yoxdur');
}

/** Şəkil istinadı "<farm_id>/<fayl>" — istifadəçinin üzv olduğu fermaya aiddirmi? */
export async function canAccessFarm(db: Db, userId: string, farmId: string, write: boolean): Promise<boolean> {
  const { rows } = await db.query<{ role: Role }>('select role from farm_members where farm_id = $1 and user_id = $2', [farmId, userId]);
  if (!rows[0]) return false;
  return !write || rows[0].role !== 'viewer';
}
