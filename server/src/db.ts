/** PostgreSQL bağlantı hovuzu və tranzaksiya köməkçisi. */
import pg from 'pg';

// `date` sütunları JS Date-ə çevrilməsin — "YYYY-MM-DD" sətir kimi qalır (saat qurşağı sürüşməsi olmasın).
pg.types.setTypeParser(1082, (v) => v);

export type Db = pg.Pool;
export type Tx = pg.PoolClient;
export type Queryable = pg.Pool | pg.PoolClient;

export function createPool(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 10) });
  pool.on('error', (e) => console.error('[db] boş bağlantı xətası:', e.message));
  return pool;
}

export async function tx<T>(db: Db, fn: (c: Tx) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
