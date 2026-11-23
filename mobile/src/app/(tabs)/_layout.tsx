import { router, Tabs } from 'expo-router';
import { Text, useWindowDimensions, View } from 'react-native';
import { useFarm } from '../../store/farmStore';
import { SyncBadge } from '../../ui/SyncBadge';
import { BRAND, useColors } from '../../ui/theme';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.65 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const c = useColors();
  const { data } = useFarm();
  // Kompüter / planşet ekranında menyu solda (yan panel), telefonda altda.
  const wide = useWindowDimensions().width >= 900;
  return (
    <Tabs
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        headerStyle: { backgroundColor: BRAND },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <SyncBadge />,
        tabBarActiveTintColor: c.green,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: wide
          ? { backgroundColor: c.card, borderRightColor: c.line, width: 230, paddingTop: 12 }
          : { backgroundColor: c.card, borderTopColor: c.line },
        tabBarActiveBackgroundColor: wide ? c.greenSoft : undefined,
        tabBarItemStyle: wide ? { borderRadius: 10, marginHorizontal: 8 } : undefined,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: data.farm.name || 'Sürü', tabBarLabel: 'Panel', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="animals" options={{ title: 'Heyvanlar', tabBarIcon: icon('🐄') }} />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Əlavə et',
          tabBarIcon: () => (
            <View style={{ backgroundColor: c.green, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.onGreen, fontSize: 22, lineHeight: 26 }}>＋</Text>
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
      <Tabs.Screen name="tasks" options={{ title: 'Tapşırıqlar', tabBarIcon: icon('✅') }} />
      <Tabs.Screen name="more" options={{ title: 'Digər', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
