import { router, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../ui/Icon';
import { useWide } from '../../ui/layout';
import { Sidebar } from '../../ui/Sidebar';
import { useFarm } from '../../store/farmStore';
import { SyncBadge } from '../../ui/SyncBadge';
import { FONT, useColors } from '../../ui/theme';

const icon = (name: IconName) =>
  function TabIcon({ color, focused }: { focused: boolean; color: unknown }) {
    const c = useColors();
    return (
      <View style={{ width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? c.greenSoft : 'transparent' }}>
        <Icon name={name} size={23} color={typeof color === 'string' ? color : undefined} />
      </View>
    );
  };

export default function TabsLayout() {
  const c = useColors();
  const { data } = useFarm();
  // Kompüter / planşet ekranında menyu solda (yan panel), telefonda altda.
  const wide = useWide();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={wide ? (props) => <Sidebar {...props} /> : undefined}
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        headerStyle: { backgroundColor: c.header },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: FONT.display, fontSize: 21 },
        headerTitleAlign: 'left',
        headerRight: () => <SyncBadge />,
        tabBarActiveTintColor: c.green,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line, height: 70 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom || 10 },
        tabBarItemStyle: { gap: 2 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: data.farm.name || 'Sürü', tabBarLabel: 'Panel', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="animals" options={{ title: 'Heyvanlar', tabBarIcon: icon('cow') }} />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Əlavə et',
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View
              style={{
                backgroundColor: c.primary, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: -14,
                borderWidth: 4, borderColor: c.card, shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
              }}
            >
              <Icon name="plus" size={24} color={c.onGreen} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            // Tab əvəzinə yeni heyvan formasını açırıq.
            e.preventDefault();
            router.push('/animal/form');
          },
        }}
      />
      <Tabs.Screen name="tasks" options={{ title: 'Tapşırıqlar', tabBarIcon: icon('tasks') }} />
      <Tabs.Screen name="more" options={{ title: 'Digər', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
