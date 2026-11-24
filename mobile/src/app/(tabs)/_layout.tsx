import { router, Tabs } from 'expo-router';
import { useWide } from '../../ui/layout';
import { Sidebar } from '../../ui/Sidebar';
import { useFarm } from '../../store/farmStore';
import { SyncBadge } from '../../ui/SyncBadge';
import { TabBar } from '../../ui/TabBar';
import { FONT, useColors } from '../../ui/theme';

export default function TabsLayout() {
  const c = useColors();
  const { data } = useFarm();
  // Kompüter / planşet ekranında menyu solda (yan panel), telefonda altda üzən panel.
  const wide = useWide();
  return (
    <Tabs
      tabBar={(props) => (wide ? <Sidebar {...props} /> : <TabBar {...props} />)}
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        headerStyle: { backgroundColor: c.header },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: FONT.semibold, fontSize: 17, color: c.text },
        headerTitleAlign: 'center',
        headerRight: () => <SyncBadge />,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: data.farm.name || 'Sürü' }} />
      <Tabs.Screen name="animals" options={{ title: 'Heyvanlar' }} />
      <Tabs.Screen
        name="add"
        options={{ title: 'Əlavə et' }}
        listeners={{
          tabPress: (e) => {
            // Tab əvəzinə yeni heyvan formasını açırıq.
            e.preventDefault();
            router.push('/animal/form');
          },
        }}
      />
      <Tabs.Screen name="tasks" options={{ title: 'Tapşırıqlar' }} />
      <Tabs.Screen name="more" options={{ title: 'Digər' }} />
    </Tabs>
  );
}
