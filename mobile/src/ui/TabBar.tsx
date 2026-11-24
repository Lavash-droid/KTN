/** Telefon üçün alt menyu — myGov kimi: kənarlardan ayrı, dəyirmi, üzən panel; aktiv bənd açıq fonlu "pill". */
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { shadow, useColors } from './theme';

const ITEMS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Panel' },
  animals: { icon: 'cow', label: 'Heyvanlar' },
  add: { icon: 'plus', label: 'Əlavə et' },
  tasks: { icon: 'tasks', label: 'Tapşırıqlar' },
  more: { icon: 'settings', label: 'Digər' },
};

/** Ekran məzmununun alt menyu altında qalmaması üçün lazım olan boşluq. */
export const TAB_BAR_SPACE = 120;

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: Math.max(insets.bottom - 8, 12) }}>
      <View
        style={[
          { flexDirection: 'row', backgroundColor: c.card, borderRadius: 30, padding: 6, maxWidth: 560, width: '100%', alignSelf: 'center' },
          shadow(c, 2),
        ]}
      >
        {state.routes.map((route, i) => {
          const item = ITEMS[route.name];
          if (!item) return null;
          const active = state.index === i;
          const isAdd = route.name === 'add';
          const color = active ? c.accent : c.muted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              onPress={() => {
                if (isAdd) return router.push('/animal/form');
                const ev = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!active && !ev.defaultPrevented) navigateToTab(route.key);
              }}
              style={({ pressed }) => ({
                flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 7, borderRadius: 24,
                backgroundColor: active ? c.accentSoft : pressed ? c.cardAlt : 'transparent',
              })}
            >
              {isAdd ? (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={24} color={c.onAccent} />
                </View>
              ) : (
                <>
                  <Icon name={item.icon} size={23} color={color} />
                  <Text style={{ fontSize: 10.5, fontWeight: '500', color }} numberOfLines={1}>
                    {item.label}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
