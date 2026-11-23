import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { SPECIES, SPECIES_KEYS } from '../../domain/constants';
import { fmt } from '../../domain/dates';
import { animalLabel, events, homeAlerts } from '../../domain/logic';
import { demoData } from '../../domain/transfer';
import { farmStore, useFarm } from '../../store/farmStore';
import { AlertBox, Btn, Card, Empty, H2, List, ListItem, Muted, Screen } from '../../ui/components';
import { useToast } from '../../ui/feedback';
import { Icon, type IconName } from '../../ui/Icon';
import { useWide } from '../../ui/layout';
import { Logo } from '../../ui/Logo';
import { RADIUS, useColors } from '../../ui/theme';

export default function Home() {
  const c = useColors();
  const toast = useToast();
  const { data, status } = useFarm();
  const wide = useWide();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await farmStore.sync();
    setRefreshing(false);
  };
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.green} colors={[c.green]} />;

  // Yeni cihazda ilk yükləmə: serverdə ferma ola bilər — "nümunə məlumat" düyməsi real məlumatı əvəz etməsin.
  if (!data.animals.length && status.loading) {
    return (
      <Screen refreshControl={refreshControl}>
        <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 12 }}>
          <ActivityIndicator color={c.green} size="large" />
          <Muted center>Fermanızın məlumatı yüklənir…</Muted>
        </Card>
      </Screen>
    );
  }

  if (!data.animals.length) {
    return (
      <Screen refreshControl={refreshControl}>
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Logo size={64} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, marginVertical: 8 }}>Sürüyə xoş gəlmisiniz!</Text>
          <Muted center>Heyvanlarınızı, müalicələri, mayalanma və çəki qeydlərini bir yerdə aparın. İnternet olmadan da işləyir.</Muted>
          <View style={{ gap: 8, marginTop: 16, alignSelf: 'stretch' }}>
            <Btn title="İlk heyvanı əlavə et" icon="plus" onPress={() => router.push('/animal/form')} />
            <Btn
              title="Nümunə məlumatla bax"
              variant="ghost"
              onPress={async () => {
                try {
                  await farmStore.replaceAll(demoData());
                  toast('Nümunə məlumat yükləndi');
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            />
          </View>
        </Card>
      </Screen>
    );
  }

  const active = data.animals.filter((a) => a.status === 'aktiv');
  const counts = SPECIES_KEYS.map((k) => ({ k, n: active.filter((a) => a.species === k).length })).filter((x) => x.n);
  const alerts = homeAlerts(data);
  const recent = events(data).slice(0, wide ? 8 : 5);

  return (
    <Screen refreshControl={refreshControl}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat value={active.length} label="Aktiv heyvan" primary />
        {counts.map((x) => (
          <Stat key={x.k} value={x.n} label={SPECIES[x.k].label} icon={SPECIES[x.k].icon} />
        ))}
      </View>

      {/* Kompüterdə iki sütun: xəbərdarlıqlar | son qeydlər */}
      <View style={wide ? { flexDirection: 'row', gap: 24, alignItems: 'flex-start' } : undefined}>
        <View style={wide ? { flex: 1 } : undefined}>
          <H2>Diqqət tələb edir</H2>
          {alerts.length ? (
            alerts.map((a) => <AlertBox key={a.key} level={a.level} icon={a.icon} title={a.title} subtitle={a.subtitle} onPress={() => router.push(a.href as Href)} />)
          ) : (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="check-circle" size={24} color={c.green} />
              <Muted style={{ flex: 1 }}>Hər şey qaydasındadır. Yaxın günlərdə xatırlatma yoxdur.</Muted>
            </Card>
          )}
        </View>
        <View style={wide ? { flex: 1 } : undefined}>
          <H2>Son qeydlər</H2>
          <List>
            {recent.length ? (
              recent.map((e, i) => {
                const a = data.animals.find((x) => x.id === e.animalId);
                return <ListItem key={e.kind + e.id} first={i === 0} icon={e.icon} title={animalLabel(a)} subtitle={`${e.title} · ${fmt(e.date)}`} onPress={() => router.push(`/animal/${e.animalId}`)} />;
              })
            ) : (
              <Empty>Hələ qeyd yoxdur</Empty>
            )}
          </List>
        </View>
      </View>
    </Screen>
  );
}

function Stat({ value, label, primary, icon }: { value: number; label: string; primary?: boolean; icon?: IconName }) {
  const c = useColors();
  return (
    <View
      style={{
        flexGrow: 1, flexBasis: 130, padding: 12, paddingHorizontal: 14, borderRadius: RADIUS, borderWidth: 1,
        backgroundColor: primary ? c.green : c.card, borderColor: primary ? 'transparent' : c.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: primary ? c.onGreen : c.text }}>{value}</Text>
        {icon ? <Icon name={icon} size={26} color={c.green} /> : null}
      </View>
      <Text style={{ fontSize: 13.5, color: primary ? c.onGreen : c.muted, opacity: primary ? 0.9 : 1 }}>{label}</Text>
    </View>
  );
}
