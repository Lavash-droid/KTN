/**
 * Heyvan şəkilləri — serverin diskində (Supabase Storage əvəzi).
 *
 * İstinad (ref) formatı Supabase ilə eynidir: "<farm_id>/<animal_id>-<vaxt>.jpg", ona görə köçürülən
 * qeydlərdəki `photo_path` dəyərləri dəyişmədən işləyir. Göstərmək üçün imzalı, müddətli URL verilir
 * (expo-image başlıq göndərmədən yükləyə bilsin).
 *
 * Gələcəkdə S3/MinIO lazım olarsa, eyni interfeysi (PhotoStore) reallaşdırmaq kifayətdir.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface PhotoStore {
  put(ref: string, bytes: Uint8Array): Promise<void>;
  get(ref: string): Promise<Uint8Array | null>;
  remove(refs: string[]): Promise<void>;
  /** Fermanın bütün fayllarının istinadları. */
  list(farmId: string): Promise<string[]>;
  removeFarm(farmId: string): Promise<void>;
}

const REF_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/i;

/** Yol keçidi (../) və s. qarşısını alır: yalnız "<uuid>/<sadə fayl adı>". */
export const isValidRef = (ref: unknown): ref is string => typeof ref === 'string' && REF_RE.test(ref) && !ref.includes('..');
export const refFarm = (ref: string) => ref.split('/')[0].toLowerCase();

export class DiskPhotoStore implements PhotoStore {
  constructor(private root: string) {}

  private file(ref: string) {
    if (!isValidRef(ref)) throw new Error(`yanlış şəkil istinadı: ${ref}`);
    return path.join(this.root, ref);
  }

  async put(ref: string, bytes: Uint8Array) {
    const f = this.file(ref);
    await fs.mkdir(path.dirname(f), { recursive: true });
    const tmp = `${f}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, f); // atomar: yarımçıq fayl görünmür
  }

  async get(ref: string) {
    try {
      return new Uint8Array(await fs.readFile(this.file(ref)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  async remove(refs: string[]) {
    await Promise.all(refs.filter(isValidRef).map((r) => fs.rm(this.file(r), { force: true })));
  }

  async list(farmId: string) {
    try {
      const names = await fs.readdir(path.join(this.root, farmId));
      return names.filter((n) => !n.endsWith('.tmp')).map((n) => `${farmId}/${n}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  async removeFarm(farmId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(farmId)) return;
    await fs.rm(path.join(this.root, farmId), { recursive: true, force: true });
  }
}

/* ---------- imzalı URL-lər ---------- */

export function signRef(secret: string, ref: string, exp: number): string {
  return crypto.createHmac('sha256', secret).update(`photo:${ref}:${exp}`).digest('base64url');
}

export function verifySignedRef(secret: string, ref: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const want = Buffer.from(signRef(secret, ref, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** Faylın ilk baytlarından şəkil tipini təyin edir (yalnız JPEG/PNG/WebP qəbul olunur). */
export function sniffImage(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}
