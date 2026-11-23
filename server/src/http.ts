/** Ümumi HTTP köməkçiləri: xəta formatı, sürət məhdudiyyəti, müştəri IP-si. */
import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

/** Tətbiqə qaytarılan xəta: `{ message }`. 4xx — qalıcı, 5xx/408/429 — tətbiq sonra təkrarlayır. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Postgres xəta kodlarını istifadəçiyə aydın 4xx cavablarına çevirir. */
export function fromPgError(e: unknown): HttpError | null {
  const code = (e as { code?: string })?.code;
  if (typeof code !== 'string' || !/^[0-9A-Z]{5}$/.test(code)) return null;
  if (code === '23505') return new HttpError(409, 'Bu qeyd artıq mövcuddur (məs. eyni bırka nömrəsi)');
  if (code === '23503') return new HttpError(400, 'Əlaqəli qeyd tapılmadı (məs. heyvan silinib)');
  if (code === '23502' || code === '23514') return new HttpError(400, `Məlumat düzgün deyil: ${(e as Error).message}`);
  if (code.startsWith('22')) return new HttpError(400, `Məlumat formatı yanlışdır: ${(e as Error).message}`);
  return null;
}

export function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = c.req.header('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Sadə yaddaşdaxili sürət məhdudiyyəti (bir server nüsxəsi üçün kifayətdir). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private limit: number, private windowMs: number) {}

  /** true — icazə var; false — limit aşılıb. */
  take(key: string, now = Date.now()): boolean {
    const from = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > from);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 50_000) this.sweep(now);
    return true;
  }

  private sweep(now: number) {
    const from = now - this.windowMs;
    for (const [k, v] of this.hits) if (!v.some((t) => t > from)) this.hits.delete(k);
  }
}

export const isUuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
