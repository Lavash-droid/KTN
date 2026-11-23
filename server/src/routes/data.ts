/** /farm və /records — fermanın məlumatı. Bütün sorğular istifadəçinin fermasına məhduddur. */
import { Hono } from 'hono';
import type { FarmData } from '../../../mobile/src/domain/types.ts';
import { requireAuth, type AuthEnv } from '../auth.ts';
import { tx } from '../db.ts';
import { assertWrite, ensureFarm } from '../farm.ts';
import { HttpError } from '../http.ts';
import { isTableName, loadAll, removeRows, replaceAll, updateFarm, upsertRows } from '../records.ts';
import type { Deps } from '../app.ts';

async function json<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Gövdə düzgün JSON deyil');
  }
}

export function dataRoutes({ db, cfg, store }: Deps) {
  const r = new Hono<AuthEnv>();
  r.use('*', requireAuth(db, cfg.sessionTtlDays));

  r.get('/farm/data', async (c) => {
    const { farmId } = await ensureFarm(db, c.get('user').id);
    return c.json(await loadAll(db, farmId));
  });

  r.put('/farm/data', async (c) => {
    const access = await ensureFarm(db, c.get('user').id);
    assertWrite(access);
    const data = await json<FarmData>(c.req.raw);
    await tx(db, (t) => replaceAll(t, access.farmId, data));
    // Artıq istinad olunmayan şəkil faylları silinir.
    const keep = new Set((data.animals ?? []).map((a) => a.photo).filter(Boolean));
    const stale = (await store.list(access.farmId)).filter((ref) => !keep.has(ref));
    await store.remove(stale);
    return c.body(null, 204);
  });

  r.put('/farm', async (c) => {
    const access = await ensureFarm(db, c.get('user').id);
    assertWrite(access);
    await updateFarm(db, access.farmId, await json(c.req.raw));
    return c.body(null, 204);
  });

  r.put('/records/:table', async (c) => {
    const table = c.req.param('table');
    if (!isTableName(table)) throw new HttpError(404, `Naməlum cədvəl: ${table}`);
    const access = await ensureFarm(db, c.get('user').id);
    assertWrite(access);
    const rows = await json<unknown[]>(c.req.raw);
    await tx(db, (t) => upsertRows(t, table, access.farmId, rows));
    return c.body(null, 204);
  });

  r.post('/records/:table/delete', async (c) => {
    const table = c.req.param('table');
    if (!isTableName(table)) throw new HttpError(404, `Naməlum cədvəl: ${table}`);
    const access = await ensureFarm(db, c.get('user').id);
    assertWrite(access);
    const body = await json<{ ids?: unknown }>(c.req.raw);
    const photos = await removeRows(db, table, access.farmId, body?.ids);
    await store.remove(photos);
    return c.body(null, 204);
  });

  return r;
}
