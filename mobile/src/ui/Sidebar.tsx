/** Kompüter ekranı üçün sol yan panel (geniş ekranda alt menyunun əvəzinə). */
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, Pressable, Text, View } from 'react-native';
import { useAuth } from '../store/auth';
import { farmStore, useFarm } from '../store/farmStore';
import { useColors } from './theme';

const ITEMS: Record<string, { icon: string; label: string }> = {
  index: { icon: '🏠', label: 'Panel' },
  animals: { icon: '🐄', label: 'Heyvanlar' },
  add: { icon: '＋', label: 'Heyvan əlavə et' },
  tasks: { icon: '✅', label: 'Tapşırıqlar' },
  more: { icon: '⚙️', label: 'Digər' },
};

export function Sidebar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useColors();
  const { data, status } = useFarm();
  const { session } = useAuth();
  const base = process.env.EXPO_BASE_URL ?? '';

  return (
    <View style={{ width: 240, backgroundColor: c.card, borderRightWidth: 1, borderRightColor: c.line, paddingVertical: 16, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 4 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>🐄</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.green }}>Sürü</Text>
      </View>
      <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, paddingHorizontal: 8, marginBottom: 18 }}>
        {data.farm.name}
      </Text>

      {state.routes.map((route, i) => {
        const item = ITEMS[route.name];
        if (!item) return null;
        const active = state.index === i;
        const isAdd = route.name === 'add';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="link"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (isAdd) return router.push('/animal/form');
              const ev = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !ev.defaultPrevented) navigateToTab(route.key);
            }}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, marginBottom: 2,
              backgroundColor: active ? c.greenSoft : hovered || pressed ? c.bg : 'transparent',
            })}
          >
            {isAdd ? (
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c.onGreen, fontSize: 16, lineHeight: 20 }}>＋</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 19, width: 24, textAlign: 'center' }}>{item.icon}</Text>
            )}
            <Text style={{ fontSize: 15, color: active ? c.green : c.text, fontWeight: active ? '700' : '500' }}>{item.label}</Text>
          </Pressable>
        );
      })}

      <View style={{ flex: 1 }} />
      <Pressable onPress={() => void farmStore.sync()} style={{ paddingHorizontal: 8, paddingVertical: 6 }} accessibilityLabel="Sinxronizasiya et">
        <Text style={{ color: status.online ? c.muted : c.warn, fontSize: 12.5 }}>
          {status.syncing ? '⟳ Sinxronlaşır…' : !status.online ? `● Offline${status.pending ? ` · ${status.pending} gözləyir` : ''}` : status.pending ? `${status.pending} dəyişiklik gözləyir` : '● Sinxronlaşdırılıb'}
        </Text>
      </Pressable>
      {session?.name || session?.email ? (
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12.5, paddingHorizontal: 8 }}>
          {session.name || session.email}
        </Text>
      ) : null}
      {Platform.OS === 'web' && base ? (
        <Pressable onPress={() => window.location.assign('/')} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
          <Text style={{ color: c.green, fontSize: 13.5 }}>← Ana səhifə</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
