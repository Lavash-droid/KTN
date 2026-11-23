import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { SPECIES, SPECIES_KEYS } from '../../domain/constants';
import { fmt } from '../../domain/dates';
import { animalLabel, events, homeAlerts } from '../../domain/logic';
import { demoData } from '../../domain/transfer';
import { farmStore, useFarm } from '../../store/farmStore';
import { AlertBox, Btn, Card, Empty, H2, List, ListItem, Muted, Screen } from '../../ui/components';
import { useToast } from '../../ui/feedback';
import { RADIUS, useColors } from '../../ui/theme';

export default function Home() {
  const c = useColors();
  const toast = useToast();
  const { data, status } = useFarm();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await farmStore.sync();
    setRefreshing(false);
  };
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.green} colors={[c.green]} />;

  if (!data.animals.length) {
    return (
      <Screen refreshControl={refreshControl}>
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Text style={{ fontSize: 48 }}>🐄🐑</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, marginVertical: 8 }}>Sürüyə xoş gəlmisiniz!</Text>
          <Muted center>
            {status.loading ? 'Məlumat yüklənir…' : 'Heyvanlarınızı, müalicələri, mayalanma və çəki qeydlərini bir yerdə aparın. İnternet olmadan da işləyir.'}
          </Muted>
          <View style={{ gap: 8, marginTop: 16, alignSelf: 'stretch' }}>
            <Btn title="＋ İlk heyvanı əlavə et" onPress={() => router.push('/animal/form')} />
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
  const recent = events(data).slice(0, 5);

  return (
    <Screen refreshControl={refreshControl}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat value={active.length} label="Aktiv heyvan" primary />
        {counts.map((x) => (
          <Stat key={x.k} value={x.n} label={`${SPECIES[x.k].icon} ${SPECIES[x.k].label}`} />
        ))}
      </View>

      <H2>Diqqət tələb edir</H2>
      {alerts.length ? (
        alerts.map((a) => <AlertBox key={a.key} level={a.level} icon={a.icon} title={a.title} subtitle={a.subtitle} onPress={() => router.push(a.href as Href)} />)
      ) : (
        <Card>
          <Muted>Hər şey qaydasındadır 👍 Yaxın günlərdə xatırlatma yoxdur.</Muted>
        </Card>
      )}

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
    </Screen>
  );
}

function Stat({ value, label, primary }: { value: number; label: string; primary?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        flexGrow: 1, flexBasis: 130, padding: 12, paddingHorizontal: 14, borderRadius: RADIUS, borderWidth: 1,
        backgroundColor: primary ? c.green : c.card, borderColor: primary ? 'transparent' : c.line,
      }}
    >
      <Text style={{ fontSize: 26, fontWeight: '800', color: primary ? c.onGreen : c.text }}>{value}</Text>
      <Text style={{ fontSize: 13.5, color: primary ? c.onGreen : c.muted, opacity: primary ? 0.9 : 1 }}>{label}</Text>
    </View>
  );
}
