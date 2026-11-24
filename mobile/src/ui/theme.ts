import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Rəng sistemi — myGov üslubu: açıq boz fon üzərində kontursuz ağ kartlar, boz dairədə boz ikonlar,
 * dövlət göyü yalnız aktiv element və əsas düymə üçün. Yaşıl yalnız "qaydasındadır" vəziyyəti üçün.
 */
const light = {
  /** Vurğu: ikon, link, aktiv element, rəngli başlıq */
  accent: '#315ab5',
  /** Yüngül fon: seçilməmiş "pill" düymə, ikon kvadratı, ikinci dərəcəli düymə */
  accentSoft: '#f0f2fd',
  /** Parlaq göy — yan paneldə aktiv zolaq, kiçik nişanlar */
  bright: '#0f7ef5',
  /** Əsas (dolu) düymənin fonu */
  primary: '#315ab5',
  /** Tünd göy — ana səhifə kartı, loqo */
  primaryDeep: '#24468f',
  /** Əsas düymə / dolu göy səth üzərində yazı */
  onAccent: '#ffffff',
  /** Uğur / qaydasındadır */
  ok: '#1f8a5b',
  okSoft: '#e7f5ee',
  /** İsti vurğu (kiçik nişan) */
  gold: '#b7802a',
  goldSoft: '#f8efdf',
  bg: '#f2f3f7',
  card: '#ffffff',
  /** Kart içində ikinci səth (statistika xanası, sahə fonu) */
  cardAlt: '#f3f4f7',
  header: '#f2f3f7',
  input: '#ffffff',
  /** Başlıqlar */
  text: '#1b1d26',
  /** Siyahı sətirlərinin əsas mətni (bir az yumşaq) */
  body: '#45464f',
  muted: '#7988a6',
  faint: '#a8b1c4',
  /** Sahə (input) konturu */
  line: '#dfe3ec',
  /** Kart içində bölücü xətt */
  divider: '#eceef3',
  /** Siyahı ikonu: boz dairə və boz ikon */
  iconBg: '#f1f2f6',
  icon: '#5d6472',
  warn: '#b26a00',
  warnSoft: '#fdf3e1',
  danger: '#c62f2f',
  dangerSoft: '#fdecec',
  info: '#315ab5',
  infoSoft: '#eef2fd',
  shadow: '#1b2a4e',
};

const dark: typeof light = {
  accent: '#8eaaf0',
  accentSoft: '#1b2440',
  bright: '#5aa5ff',
  primary: '#3d67c6',
  primaryDeep: '#1d2d55',
  onAccent: '#ffffff',
  ok: '#6fcf9c',
  okSoft: '#16291f',
  gold: '#d9ad62',
  goldSoft: '#2a2418',
  bg: '#0e121b',
  card: '#151a26',
  cardAlt: '#1a2030',
  header: '#0e121b',
  input: '#121722',
  text: '#e8ebf3',
  body: '#c9cedb',
  muted: '#8f9ab3',
  faint: '#5f6a82',
  line: '#2a3248',
  divider: '#222a3b',
  iconBg: '#222838',
  icon: '#aab2c5',
  warn: '#e5b467',
  warnSoft: '#2a2317',
  danger: '#f19a94',
  dangerSoft: '#2d1b1d',
  info: '#8eaaf0',
  infoSoft: '#1b2440',
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

export const RADIUS = 16;

/**
 * Şrift — Inter (myGov kimi sadə, neytral sans-serif; Azərbaycan hərfləri və ₼ daxil).
 * Hər çəki ayrıca ailə kimi yüklənir; `ui/Text` komponenti `fontWeight`-ə görə ailəni özü seçir.
 */
export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Başlıqlar üçün (əvvəlki serif başlıq şriftinin yerinə) */
  display: 'Inter_600SemiBold',
  displayBold: 'Inter_700Bold',
} as const;

/** `fontWeight` → Inter ailəsi. */
export function fontFamilyFor(weight: unknown): string {
  switch (String(weight ?? '400')) {
    case '500':
      return FONT.medium;
    case '600':
      return FONT.semibold;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return FONT.bold;
    default:
      return FONT.regular;
  }
}

/** Yumşaq kölgə — kartlar üçün (qaranlıq mövzuda kölgə yox, yalnız xətt). */
export function shadow(c: Colors, level: 1 | 2 = 1) {
  if (c.bg === dark.bg) return {};
  return level === 1
    ? { shadowColor: c.shadow, shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 0 }
    : { shadowColor: c.shadow, shadowOpacity: 0.12, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 6 };
}
/** Brend rəngi — loqoda. */
export const BRAND = light.primary;
