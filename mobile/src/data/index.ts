/**
 * Backend seçimi — `.env` faylındakı dəyişənlərə görə:
 *   EXPO_PUBLIC_BACKEND = supabase | rest | local
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY   (supabase üçün)
 *   EXPO_PUBLIC_API_URL                                  (daxili server üçün)
 */
import { LocalRepository } from './local/LocalRepository';
import type { BackendKind, FarmRepository } from './repository';
import { RestRepository } from './rest/RestRepository';
import { SupabaseRepository } from './supabase/SupabaseRepository';

function create(): FarmRepository {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const wanted = (process.env.EXPO_PUBLIC_BACKEND as BackendKind | undefined) ?? (supabaseUrl ? 'supabase' : 'local');

  if (wanted === 'rest' && apiUrl) return new RestRepository(apiUrl);
  if (wanted === 'supabase' && supabaseUrl && supabaseKey) return new SupabaseRepository(supabaseUrl, supabaseKey);
  if (wanted !== 'local') {
    console.warn(`[Sürü] "${wanted}" backend-i üçün konfiqurasiya natamamdır — lokal rejim istifadə olunur.`);
  }
  return new LocalRepository();
}

export const repo: FarmRepository = create();
export * from './repository';
