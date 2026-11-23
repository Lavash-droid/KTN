import { View } from 'react-native';
import { Icon } from './Icon';
import { BRAND } from './theme';

/** Sürü loqosu: tünd yaşıl fonda ağ inək (tətbiq ikonu ilə eyni). `light` — tünd fonda ağ variant. */
export function Logo({ size = 40, light }: { size?: number; light?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: light ? '#ffffff' : BRAND, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="cow" size={size * 0.62} color={light ? BRAND : '#ffffff'} />
    </View>
  );
}
