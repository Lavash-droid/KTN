/** POST /leads — saytın əlaqə formasından müraciət (giriş tələb etmir, yalnız yazmaq olar). */
import { Hono } from 'hono';
import { clientIp, HttpError, RateLimiter } from '../http.ts';
import type { Deps } from '../app.ts';

export function leadRoutes({ db, cfg }: Deps) {
  const r = new Hono();
  const limit = new RateLimiter(cfg.limits.leadsPerIp10m, 10 * 60_000);

  r.post('/', async (c) => {
    if (!limit.take(clientIp(c, cfg.trustProxy))) throw new HttpError(429, 'Çox müraciət — bir az sonra yenidən yoxlayın');
    const b = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const s = (k: string, max: number) => (typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, max) : '');
    const lead = {
      name: s('name', 120),
      phone: s('phone', 40),
      region: s('region', 120),
      herd_size: s('herd_size', 20),
      plan: s('plan', 40),
      message: s('message', 2000),
    };
    if (!lead.name || lead.phone.length < 5) throw new HttpError(400, 'Ad və telefon nömrəsi tələb olunur');
    await db.query(
      `insert into leads (name, phone, region, herd_size, plan, message) values ($1, $2, $3, $4, $5, $6)`,
      [lead.name, lead.phone, lead.region, lead.herd_size, lead.plan, lead.message],
    );
    return c.body(null, 201);
  });

  return r;
}
