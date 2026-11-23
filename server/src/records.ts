/**
 * Ferma məlumatının oxunması və yazılması.
 *
 * Sahə adlarının çevrilməsi (camelCase ↔ snake_case) mobil tətbiqin istifadə etdiyi EYNİ moduldan
 * götürülür (mobile/src/data/mapping.ts) — tətbiq və server arasında uyğunsuzluq yaranmır.
 */
import { dbTable, fromRow, toCamel, toRow } from '../../mobile/src/data/mapping.ts';
import { TABLES, type Farm, type FarmData, type TableName, type Tables } from '../../mobile/src/domain/types.ts';
import type { Db, Queryable, Tx } from './db.ts';
import { HttpError, isUuid } from './http.ts';

export { TABLES };
export const isTableName = (t: string): t is TableName => (TABLES as string[]).includes(t);

const MAX_ROWS = 5000;

export async function loadAll(db: Db, farmId: string): Promise<FarmData> {
  const farm = await db.query<{ name: string; owner_name: string; region: string }>(
    'select name, owner_name, region from farms where id = $1',
    [farmId],
  );
  if (!farm.rows[0]) throw new HttpError(404, 'Ferma tapılmadı');
  const tables = await Promise.all(TABLES.map((t) => db.query(`select * from ${dbTable(t)} where farm_id = $1`, [farmId])));
  const out = { farm: { name: farm.rows[0].name, owner: farm.rows[0].owner_name, region: farm.rows[0].region } } as FarmData;
  TABLES.forEach((t, i) => {
    (out[t] as unknown[]) = tables[i].rows.map((r) => fromRow(t, r));
  });
  return out;
}

export async function updateFarm(db: Queryable, farmId: string, farm: Partial<Farm>) {
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null);
  await db.query(
    `update farms set name = coalesce($2, name), owner_name = coalesce($3, owner_name), region = coalesce($4, region) where id = $1`,
    [farmId, str(farm?.name, 200), str(farm?.owner, 200), str(farm?.region, 200)],
  );
}

/** Gələn sətirləri yoxlayır və bazanın sütunlarına çevirir. Göndərilməyən sahələr toxunulmaz qalır. */
function toDbRows(table: TableName, farmId: string, rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) throw new HttpError(400, 'Gövdə massiv olmalıdır');
  if (rows.length > MAX_ROWS) throw new HttpError(413, `Bir sorğuda ən çox ${MAX_ROWS} qeyd`);
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of rows) {
    if (!item || typeof item !== 'object' || !isUuid((item as { id?: unknown }).id)) {
      throw new HttpError(400, 'Hər qeydin düzgün UUID id-si olmalıdır');
    }
    const src = item as Record<string, unknown>;
    const row = toRow(table, src as unknown as Tables[typeof table], { farm_id: farmId });
    // toRow göndərilməyən sahəyə null yazır — onları çıxarırıq ki, mövcud dəyər (məs. şəkil) silinməsin.
    for (const k of Object.keys(row)) {
      if (k !== 'farm_id' && src[toCamel(k)] === undefined) delete row[k];
    }
    byId.set(String(row.id).toLowerCase(), row); // eyni id iki dəfə gəlibsə — sonuncu qalır
  }
  return [...byId.values()];
}

/**
 * id üzrə upsert (idempotent). Başqa fermaya aid id ilə yazmaq cəhdi rədd edilir (403) —
 * Supabase-dəki RLS "with check" qaydasının ekvivalenti.
 */
export async function upsertRows(c: Tx, table: TableName, farmId: string, rows: unknown) {
  const dbRows = toDbRows(table, farmId, rows);
  // Sütun dəsti eyni olan sətirlər bir INSERT-də göndərilir.
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const r of dbRows) {
    const key = Object.keys(r).sort().join(',');
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const tbl = dbTable(table);
  for (const [key, list] of groups) {
    const cols = key.split(',');
    const quoted = cols.map((col) => `"${col}"`);
    const updates = cols.filter((col) => col !== 'id' && col !== 'farm_id').map((col) => `"${col}" = excluded."${col}"`);
    for (let i = 0; i < list.length; i += 500) {
      const chunk = list.slice(i, i + 500);
      const params: unknown[] = [];
      const values = chunk.map((r) => `(${cols.map((col) => (params.push(r[col]), `$${params.length}`)).join(', ')})`);
      const sql =
        `insert into ${tbl} (${quoted.join(', ')}) values ${values.join(', ')} ` +
        `on conflict (id) do update set ${updates.length ? updates.join(', ') : 'id = excluded.id'} ` +
        `where ${tbl}.farm_id = excluded.farm_id`;
      const res = await c.query(sql, params);
      if (res.rowCount !== chunk.length) throw new HttpError(403, 'Bu əməliyyat üçün icazəniz yoxdur');
    }
  }
}

/** Qeydləri silir; heyvanlar üçün silinən şəkil istinadlarını qaytarır (fayllar sonra silinir). */
export async function removeRows(db: Queryable, table: TableName, farmId: string, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids) || !ids.every(isUuid)) throw new HttpError(400, 'ids UUID massivi olmalıdır');
  if (!ids.length) return [];
  if (ids.length > MAX_ROWS) throw new HttpError(413, `Bir sorğuda ən çox ${MAX_ROWS} qeyd`);
  // Heyvana aid müalicə, çəki, mayalanma və s. ON DELETE CASCADE ilə silinir.
  const res = await db.query(
    `delete from ${dbTable(table)} where farm_id = $1 and id = any($2::uuid[]) returning ${table === 'animals' ? 'photo_path' : 'null as photo_path'}`,
    [farmId, ids],
  );
  return res.rows.map((r) => r.photo_path as string | null).filter((p): p is string => !!p);
}

/** Fermanın bütün məlumatını əvəz edir (bərpa, nümunə məlumat). Bir tranzaksiyada — ya hamısı, ya heç nə. */
export async function replaceAll(c: Tx, farmId: string, data: FarmData) {
  if (!data || typeof data !== 'object') throw new HttpError(400, 'FarmData gözlənilir');
  for (const t of [...TABLES].reverse()) await c.query(`delete from ${dbTable(t)} where farm_id = $1`, [farmId]);
  if (data.farm) await updateFarm(c, farmId, data.farm);
  for (const t of TABLES) {
    const rows = (data as unknown as Record<string, unknown>)[t];
    if (rows === undefined) continue;
    await upsertRows(c, t, farmId, rows);
  }
}
