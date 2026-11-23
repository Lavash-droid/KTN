import { useColorScheme } from 'react-native';

const light = {
  green: '#1f6f43',
  green2: '#2e8b57',
  greenSoft: '#e6f2ea',
  bg: '#f5f3ee',
  card: '#ffffff',
  text: '#1e2a22',
  muted: '#66736a',
  line: '#e2ded4',
  warn: '#b45309',
  warnSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  infoSoft: '#e0ecff',
  info: '#2457a6',
  onGreen: '#ffffff',
};

const dark: typeof light = {
  green: '#4caf7a',
  green2: '#5fc18c',
  greenSoft: '#1d3326',
  bg: '#121714',
  card: '#1b221d',
  text: '#e8efe9',
  muted: '#9aa89f',
  line: '#2b352e',
  warn: '#f0b44c',
  warnSoft: '#3a2e14',
  danger: '#f87171',
  dangerSoft: '#3b1a1a',
  infoSoft: '#1b2740',
  info: '#8fb4f0',
  onGreen: '#0d1a12',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const RADIUS = 14;
/** Başlıq zolağı həmişə yaşıl qalır (açıq mövzunun rəngi). */
export const BRAND = light.green;
