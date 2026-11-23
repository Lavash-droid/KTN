import { router, Tabs } from 'expo-router';
import { View } from 'react-native';
import { Icon, type IconName } from '../../ui/Icon';
import { useWide } from '../../ui/layout';
import { Sidebar } from '../../ui/Sidebar';
import { useFarm } from '../../store/farmStore';
import { SyncBadge } from '../../ui/SyncBadge';
import { BRAND, useColors } from '../../ui/theme';

const icon = (name: IconName) =>
  function TabIcon({ color }: { focused: boolean; color: unknown }) {
    return <Icon name={name} size={25} color={typeof color === 'string' ? color : undefined} />;
  };

export default function TabsLayout() {
  const c = useColors();
  const { data } = useFarm();
  // Kompüter / planşet ekranında menyu solda (yan panel), telefonda altda.
  const wide = useWide();
  return (
    <Tabs
      tabBar={wide ? (props) => <Sidebar {...props} /> : undefined}
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        headerStyle: { backgroundColor: BRAND },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <SyncBadge />,
        tabBarActiveTintColor: c.green,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: data.farm.name || 'Sürü', tabBarLabel: 'Panel', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="animals" options={{ title: 'Heyvanlar', tabBarIcon: icon('cow') }} />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Əlavə et',
          tabBarIcon: () => (
            <View style={{ backgroundColor: c.green, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}>
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
