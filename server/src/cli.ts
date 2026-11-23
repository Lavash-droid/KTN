/**
 * İnzibati əmrlər:
 *   node dist/cli.js migrate             — sxem miqrasiyalarını tətbiq edir
 *   node dist/cli.js leads [say]         — saytdan gələn son müraciətlər
 *   node dist/cli.js stats               — istifadəçi, ferma, heyvan sayı
 * Docker-də: docker compose exec api node dist/cli.js leads
 */
import { createPool } from './db.ts';
import { migrate } from './migrate.ts';

const [cmd, arg] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL təyin olunmayıb');
  process.exit(1);
}
const db = createPool(url);

try {
  if (cmd === 'migrate') {
    const applied = await migrate(db);
    console.log(applied.length ? `${applied.length} miqrasiya tətbiq olundu` : 'Sxem aktualdır');
  } else if (cmd === 'leads') {
    const { rows } = await db.query(
      `select created_at::timestamp(0) as tarix, name as ad, phone as telefon, region as rayon, herd_size as sürü, plan as paket, message as mesaj
         from leads order by created_at desc limit $1`,
      [Number(arg) || 20],
    );
    console.table(rows);
  } else if (cmd === 'stats') {
    const { rows } = await db.query(`
      select (select count(*) from users) as istifadəçi, (select count(*) from farms) as ferma,
             (select count(*) from animals) as heyvan, (select count(*) from sessions where expires_at > now()) as aktiv_sessiya,
             (select count(*) from leads where not handled) as yeni_müraciət`);
    console.table(rows);
  } else {
    console.log('İstifadə: cli.js migrate | leads [say] | stats');
    process.exitCode = 1;
  }
} finally {
  await db.end();
}
