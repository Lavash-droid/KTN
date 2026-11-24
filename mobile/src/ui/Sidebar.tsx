/** Kompüter ekranı üçün sol yan panel (geniş ekranda alt menyunun əvəzinə). */
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, Pressable, View } from 'react-native';
import { Text } from './Text';
import { useAuth } from '../store/auth';
import { farmStore, useFarm } from '../store/farmStore';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { FONT, useColors, useScheme, useThemePref } from './theme';

const ITEMS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Panel' },
  animals: { icon: 'cow', label: 'Heyvanlar' },
  add: { icon: 'plus', label: 'Heyvan əlavə et' },
  tasks: { icon: 'tasks', label: 'Tapşırıqlar' },
  more: { icon: 'settings', label: 'Digər' },
};

export function Sidebar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useColors();
  const { data, status } = useFarm();
  const { session } = useAuth();
  const base = process.env.EXPO_BASE_URL ?? '';
  const scheme = useScheme();
  const { setPref } = useThemePref();

  return (
    <View style={{ width: 252, backgroundColor: c.card, borderRightWidth: 1, borderRightColor: c.line, paddingVertical: 20, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 8 }}>
        <Logo size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 20, fontFamily: FONT.displayBold, color: c.text, lineHeight: 24 }}>Sürü</Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12.5 }}>
            {data.farm.name}
          </Text>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: c.line, marginVertical: 18, marginHorizontal: 8 }} />

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
              flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
              backgroundColor: active ? c.accentSoft : hovered || pressed ? c.cardAlt : 'transparent',
            })}
          >
            {/* myGov kimi: aktiv bəndin solunda göy zolaq */}
            {active && !isAdd ? <View style={{ position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: c.bright }} /> : null}
            {isAdd ? (
              <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={17} color={c.onAccent} />
              </View>
            ) : (
              <Icon name={item.icon} size={22} color={active ? c.accent : c.muted} />
            )}
            <Text style={{ fontSize: 15, color: active ? c.accent : c.body, fontWeight: active ? '600' : '400' }}>{item.label}</Text>
          </Pressable>
        );
      })}

      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => setPref(scheme === 'dark' ? 'light' : 'dark')}
        accessibilityRole="button"
        accessibilityLabel={scheme === 'dark' ? 'Açıq mövzu' : 'Qaranlıq mövzu'}
        style={({ hovered }: { hovered?: boolean; pressed: boolean }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 10, marginBottom: 4,
          backgroundColor: hovered ? c.bg : 'transparent',
        })}
      >
        <Icon name={scheme === 'dark' ? 'sun' : 'moon'} size={18} color={c.muted} />
        <Text style={{ color: c.muted, fontSize: 13.5 }}>{scheme === 'dark' ? 'Açıq mövzu' : 'Qaranlıq mövzu'}</Text>
      </Pressable>
      <Pressable onPress={() => void farmStore.sync()} style={{ paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel="Sinxronizasiya et">
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: !status.online ? c.warn : status.pending || status.syncing ? c.gold : c.ok }} />
        <Text style={{ color: status.online ? c.muted : c.warn, fontSize: 12.5 }}>
          {status.syncing ? 'Sinxronlaşır…' : !status.online ? `Offline${status.pending ? ` · ${status.pending} gözləyir` : ''}` : status.pending ? `${status.pending} dəyişiklik gözləyir` : 'Sinxronlaşdırılıb'}
        </Text>
      </Pressable>
      {session?.name || session?.email ? (
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12.5, paddingHorizontal: 8 }}>
          {session.name || session.email}
        </Text>
      ) : null}
      {Platform.OS === 'web' && base ? (
        <Pressable onPress={() => window.location.assign('/')} style={{ paddingHorizontal: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="arrow-left" size={16} color={c.accent} />
          <Text style={{ color: c.accent, fontSize: 13.5 }}>Ana səhifə</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
