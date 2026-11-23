import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SPECIES, SPECIES_KEYS, STATUS } from '../../domain/constants';
import { age } from '../../domain/dates';
import { animalLabel, pregnancy, sexLabel, speciesOf, weightStats, withdrawal } from '../../domain/logic';
import type { SpeciesKey } from '../../domain/types';
import { farmStore, useFarm } from '../../store/farmStore';
import { Badge, Btn, ChipSelect, Empty, Field, IconTile, ListItem, Muted, Photo, Sheet, SuggestField } from '../../ui/components';
import { Icon } from '../../ui/Icon';
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
  const [groupFilter, setGroupFilter] = useState('all');
  const [groupOpen, setGroupOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Toplu seçim rejimi: null — bağlı; Set — seçilmiş heyvanlar.
  const [sel, setSel] = useState<Set<string> | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  const groups = useMemo(
    () => [...new Set(data.animals.filter((a) => a.status === 'aktiv').map((a) => a.group.trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'az')),
    [data.animals],
  );
  useEffect(() => {
    if (groupFilter !== 'all' && groupFilter !== 'none' && !groups.includes(groupFilter)) setGroupFilter('all');
  }, [groups, groupFilter]);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.animals
      .filter((a) => species === 'all' || a.species === species)
      .filter((a) => status === 'all' || a.status === status)
      .filter((a) => groupFilter === 'all' || (groupFilter === 'none' ? !a.group.trim() : a.group.trim() === groupFilter))
      .filter((a) => !s || [a.tag, a.name, a.breed, a.group].some((v) => (v || '').toLowerCase().includes(s)))
      .sort((a, b) => a.tag.localeCompare(b.tag, 'az', { numeric: true }));
  }, [data.animals, q, species, status, groupFilter]);

  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p ?? []);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShown = !!sel && items.length > 0 && items.every((a) => sel.has(a.id));
  const selIds = sel ? [...sel].filter((id) => data.animals.some((a) => a.id === id)) : [];

  const btns = (
    <>
      <Btn
        title={sel ? 'Bitir' : 'Seç'}
        icon={sel ? 'close' : 'checkbox-on'}
        variant={sel ? 'primary' : 'tonal'}
        small
        style={wide ? { minHeight: 48 } : { flex: 1, minHeight: 42 }}
        onPress={() => (sel ? setSel(null) : items.length ? setSel(new Set()) : toast('Siyahıda heyvan yoxdur'))}
      />
      <Btn
        title="Qrup"
        icon="pill-multiple"
        variant="tonal"
        small
        style={wide ? { minHeight: 48 } : { flex: 1, minHeight: 42 }}
        onPress={() => (data.animals.some((a) => a.status === 'aktiv') ? setGroupOpen(true) : toast('Əvvəlcə heyvan əlavə edin'))}
      />
      <Btn
        title="Çəki"
        icon="weight"
        variant="tonal"
        small
        style={wide ? { minHeight: 48 } : { flex: 1, minHeight: 42 }}
        onPress={() => (data.animals.some((a) => a.status === 'aktiv') ? router.push('/weigh') : toast('Əvvəlcə heyvan əlavə edin'))}
      />
    </>
  );

  const header = (
    <View style={{ paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Field value={q} onChangeText={setQ} placeholder="Bırka, ad və ya cins ilə axtar…" accessibilityLabel="Axtar" clearButtonMode="while-editing" autoCorrect={false} style={{ paddingLeft: 42 }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 14 }}>
            <Icon name="search" size={20} color={c.faint} />
          </View>
        </View>
        {wide && btns}
      </View>
      {!wide && <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>{btns}</View>}
      <View style={{ marginTop: 14 }}>
        <ChipSelect<SpeciesFilter>
          scroll={!wide}
          options={[{ value: 'all', label: 'Hamısı' }, ...SPECIES_KEYS.map((k) => ({ value: k, label: SPECIES[k].label, icon: SPECIES[k].icon }))]}
          value={species}
          onChange={setSpecies}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        <ChipSelect<StatusFilter> scroll={!wide} options={[{ value: 'aktiv', label: 'Aktiv' }, { value: 'all', label: 'Bütün statuslar' }]} value={status} onChange={setStatus} />
      </View>
      {groups.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <ChipSelect
            scroll={!wide}
            options={[{ value: 'all', label: 'Bütün qruplar' }, ...groups.map((g) => ({ value: g, label: g, icon: 'group-move' as const })), { value: 'none', label: 'Qrupsuz' }]}
            value={groupFilter}
            onChange={setGroupFilter}
          />
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ color: c.muted, fontSize: 13.5 }}>{sel ? `${selIds.length} / ${items.length} seçilib` : `${items.length} heyvan`}</Text>
        {sel && items.length > 0 && (
          <Text
            accessibilityRole="button"
            onPress={() => setSel(allShown ? new Set() : new Set(items.map((a) => a.id)))}
            style={{ color: c.green, fontWeight: '600', fontSize: 14 }}
          >
            {allShown ? 'Seçimi təmizlə' : 'Hamısını seç'}
          </Text>
        )}
      </View>
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
          const badges = [
            w && <Badge key="w" kind="danger">Dərman qalığı</Badge>,
            preg === 'pregnant' && <Badge key="p" kind="info">Boğaz</Badge>,
            preg === 'bred' && <Badge key="b" kind="info">Mayalanıb</Badge>,
            a.status !== 'aktiv' && <Badge key="s" kind="warn">{STATUS[a.status]}</Badge>,
          ].filter(Boolean);
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
                chevron={!sel}
                icon={
                  sel ? (
                    <Icon name={sel.has(a.id) ? 'checkbox-on' : 'checkbox-off'} size={26} color={sel.has(a.id) ? c.green : c.muted} />
                  ) : (
                    <Photo src={a.photo} style={{ width: 38, height: 38, borderRadius: 19 }} fallback={<IconTile name={s.icon} />} />
                  )
                }
                title={animalLabel(a)}
                subtitle={`${a.breed || s.label} · ${sexLabel(a)}${a.dob ? ' · ' + age(a.dob) : ''}`}
                meta={wide || !badges.length ? undefined : badges}
                right={
                  wide ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <WideCols group={a.group} weight={weightStats(data, a.id)?.last.kg} status={STATUS[a.status]} />
                      <View style={{ gap: 4, alignItems: 'flex-end', width: 120 }}>{badges}</View>
                    </View>
                  ) : undefined
                }
                onPress={() => (sel ? toggle(a.id) : router.push(`/animal/${a.id}`))}
              />
            </View>
          );
        }}
      />
      {sel && (
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, paddingHorizontal: 16, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 15, flexGrow: 1 }}>{`${selIds.length} seçilib`}</Text>
          <Btn title="Qrupa köçür" icon="group-move" small disabled={!selIds.length} onPress={() => setMoveOpen(true)} />
          <Btn title="Müalicə" icon="pill-multiple" variant="tonal" small disabled={!selIds.length} onPress={() => setGroupOpen(true)} />
        </View>
      )}
      <TreatmentSheet visible={groupOpen} ids={sel && selIds.length ? selIds : undefined} onClose={() => setGroupOpen(false)} />
      <GroupSheet
        visible={moveOpen}
        ids={selIds}
        groups={groups}
        onClose={() => setMoveOpen(false)}
        onDone={() => {
          setMoveOpen(false);
          setSel(null);
        }}
      />
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

/** Seçilmiş heyvanları qrupa keçirir və ya qrupdan çıxarır. */
function GroupSheet({ visible, ids, groups, onClose, onDone }: { visible: boolean; ids: string[]; groups: string[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  useEffect(() => {
    if (visible) setName('');
  }, [visible]);
  const apply = (group: string) => {
    farmStore.assignGroup(ids, group);
    toast(group ? `${ids.length} heyvan "${group}" qrupuna keçirildi` : `${ids.length} heyvan qrupdan çıxarıldı`);
    onDone();
  };
  return (
    <Sheet
      visible={visible}
      icon="group-move"
      title={`Qrupa köçür — ${ids.length} heyvan`}
      onClose={onClose}
      submitLabel="Köçür"
      onSubmit={() => (name.trim() ? apply(name.trim()) : toast('Qrupun adını yazın və ya seçin'))}
    >
      <SuggestField label="Qrup" value={name} onChange={setName} suggestions={groups} placeholder="Məs: Sağmal, Buzovlar, Kökəltmə" />
      <Muted small style={{ marginTop: 8 }}>Mövcud qrupu seçin və ya yeni ad yazın. Qrup üzrə toplu müalicə və filtrləmə mümkündür.</Muted>
      <Btn title="Qrupdan çıxar" variant="ghost" small style={{ alignSelf: 'flex-start', marginTop: 12 }} onPress={() => apply('')} />
    </Sheet>
  );
}
