import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../store/auth';
import { farmStore } from '../store/farmStore';
import { ToastProvider, useToast } from '../ui/feedback';
import { BRAND, useColors } from '../ui/theme';

/** Store xətalarını ekranda bildiriş kimi göstərir. */
function ErrorToasts() {
  const toast = useToast();
  useEffect(() => {
    const off = farmStore.onError(toast);
    return () => void off();
  }, [toast]);
  return null;
}

function RootStack() {
  const { session, ready } = useAuth();
  const c = useColors();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.green} size="large" />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: BRAND },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: c.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="animal/[id]" options={{ title: '' }} />
        <Stack.Screen name="animal/form" options={{ title: 'Heyvan' }} />
        <Stack.Screen name="meds" options={{ title: 'Dərman şkafı' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* myGov-dan qayıdış — sessiya hələ yoxdur, ona görə qorunmur */}
      <Stack.Screen name="mygov" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <ErrorToasts />
          <StatusBar style="light" />
          <RootStack />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
