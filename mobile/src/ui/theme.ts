import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Rəng sistemi — sakit, göz yormayan palitra.
 * Böyük səthlər neytraldır (fon, kart, başlıq); yaşıl yalnız vurğu üçündür (ikon, aktiv element, əsas düymə).
 * Xəbərdarlıq rəngləri yüngül fon + rəngli ikon/zolaq kimi işlənir, böyük doymuş bloklar yoxdur.
 */
const light = {
  /** Vurğu: ikon, link, aktiv element, rəngli yazı */
  green: '#1f6f43',
  green2: '#2e8b57',
  /** Tonal fon: seçilmiş çip, ikon kvadratı, ikinci dərəcəli düymə */
  greenSoft: '#e9f3ed',
  /** Əsas (dolu) düymənin fonu */
  primary: '#1f6f43',
  /** Əsas düymə / dolu yaşıl səth üzərində yazı */
  onGreen: '#ffffff',
  bg: '#f5f5f2',
  card: '#ffffff',
  header: '#ffffff',
  text: '#1f2622',
  muted: '#6b746e',
  line: '#e6e6e1',
  warn: '#a15c07',
  warnSoft: '#fdf5e6',
  danger: '#b42323',
  dangerSoft: '#fcefef',
  info: '#2b5aa6',
  infoSoft: '#eef3fb',
};

const dark: typeof light = {
  green: '#7cc49a',
  green2: '#8fd0aa',
  greenSoft: '#1c2a22',
  primary: '#2e6b4a',
  onGreen: '#eef6f1',
  bg: '#121513',
  card: '#1a1e1b',
  header: '#1a1e1b',
  text: '#e3e7e4',
  muted: '#99a29c',
  line: '#2a302c',
  warn: '#d8b169',
  warnSoft: '#262219',
  danger: '#e38b8b',
  dangerSoft: '#2a1d1e',
  info: '#97b5e6',
  infoSoft: '#1b2130',
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

export const RADIUS = 14;
/** Brend rəngi — yalnız loqoda (tətbiq ikonu ilə eyni). */
export const BRAND = light.green;
