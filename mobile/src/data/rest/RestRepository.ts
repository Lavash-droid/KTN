/**
 * Daxili (öz) server üçün backend — HTTP/JSON.
 *
 * Bu adapter `mobile/docs/BACKEND.md`-də təsvir olunan API-ni gözləyir. Daxili server hazır
 * olanda `.env`-də `EXPO_PUBLIC_BACKEND=rest` və `EXPO_PUBLIC_API_URL=https://...` təyin edin.
 * Server API-si fərqli olarsa, yalnız bu faylı uyğunlaşdırmaq kifayətdir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Farm, FarmData, TableName, Tables } from '../../domain/types';
import { readBytes } from '../../lib/files';
import { isLocalPhoto } from '../mapping';
import { RepoError, type AuthApi, type FarmRepository, type Session } from '../repository';

const TOKEN_KEY = 'suru-rest-session';
const URL_CACHE_KEY = 'suru-rest-photo-urls';
/** Server imzalı URL-i 7 günlük verir; bir gün tez yeniləyirik. */
const URL_CACHE_MS = 6 * 24 * 3600 * 1000;

interface StoredSession extends Session {
  token: string;
}

export class RestRepository implements FarmRepository {
  readonly kind = 'rest' as const;
  readonly auth: AuthApi;
  private session: StoredSession | null = null;
  private loaded: Promise<void>;
  private listeners = new Set<(s: Session | null) => void>();
  private urlCache = new Map<string, { url: string; exp: number }>();
  private urlCacheLoaded: Promise<void> | null = null;

  constructor(private baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.loaded = AsyncStorage.getItem(TOKEN_KEY).then((raw) => {
      this.session = raw ? JSON.parse(raw) : null;
    });

    const setSession = (s: StoredSession | null) => this.setSession(s);

    const authCall = async (path: string, email: string, password: string) => {
      const res = await this.request<{ token: string | null; user: { id: string; email: string } }>('POST', path, { email, password }, false);
      if (res.token) await setSession({ token: res.token, userId: res.user.id, email: res.user.email });
      return res;
    };

    this.auth = {
      getSession: async () => {
        await this.loaded;
        return this.session ? { userId: this.session.userId, email: this.session.email, name: this.session.name ?? null, provider: this.session.provider } : null;
      },
      onChange: (cb) => {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
      },
      signIn: async (email, password) => {
        await authCall('/auth/login', email, password);
      },
      signUp: async (email, password) => {
        const res = await authCall('/auth/register', email, password);
        return { needsConfirmation: !res.token };
      },
      mygovStartUrl: (redirectTo) => `${this.baseUrl}/auth/mygov/start?redirect_to=${encodeURIComponent(redirectTo)}`,
      completeMygov: async (params) => {
        const token = params.get('token');
        const userId = params.get('user_id');
        if (!token || !userId) throw new RepoError('Giriş tokeni yoxdur', false);
        await setSession({ token, userId, email: null, name: params.get('name'), provider: 'mygov' });
      },
      signOut: async () => {
        try {
          await this.request('POST', '/auth/logout');
        } catch {
          /* server əlçatan olmasa da lokal sessiya silinir */
        }
        await setSession(null);
      },
    };
  }

  private async setSession(s: StoredSession | null) {
    this.session = s;
    if (s) await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(TOKEN_KEY);
    const pub: Session | null = s ? { userId: s.userId, email: s.email, name: s.name ?? null, provider: s.provider } : null;
    this.listeners.forEach((cb) => cb(pub));
  }

  private async request<R = unknown>(method: string, path: string, body?: unknown, auth = true): Promise<R> {
    await this.loaded;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth && this.session) headers.Authorization = `Bearer ${this.session.token}`;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, { method, headers, body: payload });
    } catch {
      throw new RepoError('Serverə qoşulmaq mümkün olmadı', true);
    }
    if (res.status === 401 && auth) {
      this.session = null;
      await AsyncStorage.removeItem(TOKEN_KEY);
      this.listeners.forEach((cb) => cb(null));
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        msg = j.message || j.error || msg;
      } catch {
        /* JSON deyil */
      }
      throw new RepoError(msg, res.status >= 500 || res.status === 408 || res.status === 429);
    }
    if (res.status === 204) return undefined as R;
    return (await res.json()) as R;
  }

  loadAll() {
    return this.request<FarmData>('GET', '/farm/data');
  }

  async updateFarm(farm: Farm) {
    await this.request('PUT', '/farm', farm);
  }

  async upsert<T extends TableName>(table: T, rows: Tables[T][]) {
    if (!rows.length) return;
    const clean = rows.map((r) => ('photo' in r && isLocalPhoto((r as { photo: string | null }).photo) ? { ...r, photo: undefined } : r));
    await this.request('PUT', `/records/${table}`, clean);
  }

  async remove(table: TableName, ids: string[]) {
    if (!ids.length) return;
    await this.request('POST', `/records/${table}/delete`, { ids });
  }

  async uploadPhoto(animalId: string, localUri: string) {
    const bytes = await readBytes(localUri);
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'image/jpeg' }), `${animalId}.jpg`);
    const res = await this.request<{ ref: string }>('POST', `/photos/${animalId}`, form);
    return res.ref;
  }

  /**
   * İmzalı URL-lər cihazda yadda saxlanılır: internet olmayanda köhnə URL qaytarılır və
   * şəkil expo-image-in disk keşindən (cacheKey = istinad) göstərilir.
   */
  async photoUrl(ref: string) {
    if (!this.urlCacheLoaded) {
      this.urlCacheLoaded = AsyncStorage.getItem(URL_CACHE_KEY)
        .then((raw) => {
          if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, { url: string; exp: number }>)) this.urlCache.set(k, v);
        })
        .catch(() => {});
    }
    await this.urlCacheLoaded;
    const hit = this.urlCache.get(ref);
    if (hit && hit.exp > Date.now()) return hit.url;
    try {
      const res = await this.request<{ url: string }>('GET', `/photos/url?ref=${encodeURIComponent(ref)}`);
      this.urlCache.set(ref, { url: res.url, exp: Date.now() + URL_CACHE_MS });
      void AsyncStorage.setItem(URL_CACHE_KEY, JSON.stringify(Object.fromEntries(this.urlCache))).catch(() => {});
      return res.url;
    } catch {
      return hit?.url ?? null;
    }
  }

  async deletePhoto(ref: string) {
    await this.request('DELETE', `/photos?ref=${encodeURIComponent(ref)}`);
  }

  async replaceAll(data: FarmData) {
    await this.request('PUT', '/farm/data', data);
  }

  async deleteAccount() {
    await this.request('DELETE', '/auth/account');
    this.urlCache.clear();
    await AsyncStorage.removeItem(URL_CACHE_KEY).catch(() => {});
    await this.setSession(null);
  }
}
