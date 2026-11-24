/**
 * myGov (dövlət vahid girişi) ilə daxil olma — tətbiq tərəfi.
 * Server hissəsi: supabase/functions/mygov-auth. Giriş ekranındakı bölmə həmişə görünür; düymə server
 * provayderin açarları ilə qurulanda (GET /mygov-auth/status → configured) aktiv olur.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { repo } from '../data';

/** Bu backend myGov girişini dəstəkləyirmi (lokal rejimdə yox). */
export const mygovSupported = repo.auth.mygovStartUrl('x') !== null;

export type MygovAvailability = 'checking' | 'ready' | 'unavailable';

let cached: Promise<boolean> | null = null;
/** Serverdə myGov girişinin qoşulub-qoşulmadığı (bir dəfə yoxlanılır; uğursuzluqda növbəti dəfə təkrar). */
export function checkMygov(): Promise<boolean> {
  if (!mygovSupported) return Promise.resolve(false);
  if (!cached) {
    cached = repo.auth.mygovAvailable();
    void cached.then((ok) => {
      if (!ok) cached = null;
    });
  }
  return cached;
}

export function useMygovAvailability(): MygovAvailability {
  const [state, setState] = useState<MygovAvailability>(mygovSupported ? 'checking' : 'unavailable');
  useEffect(() => {
    let alive = true;
    void checkMygov().then((ok) => alive && setState(ok ? 'ready' : 'unavailable'));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

const ERRORS: Record<string, string> = {
  access_denied: 'Giriş ləğv olundu',
  expired: 'Giriş müddəti bitdi, yenidən cəhd edin',
  provider_unavailable: 'myGov hazırda əlçatan deyil, bir az sonra yenidən cəhd edin',
  provider_error: 'myGov girişi alınmadı',
  server_error: 'Giriş tamamlanmadı, yenidən cəhd edin',
};

/** Qayıdış ünvanı: vebdə tətbiqin öz səhifəsi, telefonda suru://mygov (Expo Go-da exp://…/--/mygov). */
function returnUrl(): string {
  if (Platform.OS === 'web') return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/mygov`;
  return Linking.createURL('mygov');
}

// Android-də qayıdış həm auth sessiyasına, həm də marşrutlaşdırıcıya düşə bilər — token bir dəfə istifadə olunur.
const consumed = new Set<string>();

/** Qayıdış URL-indəki fraqmenti emal edir. Uğursuzluqda Azərbaycan dilində xəta atır. */
export async function completeMygovFromUrl(url: string): Promise<'ok' | 'ignored'> {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(hash);
  const err = params.get('error');
  if (err) throw new Error(ERRORS[err] ?? ERRORS.server_error);
  const key = params.get('token_hash') ?? params.get('token');
  if (!key) return 'ignored';
  if (consumed.has(key)) return 'ignored';
  consumed.add(key);
  await repo.auth.completeMygov(params);
  return 'ok';
}

/** "myGov ilə daxil ol". Vebdə səhifə yönləndirilir; telefonda sistem brauzer pəncərəsi açılır. */
export async function signInWithMygov(): Promise<void> {
  const back = returnUrl();
  const start = repo.auth.mygovStartUrl(back);
  if (!start) throw new Error('myGov girişi bu rejimdə dəstəklənmir');
  if (Platform.OS === 'web') {
    window.location.assign(start);
    return;
  }
  const res = await WebBrowser.openAuthSessionAsync(start, back);
  if (res.type === 'success') await completeMygovFromUrl(res.url);
}
