import { View } from 'react-native';
import { Icon } from './Icon';
import { BRAND } from './theme';

/** Sürü loqosu: yaşıl fonda ağ inək (tətbiq ikonu ilə eyni). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="cow" size={size * 0.64} color="#fff" />
    </View>
  );
}
