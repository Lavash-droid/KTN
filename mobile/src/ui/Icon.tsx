/** Vahid ikon komponenti (SVG). Ikonlar: src/ui/iconPaths.ts — `node scripts/gen-icons.mjs` ilə yaradılır. */
import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ICONS, type IconName } from './iconPaths';

export type { IconName };

export const isIconName = (v: unknown): v is IconName => typeof v === 'string' && v in ICONS;

export const Icon = memo(function Icon({
  name, size = 22, color = '#1e2a22', style,
}: { name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessible={false} pointerEvents="none">
      <Path d={ICONS[name]} fill={color} />
    </Svg>
  );
});
