/**
 * Sürü API — mobile/docs/BACKEND.md müqaviləsinin reallaşdırması.
 * Tətbiq `EXPO_PUBLIC_BACKEND=rest` + `EXPO_PUBLIC_API_URL=<bu server>` ilə qoşulur (RestRepository).
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { fromPgError, HttpError } from './http.ts';
import { authRoutes } from './routes/auth.ts';
import { dataRoutes } from './routes/data.ts';
import { leadRoutes } from './routes/leads.ts';
import { mygovRoutes } from './routes/mygov.ts';
import { photoRoutes } from './routes/photos.ts';
import type { PhotoStore } from './storage.ts';

export interface Deps {
  db: Db;
  cfg: Config;
  store: PhotoStore;
  /** MYGOV_* və digər əlavə dəyişənlər. */
  env: Record<string, string | undefined>;
  /** Xarici sorğular (myGov provayderi) — testlərdə əvəz olunur. */
  fetch: typeof fetch;
}

export function createApp(deps: Deps) {
  const { db, cfg } = deps;
  const app = new Hono();

  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));
  if (cfg.corsOrigins.length) {
    app.use(
      '*',
      cors({
        origin: cfg.corsOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: 86400,
      }),
    );
  }
  // Ehtiyat nüsxənin bərpası (PUT /farm/data) böyük ola bilər; şəkillər ayrıca limitlə yoxlanılır.
  app.use('*', bodyLimit({ maxSize: 50 * 1024 * 1024, onError: (c) => c.json({ message: 'Sorğu çox böyükdür' }, 413) }));

  app.get('/health', async (c) => {
    await db.query('select 1');
    return c.json({ ok: true });
  });

  app.route('/auth/mygov', mygovRoutes(deps));
  app.route('/auth', authRoutes(deps));
  app.route('/photos', photoRoutes(deps));
  app.route('/leads', leadRoutes(deps));
  app.route('/', dataRoutes(deps));

  app.notFound((c) => c.json({ message: 'Tapılmadı' }, 404));
  app.onError((err, c) => {
    const e = err instanceof HttpError ? err : fromPgError(err);
    if (e) return c.json({ message: e.message }, e.status as 400);
    console.error(`[api] ${c.req.method} ${c.req.path}:`, err);
    return c.json({ message: 'Server xətası — bir az sonra yenidən cəhd olunacaq' }, 500);
  });

  return app;
}
