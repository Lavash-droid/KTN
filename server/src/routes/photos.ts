/** /photos — heyvan şəkilləri: yükləmə, imzalı URL, faylın verilməsi, silmə. */
import { Hono } from 'hono';
import { requireAuth, type AuthEnv } from '../auth.ts';
import { assertWrite, canAccessFarm, ensureFarm } from '../farm.ts';
import { HttpError, isUuid } from '../http.ts';
import { isValidRef, refFarm, signRef, sniffImage, verifySignedRef } from '../storage.ts';
import type { Deps } from '../app.ts';

const URL_TTL_S = 7 * 24 * 3600;

export function photoRoutes({ db, cfg, store }: Deps) {
  const r = new Hono<AuthEnv>();
  const auth = requireAuth(db, cfg.sessionTtlDays);

  /** İmzalı URL ilə fayl — başlıqsız (expo-image, <img>). Giriş tələb etmir, imza və müddət yoxlanılır. */
  r.get('/file/:farm/:name', async (c) => {
    const ref = `${c.req.param('farm')}/${c.req.param('name')}`;
    const exp = Number(c.req.query('exp'));
    const sig = c.req.query('sig') ?? '';
    if (!isValidRef(ref) || !verifySignedRef(cfg.photoSecret, ref, exp, sig)) throw new HttpError(403, 'Keçid etibarsızdır və ya vaxtı bitib');
    const bytes = await store.get(ref);
    if (!bytes) throw new HttpError(404, 'Şəkil tapılmadı');
    return c.body(bytes as Uint8Array<ArrayBuffer>, 200, {
      'Content-Type': sniffImage(bytes) ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=604800, immutable',
      'Content-Length': String(bytes.length),
    });
  });

  r.get('/url', auth, async (c) => {
    const ref = c.req.query('ref');
    if (!isValidRef(ref)) throw new HttpError(400, 'ref yanlışdır');
    if (!(await canAccessFarm(db, c.get('user').id, refFarm(ref), false))) throw new HttpError(403, 'Bu şəkilə çıxışınız yoxdur');
    const exp = Math.floor(Date.now() / 1000) + URL_TTL_S;
    const url = `${cfg.publicUrl}/photos/file/${ref}?exp=${exp}&sig=${signRef(cfg.photoSecret, ref, exp)}`;
    return c.json({ url });
  });

  r.post('/:animalId', auth, async (c) => {
    const animalId = c.req.param('animalId');
    if (!isUuid(animalId)) throw new HttpError(400, 'animalId yanlışdır');
    const access = await ensureFarm(db, c.get('user').id);
    assertWrite(access);
    const form = await c.req.parseBody().catch(() => null);
    const file = form?.file;
    if (!(file instanceof File)) throw new HttpError(400, '"file" sahəsində şəkil gözlənilir');
    if (file.size > cfg.maxPhotoBytes) throw new HttpError(413, 'Şəkil çox böyükdür');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) throw new HttpError(415, 'Yalnız JPEG, PNG və ya WebP şəkil qəbul olunur');
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const ref = `${access.farmId}/${animalId.toLowerCase()}-${Date.now()}.${ext}`;
    await store.put(ref, bytes);
    return c.json({ ref }, 201);
  });

  r.delete('/', auth, async (c) => {
    const ref = c.req.query('ref');
    if (!isValidRef(ref)) throw new HttpError(400, 'ref yanlışdır');
    if (!(await canAccessFarm(db, c.get('user').id, refFarm(ref), true))) throw new HttpError(403, 'Bu əməliyyat üçün icazəniz yoxdur');
    await store.remove([ref]);
    return c.body(null, 204);
  });

  return r;
}
