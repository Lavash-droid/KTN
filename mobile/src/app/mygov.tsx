/** myGov girişindən qayıdış səhifəsi (veb: /mygov#token_hash=…, telefon: suru://mygov#…). */
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { completeMygovFromUrl } from '../lib/mygov';
import { Btn, Card, Muted } from '../ui/components';
import { useColors } from '../ui/theme';

export default function MygovReturn() {
  const c = useColors();
  const linkUrl = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = Platform.OS === 'web' ? window.location.href : linkUrl;
    if (!url) return;
    let alive = true;
    completeMygovFromUrl(url)
      .then(() => {
        if (Platform.OS === 'web') window.history.replaceState(null, '', '/mygov'); // tokeni ünvan sətrindən silirik
        if (alive) router.replace('/');
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [linkUrl]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: c.bg }}>
      {error ? (
        <Card style={{ width: '100%', maxWidth: 420, gap: 12 }}>
          <Muted>{error}</Muted>
          <Btn title="Girişə qayıt" onPress={() => router.replace('/login')} />
        </Card>
      ) : (
        <>
          <ActivityIndicator color={c.green} size="large" />
          <Muted style={{ marginTop: 12 }}>myGov ilə giriş tamamlanır…</Muted>
        </>
      )}
    </View>
  );
}
