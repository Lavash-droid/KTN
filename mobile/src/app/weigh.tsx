/**
 * Toplu çəki seansı — tərəzinin yanında heyvanları bir-bir çəkib yazmaq üçün.
 * Ən çox istifadə olunan funksiya (çəki qeydiyyatı) olduğu üçün minimum toxunuşla işləyir:
 * çəkini yazın → Enter → növbəti heyvan. Yalnız doldurulmuş sətirlər yadda saxlanılır.
 */
import { router, Stack } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, View } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { SPECIES, SPECIES_KEYS } from '../domain/constants';
import { daysBetween, fmt, todayISO } from '../domain/dates';
import { animalLabel, speciesOf, weightStats } from '../domain/logic';
import type { SpeciesKey, Weight } from '../domain/types';
import { uid } from '../lib/id';
import { farmStore, useFarm } from '../store/farmStore';
import { Btn, ChipSelect, DateField, Empty, IconTile, Muted, toNum } from '../ui/components';
import { confirm, useToast } from '../ui/feedback';
import { useWide } from '../ui/layout';
import { RADIUS, useColors } from '../ui/theme';

type SpeciesFilter = 'all' | SpeciesKey;

export default function Weigh() {
  const c = useColors();
  const toast = useToast();
  const wide = useWide();
  const { data } = useFarm();
  const [date, setDate] = useState<string>(todayISO());
  const [species, setSpecies] = useState<SpeciesFilter>('all');
  const [group, setGroup] = useState('all');
  const [kg, setKg] = useState<Record<string, string>>({});
  const inputs = useRef<Record<string, ComponentRef<typeof TextInput> | null>>({});

  const active = useMemo(() => data.animals.filter((a) => a.status === 'aktiv'), [data.animals]);
  const groups = useMemo(() => [...new Set(active.map((a) => a.group.trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'az')), [active]);
  const list = useMemo(
    () =>
      active
        .filter((a) => species === 'all' || a.species === species)
        .filter((a) => group === 'all' || a.group.trim() === group)
        .sort((a, b) => a.tag.localeCompare(b.tag, 'az', { numeric: true })),
    [active, species, group],
  );
  const filled = list.filter((a) => toNum(kg[a.id] ?? '') > 0);

  const save = async () => {
    if (!filled.length) return toast('Heç bir çəki yazılmayıb');
    const rows: Weight[] = filled.map((a) => ({ id: uid(), animalId: a.id, date, kg: toNum(kg[a.id]) }));
    farmStore.addWeights(rows);
    toast(`${rows.length} heyvanın çəkisi qeyd olundu`);
    setKg({});
    router.back();
  };

  const leave = async () => {
    if (filled.length && !(await confirm('Yazılmış çəkilər yadda saxlanmayıb', `${filled.length} heyvan. Çıxılsın?`, 'Çıx'))) return;
    router.back();
  };

  const focusNext = (i: number) => {
    const next = list[i + 1];
    if (next) inputs.current[next.id]?.focus();
  };

  const header = (
    <View style={{ gap: 4, paddingBottom: 10 }}>
      <Muted small>Çəkini yazın və Enter basın — növbəti heyvana keçir. Yalnız doldurulmuş sətirlər yadda saxlanılır.</Muted>
      <View style={{ maxWidth: 260 }}>
        <DateField label="Çəki tarixi" value={date} onChange={(v) => setDate(v ?? todayISO())} max={todayISO()} />
      </View>
      <ChipSelect<SpeciesFilter>
        label="Növ"
        options={[{ value: 'all', label: 'Hamısı' }, ...SPECIES_KEYS.filter((k) => active.some((a) => a.species === k)).map((k) => ({ value: k, label: SPECIES[k].label, icon: SPECIES[k].icon }))]}
        value={species}
        onChange={setSpecies}
      />
      {groups.length > 0 && (
        <ChipSelect label="Qrup" options={[{ value: 'all', label: 'Bütün qruplar' }, ...groups.map((g) => ({ value: g, label: g }))]} value={group} onChange={setGroup} />
      )}
      <Text style={{ color: c.muted, fontSize: 13.5, marginTop: 8 }}>{`${list.length} heyvan · ${filled.length} çəki yazılıb`}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: 'Toplu çəki' }} />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: wide ? 28 : 16, paddingBottom: 24, width: '100%', maxWidth: wide ? 900 : 760, alignSelf: 'center' }}
        data={list}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Empty>Bu filtrə uyğun aktiv heyvan yoxdur.</Empty>}
        renderItem={({ item: a, index }) => {
          const ws = weightStats(data, a.id);
          const val = toNum(kg[a.id] ?? '');
          const diff = ws && val > 0 ? Math.round((val - ws.last.kg) * 10) / 10 : null;
          const days = ws ? daysBetween(ws.last.date, date) : 0;
          const adg = diff !== null && days > 0 ? Math.round((diff / days) * 1000) : null;
          const first = index === 0;
          const last = index === list.length - 1;
          return (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: c.card,
                borderColor: c.divider, borderTopWidth: first ? 0 : 1,
                borderTopLeftRadius: first ? RADIUS : 0, borderTopRightRadius: first ? RADIUS : 0, borderBottomLeftRadius: last ? RADIUS : 0, borderBottomRightRadius: last ? RADIUS : 0,
              }}
            >
              <IconTile name={speciesOf(a).icon} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '600', color: c.text, fontSize: 15 }} numberOfLines={1}>{animalLabel(a)}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }} numberOfLines={1}>
                  {ws ? `Son: ${ws.last.kg} kq · ${fmt(ws.last.date)}` : 'Əvvəlki çəki yoxdur'}
                  {diff !== null ? ` · ${diff >= 0 ? '+' : ''}${diff} kq${adg !== null ? ` (${adg} q/gün)` : ''}` : ''}
                </Text>
              </View>
              <TextInput
                ref={(r) => {
                  inputs.current[a.id] = r;
                }}
                value={kg[a.id] ?? ''}
                onChangeText={(t) => setKg((p) => ({ ...p, [a.id]: t.replace(',', '.').replace(/[^0-9.]/g, '') }))}
                keyboardType="decimal-pad"
                returnKeyType={last ? 'done' : 'next'}
                onSubmitEditing={() => focusNext(index)}
                blurOnSubmit={last}
                placeholder="kq"
                placeholderTextColor={c.muted}
                accessibilityLabel={`${a.tag} çəkisi`}
                style={{
                  width: 96, textAlign: 'right', fontSize: 17, fontWeight: '600', color: c.text, paddingHorizontal: 10, paddingVertical: 9,
                  borderRadius: 10, borderWidth: 1, borderColor: val > 0 ? c.accent : c.line, backgroundColor: val > 0 ? c.accentSoft : c.card,
                }}
              />
            </View>
          );
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.card }}>
        <View style={{ flexDirection: 'row', gap: 8, width: '100%', maxWidth: 900, alignSelf: 'center', marginHorizontal: 'auto' }}>
          <Btn title="Ləğv et" variant="ghost" onPress={leave} style={{ flex: 1 }} />
          <Btn title={filled.length ? `Yadda saxla (${filled.length})` : 'Yadda saxla'} icon="check" onPress={save} disabled={!filled.length} style={{ flex: 2 }} />
        </View>
      </View>
    </View>
  );
}
