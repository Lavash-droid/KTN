/** Serverin giriş nöqtəsi: konfiqurasiya → miqrasiyalar → HTTP server. */
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { purgeExpiredSessions } from './auth.ts';
import { loadConfig } from './config.ts';
import { createPool } from './db.ts';
import { migrate } from './migrate.ts';
import { DiskPhotoStore } from './storage.ts';

const cfg = loadConfig();
const db = createPool(cfg.databaseUrl);

if (process.env.AUTO_MIGRATE !== 'false') await migrate(db);

const app = createApp({ db, cfg, store: new DiskPhotoStore(cfg.storageDir), env: process.env, fetch });
const server = serve({ fetch: app.fetch, port: cfg.port, hostname: '0.0.0.0' }, (info) => {
  console.log(`[suru] API işləyir: http://0.0.0.0:${info.port}  (xaricdən: ${cfg.publicUrl})`);
});

const cleanup = setInterval(() => purgeExpiredSessions(db).catch((e) => console.error('[sessions]', e.message)), 6 * 3600_000);

function shutdown(sig: string) {
  console.log(`[suru] ${sig} — dayandırılır`);
  clearInterval(cleanup);
  server.close(() => void db.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
