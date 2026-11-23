import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SPECIES, SPECIES_KEYS, STATUS } from '../../domain/constants';
import { age } from '../../domain/dates';
import { animalLabel, pregnancy, sexLabel, speciesOf, weightStats, withdrawal } from '../../domain/logic';
import type { SpeciesKey } from '../../domain/types';
import { farmStore, useFarm } from '../../store/farmStore';
import { Badge, Btn, ChipSelect, Empty, Field, IconTile, ListItem, Photo } from '../../ui/components';
import { TreatmentSheet } from '../../ui/TreatmentSheet';
import { useToast } from '../../ui/feedback';
import { useWide } from '../../ui/layout';
import { RADIUS, useColors } from '../../ui/theme';

type SpeciesFilter = 'all' | SpeciesKey;
type StatusFilter = 'aktiv' | 'all';

export default function Animals() {
  const c = useColors();
  const toast = useToast();
  const { data } = useFarm();
  const wide = useWide();
  const [q, setQ] = useState('');
  const [species, setSpecies] = useState<SpeciesFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('aktiv');
  const [groupOpen, setGroupOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.animals
      .filter((a) => species === 'all' || a.species === species)
      .filter((a) => status === 'all' || a.status === status)
      .filter((a) => !s || [a.tag, a.name, a.breed, a.group].some((v) => (v || '').toLowerCase().includes(s)))
      .sort((a, b) => a.tag.localeCompare(b.tag, 'az', { numeric: true }));
  }, [data.animals, q, species, status]);

  const header = (
    <View style={{ paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field value={q} onChangeText={setQ} placeholder="Bırka, ad və ya cins ilə axtar…" accessibilityLabel="Axtar" clearButtonMode="while-editing" autoCorrect={false} />
        </View>
        <Btn
          title="Qrup"
          icon="pill-multiple"
          variant="tonal"
          small
          style={{ paddingVertical: 12 }}
          onPress={() => (data.animals.some((a) => a.status === 'aktiv') ? setGroupOpen(true) : toast('Əvvəlcə heyvan əlavə edin'))}
        />
        <Btn
          title="Çəki"
          icon="weight"
          variant="tonal"
          small
          style={{ paddingVertical: 12 }}
          onPress={() => (data.animals.some((a) => a.status === 'aktiv') ? router.push('/weigh') : toast('Əvvəlcə heyvan əlavə edin'))}
        />
      </View>
      <View style={{ marginTop: 10 }}>
        <ChipSelect<SpeciesFilter>
          options={[{ value: 'all', label: 'Hamısı' }, ...SPECIES_KEYS.map((k) => ({ value: k, label: SPECIES[k].label, icon: SPECIES[k].icon }))]}
          value={species}
          onChange={setSpecies}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        <ChipSelect<StatusFilter> options={[{ value: 'aktiv', label: 'Aktiv' }, { value: 'all', label: 'Bütün statuslar' }]} value={status} onChange={setStatus} />
      </View>
      <Text style={{ color: c.muted, fontSize: 13.5, marginTop: 10 }}>{items.length} heyvan</Text>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{ padding: wide ? 28 : 16, paddingBottom: 40, width: '100%', maxWidth: wide ? 1100 : 760, alignSelf: 'center' }}
        data={items}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await farmStore.sync();
              setRefreshing(false);
            }}
            tintColor={c.green}
            colors={[c.green]}
          />
        }
        ListEmptyComponent={
          <View style={{ backgroundColor: c.card, borderRadius: RADIUS, borderWidth: 1, borderColor: c.line }}>
            <Empty>Heyvan tapılmadı. Yenisini "Əlavə et" ilə əlavə edin.</Empty>
          </View>
        }
        renderItem={({ item: a, index }) => {
          const w = withdrawal(data, a.id);
          const preg = pregnancy(data, a.id).state;
          const s = speciesOf(a);
          const last = index === items.length - 1;
          return (
            <View
              style={{
                backgroundColor: c.card, borderColor: c.line, borderLeftWidth: 1, borderRightWidth: 1,
                borderTopWidth: index === 0 ? 1 : 0, borderBottomWidth: last ? 1 : 0,
                borderTopLeftRadius: index === 0 ? RADIUS : 0, borderTopRightRadius: index === 0 ? RADIUS : 0,
                borderBottomLeftRadius: last ? RADIUS : 0, borderBottomRightRadius: last ? RADIUS : 0, overflow: 'hidden',
              }}
            >
              <ListItem
                first={index === 0}
                icon={<Photo src={a.photo} style={{ width: 38, height: 38, borderRadius: 19 }} fallback={<IconTile name={s.icon} />} />}
                title={animalLabel(a)}
                subtitle={`${a.breed || s.label} · ${sexLabel(a)}${a.dob ? ' · ' + age(a.dob) : ''}`}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    {wide && <WideCols group={a.group} weight={weightStats(data, a.id)?.last.kg} status={STATUS[a.status]} />}
                  <View style={{ gap: 4, alignItems: 'flex-end' }}>
                    {w && <Badge kind="danger">Dərman qalığı</Badge>}
                    {preg === 'pregnant' && <Badge kind="info">Boğaz</Badge>}
                    {preg === 'bred' && <Badge kind="info">Mayalanıb</Badge>}
                    {a.status !== 'aktiv' && <Badge kind="warn">{STATUS[a.status]}</Badge>}
                  </View>
                  </View>
                }
                onPress={() => router.push(`/animal/${a.id}`)}
              />
            </View>
          );
        }}
      />
      <TreatmentSheet visible={groupOpen} onClose={() => setGroupOpen(false)} />
    </>
  );
}

/** Kompüter ekranında siyahıya əlavə sütunlar: qrup, son çəki, status. */
function WideCols({ group, weight, status }: { group: string; weight?: number; status: string }) {
  const c = useColors();
  const col = (label: string, value: string, w: number) => (
    <View style={{ width: w }}>
      <Text style={{ color: c.muted, fontSize: 11.5 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={1}>{value}</Text>
    </View>
  );
  return (
    <>
      {col('Qrup', group || '—', 130)}
      {col('Son çəki', weight ? `${weight} kq` : '—', 90)}
      {col('Status', status, 80)}
    </>
  );
}
