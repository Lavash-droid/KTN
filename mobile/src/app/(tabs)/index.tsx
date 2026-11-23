import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SPECIES, SPECIES_KEYS } from '../../domain/constants';
import { daysBetween, fmt, todayISO } from '../../domain/dates';
import { animalLabel, events, homeAlerts, pendingBirths, pregnancy } from '../../domain/logic';
import { demoData } from '../../domain/transfer';
import { farmStore, useFarm } from '../../store/farmStore';
import { AlertBox, Card, Empty, List, ListItem, Muted, Screen, SectionHead } from '../../ui/components';
import { useToast } from '../../ui/feedback';
import { Icon, type IconName } from '../../ui/Icon';
import { useWide } from '../../ui/layout';
import { Logo } from '../../ui/Logo';
import { TreatmentSheet } from '../../ui/TreatmentSheet';
import { FONT, RADIUS, shadow, useColors } from '../../ui/theme';

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const DAYS = ['bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə'];

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Gecəniz xeyrə' : h < 12 ? 'Sabahınız xeyir' : h < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir';
}
const longDate = (d = new Date()) => `${d.getDate()} ${MONTHS[d.getMonth()]}, ${DAYS[d.getDay()]}`;

export default function Home() {
  const c = useColors();
  const toast = useToast();
  const { data, status } = useFarm();
  const wide = useWide();
  const [refreshing, setRefreshing] = useState(false);
  const [treat, setTreat] = useState(false);
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
        <Card style={{ alignItems: 'center', paddingVertical: 40, gap: 14 }}>
          <ActivityIndicator color={c.green} size="large" />
          <Muted center>Fermanızın məlumatı yüklənir…</Muted>
        </Card>
      </Screen>
    );
  }

  if (!data.animals.length) {
    return (
      <Screen refreshControl={refreshControl}>
        <View style={[{ backgroundColor: c.primaryDeep, borderRadius: 26, padding: 26, paddingTop: 30, overflow: 'hidden', alignItems: 'center' }, shadow(c, 2)]}>
          <HeroRings />
          <Logo size={68} light />
          <Text style={{ fontSize: 28, fontFamily: FONT.display, color: '#fff', marginTop: 18, textAlign: 'center', letterSpacing: -0.4 }}>Sürüyə xoş gəlmisiniz</Text>
          <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15.5, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 420 }}>
            Heyvanlarınızı, müalicələri, mayalanma və çəki qeydlərini bir yerdə aparın. İnternet olmadan da işləyir.
          </Text>
          <View style={{ gap: 10, marginTop: 24, alignSelf: 'stretch', maxWidth: 420, width: '100%', marginHorizontal: 'auto' }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/animal/form')}
              style={({ pressed }) => ({ paddingVertical: 14, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, opacity: pressed ? 0.9 : 1 })}
            >
              <Icon name="plus" size={20} color="#163f30" />
              <Text style={{ color: '#163f30', fontWeight: '700', fontSize: 16 }}>İlk heyvanı əlavə et</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                try {
                  await farmStore.replaceAll(demoData());
                  toast('Nümunə məlumat yükləndi');
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
              style={({ pressed }) => ({ paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', opacity: pressed ? 0.8 : 1 })}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Nümunə məlumatla bax</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {[
            { icon: 'pill' as const, t: 'Dərman qalığı', d: 'Ət və süd satışına icazə tarixi' },
            { icon: 'baby-bottle' as const, t: 'Doğum təqvimi', d: 'Mayalanmadan doğuma qədər' },
            { icon: 'wifi-off' as const, t: 'İnternetsiz', d: 'Kənddə də işləyir' },
          ].map((x) => (
            <Card key={x.t} style={{ flexGrow: 1, flexBasis: 200, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={x.icon} size={21} color={c.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: c.text, fontSize: 15 }}>{x.t}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>{x.d}</Text>
              </View>
            </Card>
          ))}
        </View>
      </Screen>
    );
  }

  const t = todayISO();
  const active = data.animals.filter((a) => a.status === 'aktiv');
  const counts = SPECIES_KEYS.map((k) => ({ k, n: active.filter((a) => a.species === k).length })).filter((x) => x.n);
  const pregnant = active.filter((a) => a.sex === 'd' && pregnancy(data, a.id).state === 'pregnant').length;
  const births30 = pendingBirths(data).filter((b) => daysBetween(t, b.expected) <= 30).length;
  const alerts = homeAlerts(data);
  const urgent = alerts.filter((a) => a.level !== 'info').length;
  const recent = events(data).slice(0, wide ? 8 : 5);

  return (
    <Screen refreshControl={refreshControl}>
      {/* Hero: ferma xülasəsi */}
      <View style={[{ backgroundColor: c.primaryDeep, borderRadius: 26, padding: wide ? 28 : 22, overflow: 'hidden' }, shadow(c, 2)]}>
        <HeroRings />
        <View style={wide ? { flexDirection: 'row', alignItems: 'flex-end', gap: 28 } : undefined}>
          <View style={{ flex: wide ? 1 : undefined }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5, fontWeight: '600', letterSpacing: 0.3 }}>{`${greeting()} · ${longDate()}`}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
              <Text style={{ color: '#fff', fontSize: 60, fontFamily: FONT.display, letterSpacing: -1.5, lineHeight: 66 }}>{active.length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: '500' }}>aktiv heyvan</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {counts.map((x) => (
                <Pressable
                  key={x.k}
                  onPress={() => router.push('/animals')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 99, paddingVertical: 6, paddingLeft: 9, paddingRight: 12 }}
                >
                  <Icon name={SPECIES[x.k].icon} size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{x.n}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>{SPECIES[x.k].label.toLocaleLowerCase('az')}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: wide ? 0 : 20, flex: wide ? 1 : undefined }}>
            <HeroStat value={pregnant} label="Boğaz" />
            <HeroStat value={births30} label="Yaxın doğum" />
            <HeroStat value={urgent} label="Diqqət" accent={urgent > 0} />
          </View>
        </View>
      </View>

      {/* Sürətli əməliyyatlar */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Quick icon="pill-multiple" label="Müalicə" onPress={() => setTreat(true)} />
        <Quick icon="scale-group" label="Çəki" onPress={() => router.push('/weigh')} />
        <Quick icon="milk" label="Süd" onPress={() => router.push('/milk')} />
        <Quick icon="feed" label="Yem" onPress={() => router.push('/feeds')} />
      </View>

      {/* Kompüterdə iki sütun: xəbərdarlıqlar | son qeydlər */}
      <View style={wide ? { flexDirection: 'row', gap: 24, alignItems: 'flex-start' } : undefined}>
        <View style={wide ? { flex: 1 } : undefined}>
          <SectionHead title="Diqqət tələb edir" />
          {alerts.length ? (
            <List>
              {alerts.map((a, i) => (
                <AlertBox key={a.key} grouped first={i === 0} level={a.level} icon={a.icon} title={a.title} subtitle={a.subtitle} onPress={() => router.push(a.href as Href)} />
              ))}
            </List>
          ) : (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check-circle" size={22} color={c.green} />
              </View>
              <Muted style={{ flex: 1 }}>Hər şey qaydasındadır. Yaxın günlərdə xatırlatma yoxdur.</Muted>
            </Card>
          )}
        </View>
        <View style={wide ? { flex: 1 } : undefined}>
          <SectionHead title="Son qeydlər" action="Heyvanlar" onAction={() => router.push('/animals')} />
          <List>
            {recent.length ? (
              recent.map((e, i) => {
                const a = data.animals.find((x) => x.id === e.animalId);
                return <ListItem key={e.kind + e.id} first={i === 0} icon={e.icon} title={animalLabel(a)} subtitle={`${e.title} · ${fmt(e.date)}`} onPress={() => router.push(`/animal/${e.animalId}`)} />;
              })
            ) : (
              <Empty icon="notebook">Hələ qeyd yoxdur</Empty>
            )}
          </List>
        </View>
      </View>
      <TreatmentSheet visible={treat} onClose={() => setTreat(false)} />
    </Screen>
  );
}

/** Hero kartının fonunda incə dairəvi naxış. */
function HeroRings() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', right: -120, top: -150 }}>
      <Svg width={340} height={340}>
        {[60, 100, 140, 170].map((r, i) => (
          <Circle key={r} cx={170} cy={170} r={r} stroke="#ffffff" strokeOpacity={0.07 + i * 0.012} strokeWidth={1.2} fill="none" />
        ))}
      </Svg>
    </View>
  );
}

function HeroStat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
      <Text style={{ color: accent ? '#f2cf8c' : '#fff', fontSize: 26, fontFamily: FONT.display, lineHeight: 30 }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS, backgroundColor: c.card,
          borderWidth: 1, borderColor: c.line, transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        shadow(c),
      ]}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={c.green} />
      </View>
      <Text style={{ color: c.text, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
