/**
 * Backend müqaviləsi.
 *
 * Tətbiqin qalan hissəsi yalnız bu interfeysi tanıyır. Hazırda Supabase istifadə olunur;
 * gələcəkdə daxili serverə keçmək üçün `rest/RestRepository.ts`-i serverin API-sinə
 * uyğunlaşdırmaq və `EXPO_PUBLIC_BACKEND=rest` təyin etmək kifayətdir — ekranlar dəyişmir.
 * Serverin reallaşdırmalı olduğu endpoint-lər: `mobile/docs/BACKEND.md`.
 */
import type { Farm, FarmData, TableName, Tables } from '../domain/types';

export type BackendKind = 'supabase' | 'rest' | 'local';

export interface Session {
  userId: string;
  email: string | null;
}

export interface AuthApi {
  getSession(): Promise<Session | null>;
  /** Sessiya dəyişəndə çağırılır; abunəlikdən çıxmaq üçün funksiya qaytarır. */
  onChange(cb: (s: Session | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** `needsConfirmation` — e-poçt təsdiqi tələb olunursa true. */
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
}

export interface FarmRepository {
  readonly kind: BackendKind;
  readonly auth: AuthApi;

  /** İstifadəçinin fermasının bütün məlumatı (ferma yoxdursa yaradılır). */
  loadAll(): Promise<FarmData>;
  updateFarm(farm: Farm): Promise<void>;

  /** Qeydləri id üzrə əlavə edir və ya yeniləyir (idempotent — təkrar göndərmək təhlükəsizdir). */
  upsert<T extends TableName>(table: T, rows: Tables[T][]): Promise<void>;
  /** Qeydləri silir. Heyvan silinəndə ona aid qeydlər də silinməlidir. */
  remove(table: TableName, ids: string[]): Promise<void>;

  /** Lokal şəkli yükləyir, saxlanılan istinadı qaytarır. */
  uploadPhoto(animalId: string, localUri: string): Promise<string>;
  /** İstinaddan göstərilə bilən URL. */
  photoUrl(ref: string): Promise<string | null>;
  deletePhoto(ref: string): Promise<void>;

  /** Fermanın bütün məlumatını əvəz edir (bərpa, nümunə məlumat, silmə). */
  replaceAll(data: FarmData): Promise<void>;
}

/**
 * Backend xətası. `transient` = şəbəkə/server müvəqqəti əlçatan deyil — əməliyyat növbədə
 * saxlanılıb sonra təkrarlanır. Əks halda (icazə, məhdudiyyət pozulması) təkrarlamağın mənası yoxdur.
 */
export class RepoError extends Error {
  constructor(message: string, readonly transient: boolean) {
    super(message);
    this.name = 'RepoError';
  }
}

export const isTransient = (e: unknown) => !(e instanceof RepoError) || e.transient;
