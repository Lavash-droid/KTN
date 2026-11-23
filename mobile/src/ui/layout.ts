import { useWindowDimensions } from 'react-native';

/** Kompüter / geniş planşet ekranı: yan panel, geniş məzmun, mərkəzdə dialoqlar. */
export const WIDE_BREAKPOINT = 900;
export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}
