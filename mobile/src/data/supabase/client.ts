import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

let client: SupabaseClient | null = null;

export function getSupabase(url: string, key: string): SupabaseClient {
  if (client) return client;
  client = createClient(url, key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  if (Platform.OS !== 'web') {
    // Tətbiq arxa fonda olanda tokenin yenilənməsini dayandırırıq, ön plana qayıdanda davam edir.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client!.auth.startAutoRefresh();
      else client!.auth.stopAutoRefresh();
    });
  }
  return client;
}
