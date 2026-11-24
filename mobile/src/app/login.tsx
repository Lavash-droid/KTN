import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repo } from '../data';
import { mygovSupported, signInWithMygov, useMygovAvailability } from '../lib/mygov';
import { Btn, Card, Field, Muted, Segmented } from '../ui/components';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { FONT, useColors, useScheme } from '../ui/theme';

type Mode = 'login' | 'register';

export default function Login() {
  const c = useColors();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [mygovBusy, setMygovBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [mygovMsg, setMygovMsg] = useState<string | null>(null);
  const mygov = useMygovAvailability();

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
          <View style={{ alignItems: 'center' }}>
            <Logo size={68} />
          </View>
          <Text style={{ fontSize: 30, fontFamily: FONT.displayBold, textAlign: 'center', color: c.text, marginTop: 14, letterSpacing: -0.4 }}>Sürü</Text>
          <Muted center style={{ marginBottom: 24, marginTop: 4, paddingHorizontal: 12 }}>Fermanız cibinizdə — heyvan uçotu, müalicə, mayalanma və çəki qeydləri.</Muted>
          {mygovSupported && (
            <>
              <Card style={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="id-card" size={24} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontFamily: FONT.semibold, color: c.text }}>myGov ilə giriş</Text>
                    <Muted small>SİMA, ASAN İmza və ya dövlət hesabınızla — qeydiyyat və şifrə tələb olunmur.</Muted>
                  </View>
                </View>
                <Btn
                  title="myGov ilə daxil ol"
                  icon="shield-lock"
                  loading={mygovBusy || mygov === 'checking'}
                  disabled={mygov !== 'ready'}
                  style={{ marginTop: 16 }}
                  onPress={async () => {
                    setMygovBusy(true);
                    setMygovMsg(null);
                    try {
                      await signInWithMygov();
                    } catch (e) {
                      setMygovMsg((e as Error).message);
                    } finally {
                      setMygovBusy(false);
                    }
                  }}
                />
                {mygovMsg ? (
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.dangerSoft }}>
                    <Text style={{ color: c.danger, fontSize: 14 }}>{mygovMsg}</Text>
                  </View>
                ) : null}
                <Muted small style={{ marginTop: 10 }}>
                  {mygov === 'unavailable'
                    ? 'myGov girişi dövlət vahid giriş sistemi ilə inteqrasiya tamamlanandan sonra aktivləşəcək. Hələlik e-poçt ilə daxil olun.'
                    : 'EKTİS və AQTA-ya hesabatları tətbiqdən birbaşa göndərmək üçün myGov ilə daxil olun.'}
                </Muted>
              </Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
                <Text style={{ color: c.muted }}>və ya e-poçt ilə</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
              </View>
            </>
          )}
          <Card style={{ padding: 20 }}>
            <Segmented<Mode>
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
            {msg ? (
              <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: msg.error ? c.dangerSoft : c.okSoft }}>
                <Text style={{ color: msg.error ? c.danger : c.ok, fontSize: 14 }}>{msg.text}</Text>
              </View>
            ) : null}
            <Btn title={mode === 'login' ? 'Daxil ol' : 'Hesab yarat'} variant={mygov === 'ready' ? 'tonal' : 'primary'} onPress={submit} loading={busy} style={{ marginTop: 20 }} />
          </Card>
          <Muted small center style={{ marginTop: 16 }}>
            Məlumatlarınız buludda saxlanılır və bir neçə cihazdan istifadə edə bilərsiniz. İnternet olmayanda da işləyir — bağlantı bərpa olunanda sinxronlaşır.
          </Muted>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
