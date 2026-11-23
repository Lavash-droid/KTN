import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '../data';
import { mygovEnabled, signInWithMygov } from '../lib/mygov';
import { Btn, Card, ChipSelect, Field, Muted } from '../ui/components';
import { useColors } from '../ui/theme';

type Mode = 'login' | 'register';

export default function Login() {
  const c = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mygovBusy, setMygovBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setMsg({ text: 'Düzgün e-poçt ünvanı daxil edin', error: true });
    if (password.length < 6) return setMsg({ text: 'Şifrə ən azı 6 simvol olmalıdır', error: true });
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'login') await repo.auth.signIn(e, password);
      else {
        const r = await repo.auth.signUp(e, password);
        if (r.needsConfirmation) {
          setMsg({ text: 'Hesab yaradıldı. E-poçtunuza göndərilən linklə təsdiqləyin, sonra daxil olun.', error: false });
          setMode('login');
        }
      }
    } catch (err) {
      setMsg({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Bu ekranda yaşıl başlıq yoxdur — status bar mətni fona uyğun olmalıdır (iOS). */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: insets.top + 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          <Text style={{ fontSize: 56, textAlign: 'center' }}>🐄🐑</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', textAlign: 'center', color: c.green, marginTop: 6 }}>Sürü</Text>
          <Muted center style={{ marginBottom: 20 }}>Fermanız cibinizdə — heyvan uçotu, müalicə, mayalanma və çəki qeydləri.</Muted>
          <Card>
            <ChipSelect<Mode>
              options={[{ value: 'login', label: 'Daxil ol' }, { value: 'register', label: 'Qeydiyyat' }]}
              value={mode}
              onChange={(m) => {
                setMode(m);
                setMsg(null);
              }}
            />
            <Field label="E-poçt" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="ad@numune.az" />
            <Field
              label="Şifrə"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
              onSubmitEditing={submit}
              placeholder="ən azı 6 simvol"
            />
            {msg ? <Text style={{ color: msg.error ? c.danger : c.green, marginTop: 12 }}>{msg.text}</Text> : null}
            <Btn title={mode === 'login' ? 'Daxil ol' : 'Hesab yarat'} onPress={submit} loading={busy} style={{ marginTop: 16 }} />
          </Card>
          {mygovEnabled && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
                <Text style={{ color: c.muted }}>və ya</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
              </View>
              <Btn
                title="myGov ilə daxil ol"
                icon="🇦🇿"
                variant="ghost"
                loading={mygovBusy}
                style={{ backgroundColor: c.card }}
                onPress={async () => {
                  setMygovBusy(true);
                  setMsg(null);
                  try {
                    await signInWithMygov();
                  } catch (e) {
                    setMsg({ text: (e as Error).message, error: true });
                  } finally {
                    setMygovBusy(false);
                  }
                }}
              />
              <Muted small center style={{ marginTop: 8 }}>SİMA, ASAN İmza və ya dövlət hesabınızla — qeydiyyat tələb olunmur.</Muted>
            </>
          )}
          <Muted small center style={{ marginTop: 16 }}>
            Məlumatlarınız buludda saxlanılır və bir neçə cihazdan istifadə edə bilərsiniz. İnternet olmayanda da işləyir — bağlantı bərpa olunanda sinxronlaşır.
          </Muted>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
