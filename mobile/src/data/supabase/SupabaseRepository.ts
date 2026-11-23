/** Supabase (Postgres + Auth + Storage) üzərində backend. Sxem: `/supabase/migrations`. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { emptyFarmData, TABLES, type Farm, type FarmData, type TableName, type Tables } from '../../domain/types';
import { readBytes } from '../../lib/files';
import { dbTable, fromRow, toRow } from '../mapping';
import { RepoError, type AuthApi, type FarmRepository, type Session } from '../repository';
import { getSupabase } from './client';

const BUCKET = 'animal-photos';
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;
const URL_CACHE_KEY = 'suru-photo-urls';

/** Postgres/HTTP xətasını müvəqqəti (şəbəkə) və ya qalıcı xətaya çevirir. */
function wrap(error: PostgrestError | { message: string; status?: number; statusCode?: string } | null, context: string): never | void {
  if (!error) return;
  const code = (error as PostgrestError).code ?? '';
  const status = Number((error as { status?: number }).status ?? (error as { statusCode?: string }).statusCode ?? 0);
  // Postgres kodu (23505, 42501…) və ya 4xx — qalıcı; qalanı (şəbəkə, 5xx) — müvəqqəti.
  const permanent = /^[0-9A-Z]{5}$/.test(code) || /^PGRST/.test(code) || (status >= 400 && status < 500);
  let msg = error.message;
  if (code === '23505') msg = 'Bu qeyd artıq mövcuddur (məs. eyni bırka nömrəsi)';
  else if (code === '42501') msg = 'Bu əməliyyat üçün icazəniz yoxdur';
  throw new RepoError(`${context}: ${msg}`, !permanent);
}

export class SupabaseRepository implements FarmRepository {
  readonly kind = 'supabase' as const;
  readonly auth: AuthApi;
  private sb: SupabaseClient;
  private farmIdPromise: Promise<string> | null = null;
  private urlCache = new Map<string, { url: string; exp: number }>();
  private urlCacheLoaded: Promise<void> | null = null;

  constructor(url: string, key: string) {
    this.sb = getSupabase(url, key);
    const sb = this.sb;
    const toSession = (
      s: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } } | null,
    ): Session | null => {
      if (!s) return null;
      const provider = String(s.user.app_metadata?.provider ?? 'email');
      const external = provider !== 'email';
      return {
        userId: s.user.id,
        // Dövlət girişi ilə yaradılan hesabların e-poçtu texniki (saxta) ünvandır — göstərilmir.
        email: external ? null : (s.user.email ?? null),
        name: (s.user.user_metadata?.full_name as string | undefined) || null,
        provider,
      };
    };

    this.auth = {
      getSession: async () => toSession((await sb.auth.getSession()).data.session),
      onChange: (cb) => {
        const { data } = sb.auth.onAuthStateChange((event, s) => {
          if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') this.farmIdPromise = null;
          cb(toSession(s));
        });
        return () => data.subscription.unsubscribe();
      },
      signIn: async (email, password) => {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new RepoError(authMessage(error.message), false);
      },
      signUp: async (email, password) => {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw new RepoError(authMessage(error.message), false);
        return { needsConfirmation: !data.session };
      },
      signOut: async () => {
        this.farmIdPromise = null;
        await sb.auth.signOut();
      },
      mygovStartUrl: (redirectTo) => `${url.replace(/\/+$/, '')}/functions/v1/mygov-auth/start?redirect_to=${encodeURIComponent(redirectTo)}`,
      completeMygov: async (params) => {
        const tokenHash = params.get('token_hash');
        if (!tokenHash) throw new RepoError('Giriş tokeni yoxdur', false);
        const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
        if (error) throw new RepoError(authMessage(error.message), false);
      },
    };
  }

  /** İstifadəçinin fermasının id-si; ferma yoxdursa serverdə yaradılır (`ensure_farm` RPC). */
  private farmId(): Promise<string> {
    if (!this.farmIdPromise) {
      this.farmIdPromise = (async () => {
        const { data, error } = await this.sb.rpc('ensure_farm');
        wrap(error, 'Ferma');
        return data as string;
      })();
      this.farmIdPromise.catch(() => (this.farmIdPromise = null));
    }
    return this.farmIdPromise;
  }

  async loadAll(): Promise<FarmData> {
    const fid = await this.farmId();
    const out = emptyFarmData();
    const farmQ = this.sb.from('farms').select('name, owner_name, region').eq('id', fid).single();
    const results = await Promise.all([farmQ, ...TABLES.map((t) => this.sb.from(dbTable(t)).select('*').eq('farm_id', fid).limit(100000))]);
    const [farmRes, ...tableRes] = results;
    wrap(farmRes.error, 'Ferma');
    const f = farmRes.data as { name: string; owner_name: string; region: string };
    out.farm = { name: f.name, owner: f.owner_name, region: f.region };
    TABLES.forEach((t, i) => {
      const r = tableRes[i];
      wrap(r.error, t);
      (out[t] as unknown[]) = (r.data ?? []).map((row) => fromRow(t, row as Record<string, unknown>));
    });
    return out;
  }

  async updateFarm(farm: Farm) {
    const fid = await this.farmId();
    const { error } = await this.sb.from('farms').update({ name: farm.name, owner_name: farm.owner, region: farm.region }).eq('id', fid);
    wrap(error, 'Ferma');
  }

  async upsert<T extends TableName>(table: T, rows: Tables[T][]) {
    if (!rows.length) return;
    const fid = await this.farmId();
    const { error } = await this.sb.from(dbTable(table)).upsert(rows.map((r) => toRow(table, r, { farm_id: fid })), { onConflict: 'id' });
    wrap(error, table);
  }

  async remove(table: TableName, ids: string[]) {
    if (!ids.length) return;
    const fid = await this.farmId();
    if (table === 'animals') {
      const { data } = await this.sb.from('animals').select('photo_path').in('id', ids).eq('farm_id', fid);
      const paths = (data ?? []).map((r) => r.photo_path as string | null).filter((p): p is string => !!p);
      if (paths.length) await this.sb.storage.from(BUCKET).remove(paths);
    }
    // Heyvana aid müalicə, çəki və mayalanma qeydləri verilənlər bazasında ON DELETE CASCADE ilə silinir.
    const { error } = await this.sb.from(dbTable(table)).delete().in('id', ids).eq('farm_id', fid);
    wrap(error, table);
  }

  async uploadPhoto(animalId: string, localUri: string) {
    const fid = await this.farmId();
    const path = `${fid}/${animalId}-${Date.now()}.jpg`;
    let bytes: ArrayBuffer;
    try {
      bytes = await readBytes(localUri);
    } catch {
      throw new RepoError('Şəkil faylı tapılmadı', false);
    }
    const { error } = await this.sb.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    wrap(error, 'Şəkil');
    return path;
  }

  /**
   * İmzalı URL-lər cihazda yadda saxlanılır: internet olmayanda köhnə URL qaytarılır və
   * şəkil expo-image-in disk keşindən (cacheKey = istinad) göstərilir.
   */
  async photoUrl(ref: string) {
    if (!this.urlCacheLoaded) {
      this.urlCacheLoaded = AsyncStorage.getItem(URL_CACHE_KEY).then((raw) => {
        if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, { url: string; exp: number }>)) this.urlCache.set(k, v);
      }).catch(() => {});
    }
    await this.urlCacheLoaded;
    const hit = this.urlCache.get(ref);
    if (hit && hit.exp > Date.now()) return hit.url;
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(ref, SIGNED_URL_TTL);
    if (error || !data) return hit?.url ?? null;
    this.urlCache.set(ref, { url: data.signedUrl, exp: Date.now() + (SIGNED_URL_TTL - 3600) * 1000 });
    void AsyncStorage.setItem(URL_CACHE_KEY, JSON.stringify(Object.fromEntries(this.urlCache))).catch(() => {});
    return data.signedUrl;
  }

  async deletePhoto(ref: string) {
    await this.sb.storage.from(BUCKET).remove([ref]);
  }

  async replaceAll(data: FarmData) {
    const fid = await this.farmId();
    // Uşaq cədvəllər heyvanlar silinəndə CASCADE ilə silinir; qalanları ayrıca.
    for (const t of ['animals', 'meds', 'tasks', 'feeds', 'purchases', 'milk_records'] as const) {
      const { error } = await this.sb.from(t).delete().eq('farm_id', fid);
      wrap(error, t);
    }
    const { data: files } = await this.sb.storage.from(BUCKET).list(fid, { limit: 1000 });
    const keep = new Set(data.animals.map((a) => a.photo).filter(Boolean));
    const stale = (files ?? []).map((f) => `${fid}/${f.name}`).filter((p) => !keep.has(p));
    if (stale.length) await this.sb.storage.from(BUCKET).remove(stale);

    await this.updateFarm(data.farm);
    for (const t of TABLES) {
      const rows = data[t] as Tables[typeof t][];
      for (let i = 0; i < rows.length; i += 500) await this.upsert(t, rows.slice(i, i + 500));
    }
  }

  async deleteAccount() {
    const fid = await this.farmId();
    const { data: sole, error: soleErr } = await this.sb.rpc('is_sole_owner', { f: fid });
    wrap(soleErr, 'Hesab');
    if (sole) {
      // Storage faylları SQL ilə silinə bilmir — əvvəlcə Storage API ilə silinir.
      for (;;) {
        const { data: files, error } = await this.sb.storage.from(BUCKET).list(fid, { limit: 1000 });
        wrap(error, 'Şəkillər');
        if (!files?.length) break;
        const { error: rmErr } = await this.sb.storage.from(BUCKET).remove(files.map((f) => `${fid}/${f.name}`));
        wrap(rmErr, 'Şəkillər');
        if (files.length < 1000) break;
      }
    }
    const { error } = await this.sb.rpc('delete_account');
    wrap(error, 'Hesab');
    this.farmIdPromise = null;
    this.urlCache.clear();
    await AsyncStorage.removeItem(URL_CACHE_KEY).catch(() => {});
    // İstifadəçi serverdə artıq yoxdur — yalnız lokal sessiya silinir.
    await this.sb.auth.signOut({ scope: 'local' });
  }
}

function authMessage(m: string): string {
  if (/invalid login credentials/i.test(m)) return 'E-poçt və ya şifrə yanlışdır';
  if (/email not confirmed/i.test(m)) return 'E-poçt təsdiqlənməyib — poçt qutunuzu yoxlayın';
  if (/already registered|already exists/i.test(m)) return 'Bu e-poçt artıq qeydiyyatdan keçib';
  if (/password/i.test(m) && /least|short|weak/i.test(m)) return 'Şifrə ən azı 6 simvol olmalıdır';
  if (/fetch|network/i.test(m)) return 'İnternet bağlantısı yoxdur';
  return m;
}
