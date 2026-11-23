import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Rəng sistemi — "kətan və meşə": isti, kağızabənzər fon, dərin meşə yaşılı əsas rəng,
 * buğda-qızılı yalnız kiçik vurğular üçün. Böyük səthlər neytraldır; xəbərdarlıqlar yüngül fon + rəngli ikon.
 */
const light = {
  /** Vurğu: ikon, link, aktiv element, rəngli yazı */
  green: '#1e5b43',
  green2: '#2b7356',
  /** Tonal fon: seçilmiş element, ikon kvadratı, ikinci dərəcəli düymə */
  greenSoft: '#e5eee8',
  /** Əsas (dolu) düymənin fonu */
  primary: '#1e5b43',
  /** Ən tünd yaşıl — ana səhifə kartı, loqo */
  primaryDeep: '#163f30',
  /** Əsas düymə / dolu yaşıl səth üzərində yazı */
  onGreen: '#ffffff',
  /** Buğda-qızılı vurğu (ulduz, kiçik nişan) */
  gold: '#b7802a',
  goldSoft: '#f6ecda',
  bg: '#f6f3ec',
  card: '#ffffff',
  /** Kart içində ikinci səth (statistika xanası, sahə fonu) */
  cardAlt: '#faf8f3',
  header: '#f6f3ec',
  input: '#f8f6f0',
  text: '#1a2520',
  muted: '#6b7268',
  faint: '#a3a89f',
  line: '#e8e3d7',
  warn: '#a3620b',
  warnSoft: '#fbf0dc',
  danger: '#b3362e',
  dangerSoft: '#fbebe8',
  info: '#2f5d9b',
  infoSoft: '#eaf0f8',
  shadow: '#2b2416',
};

const dark: typeof light = {
  green: '#8acaa4',
  green2: '#9ed4b3',
  greenSoft: '#1b2c22',
  primary: '#2f7656',
  primaryDeep: '#173427',
  onGreen: '#f2f8f4',
  gold: '#d9ad62',
  goldSoft: '#2a2418',
  bg: '#0f1411',
  card: '#171f1a',
  cardAlt: '#1c251f',
  header: '#0f1411',
  input: '#131a16',
  text: '#e7ebe6',
  muted: '#9aa39b',
  faint: '#6c766e',
  line: '#253029',
  warn: '#dcb26a',
  warnSoft: '#28221a',
  danger: '#e8958d',
  dangerSoft: '#2b1d1c',
  info: '#9bb8e6',
  infoSoft: '#1a2131',
  shadow: '#000000',
};

export type Colors = typeof light;

/* ---------- Mövzu seçimi: açıq / qaranlıq / sistem ---------- */
export type ThemePref = 'light' | 'dark' | 'system';
const PREF_KEY = 'suru-theme';
/** Standart — açıq mövzu (istifadəçi qaranlıq rejimi istəsə "Digər"dən seçir). */
const DEFAULT_PREF: ThemePref = 'light';

const ThemeCtx = createContext<{ pref: ThemePref; setPref: (p: ThemePref) => void }>({ pref: DEFAULT_PREF, setPref: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(DEFAULT_PREF);
  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      })
      .catch(() => {});
  }, []);
  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    void AsyncStorage.setItem(PREF_KEY, p).catch(() => {});
  }, []);
  return createElement(ThemeCtx.Provider, { value: { pref, setPref } }, children);
}

export const useThemePref = () => useContext(ThemeCtx);

/** Hazırda tətbiq olunan sxem (seçim + sistem ayarı). */
export function useScheme(): 'light' | 'dark' {
  const { pref } = useContext(ThemeCtx);
  const system = useColorScheme();
  if (pref === 'system') return system === 'dark' ? 'dark' : 'light';
  return pref;
}

export function useColors(): Colors {
  return useScheme() === 'dark' ? dark : light;
}

export const RADIUS = 18;

/** Başlıq şrifti (Fraunces) — Azərbaycan hərfləri və ₼ daxil. Mətn üçün sistem şrifti qalır. */
export const FONT = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
} as const;

/** Yumşaq kölgə — kartlar üçün (qaranlıq mövzuda kölgə yox, yalnız xətt). */
export function shadow(c: Colors, level: 1 | 2 = 1) {
  if (c.bg === dark.bg) return {};
  return level === 1
    ? { shadowColor: c.shadow, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 1 }
    : { shadowColor: c.shadow, shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 };
}
/** Brend rəngi — yalnız loqoda (tətbiq ikonu ilə eyni). */
export const BRAND = light.primaryDeep;
