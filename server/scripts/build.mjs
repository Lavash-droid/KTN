// Production build: TypeScript → dist/*.js (asılılıqlar node_modules-dan yüklənir).
// Ortaq kod (mobile/src/data/mapping.ts, mobile/src/domain/types.ts, supabase/functions/mygov-auth/handler.ts)
// bundle-a daxil edilir — ona görə Docker build konteksti repo köküdür.
import { build } from 'esbuild';

await build({
  entryPoints: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'migrate-from-supabase': 'scripts/migrate-from-supabase.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});
