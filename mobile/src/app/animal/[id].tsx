import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { OUTCOMES, STATUS } from '../../domain/constants';
import { addDays, age, daysBetween, fmt, inDays, todayISO } from '../../domain/dates';
import { animalLabel, events, sexLabel, speciesOf, weightStats, withdrawal, type AnimalEvent } from '../../domain/logic';
import type { Animal, BreedingMethod } from '../../domain/types';
import { uid } from '../../lib/id';
import { farmStore, useFarm } from '../../store/farmStore';
import { AlertBox, Btn, Card, ChipSelect, DateField, Field, Grid2, H2, IconTile, Muted, NumField, Photo, Row, Screen, Sheet, toNum } from '../../ui/components';
import { confirm, useToast } from '../../ui/feedback';
import { TreatmentSheet } from '../../ui/TreatmentSheet';
import { Icon } from '../../ui/Icon';
import { useColors } from '../../ui/theme';

type SheetKind = null | 'tr' | 'w' | 'b' | { outcome: string };

export default function AnimalDetail() {
  const c = useColors();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useFarm();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const a = data.animals.find((x) => x.id === id);

  if (!a) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tapılmadı' }} />
        <Card>
          <Muted>Bu heyvan tapılmadı.</Muted>
        </Card>
      </Screen>
    );
  }

  const s = speciesOf(a);
  const w = withdrawal(data, a.id);
  const ws = weightStats(data, a.id);
  const preg = data.breedings.filter((b) => b.animalId === a.id && !b.outcome).sort((x, y) => y.date.localeCompare(x.date))[0];
  const offspring = data.animals.filter((x) => x.damTag && x.damTag.toLowerCase() === a.tag.toLowerCase());
  const mother = a.damTag ? data.animals.find((x) => x.tag.toLowerCase() === a.damTag.toLowerCase()) : undefined;
  const list = events(data, a.id);

  const delEvent = async (e: AnimalEvent) => {
    if (!(await confirm('Bu qeyd silinsin?', `${e.title} · ${fmt(e.date)}`, 'Sil'))) return;
    farmStore.deleteEvent(e.kind, e.id);
  };

  const kv: [string, React.ReactNode][] = [
    ['Növ / cins', `${s.label}${a.breed ? ' · ' + a.breed : ''}`],
    ['Cinsiyyət', sexLabel(a)],
    ['Doğum tarixi', `${fmt(a.dob)}${a.dob ? ` (${age(a.dob)})` : ''}`],
    ['Ana', mother ? <Link key="m" onPress={() => router.push(`/animal/${mother.id}`)}>{a.damTag}</Link> : a.damTag || '—'],
    ['Qrup', a.group || '—'],
    ['Status', STATUS[a.status] ?? a.status],
    ['Son çəki', ws ? `${ws.last.kg} kq (${fmt(ws.last.date)})` : '—'],
  ];
  if (ws && ws.adg !== null) kv.push(['Orta gündəlik artım', `${ws.adg} q/gün`]);
  if (offspring.length) {
    kv.push([
      'Balaları',
      <Text key="o">
        {offspring.map((o, i) => (
          <Text key={o.id}>
            {i ? ', ' : ''}
            <Link onPress={() => router.push(`/animal/${o.id}`)}>{o.tag}</Link>
          </Text>
        ))}
      </Text>,
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: animalLabel(a) }} />
      <Card>
        {a.photo ? <Photo src={a.photo} style={{ width: '100%', height: 240, borderRadius: 12, marginBottom: 12, backgroundColor: c.greenSoft }} /> : null}
        <Row gap={12} style={{ alignItems: 'center', marginBottom: 10 }}>
          <IconTile name={s.icon} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{a.tag}</Text>
            {a.name ? <Muted>{a.name}</Muted> : null}
          </View>
          <Btn title="Redaktə" variant="ghost" small onPress={() => router.push({ pathname: '/animal/form', params: { id: a.id } })} />
        </Row>
        {w && (
          <AlertBox
            level="danger"
            icon="pill"
            title="Dərman qalığı dövrü"
            subtitle={`${w.meat ? 'Ət: ' + fmt(w.meat) + '-dək. ' : ''}${w.milk ? 'Süd: ' + fmt(w.milk) + '-dək. ' : ''}Bu müddətdə məhsulu satmayın.`}
          />
        )}
        {preg && <AlertBox level="info" icon="baby-bottle" title={`Gözlənilən doğum: ${fmt(preg.expected)}`} subtitle={inDays(daysBetween(todayISO(), preg.expected))} />}
        <View style={{ gap: 6 }}>
          {kv.map(([k, val]) => (
            <Row key={k} gap={14}>
              <Text style={{ color: c.muted, fontSize: 14, width: 150 }}>{k}</Text>
              {typeof val === 'string' ? <Text style={{ color: c.text, fontSize: 15, fontWeight: '500', flex: 1 }}>{val}</Text> : <View style={{ flex: 1 }}>{val}</View>}
            </Row>
          ))}
        </View>
        {a.notes ? <Muted small style={{ marginTop: 10 }}>{a.notes}</Muted> : null}
      </Card>

      <Row style={{ marginVertical: 12 }}>
        <Btn title="Müalicə" icon="pill" variant="tonal" vertical onPress={() => setSheet('tr')} style={{ flex: 1 }} />
        <Btn title="Çəki" icon="weight" variant="tonal" vertical onPress={() => setSheet('w')} style={{ flex: 1 }} />
        <Btn title="Mayalanma" icon="dna" variant="tonal" vertical onPress={() => setSheet('b')} disabled={a.sex !== 'd'} style={{ flex: 1 }} />
      </Row>

      <H2>Tarixçə</H2>
      <Card>
        {list.length ? (
          list.map((e, i) => (
            <Row key={e.kind + e.id} gap={10} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <IconTile name={e.icon} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: c.text, fontSize: 15 }}>{e.title}</Text>
                <Muted small>{`${fmt(e.date)}${e.subtitle ? ' · ' + e.subtitle : ''}`}</Muted>
                {e.openBreeding && <Btn title="Nəticəni qeyd et" variant="ghost" small style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => setSheet({ outcome: e.id })} />}
              </View>
              <Pressable onPress={() => delEvent(e)} hitSlop={10} accessibilityLabel="Qeydi sil">
                <Icon name="close" size={18} color={c.muted} />
              </Pressable>
            </Row>
          ))
        ) : (
          <Muted>Hələ qeyd yoxdur</Muted>
        )}
      </Card>

      <TreatmentSheet visible={sheet === 'tr'} onClose={() => setSheet(null)} animal={a} />
      <WeightSheet visible={sheet === 'w'} onClose={() => setSheet(null)} animal={a} />
      <BreedingSheet visible={sheet === 'b'} onClose={() => setSheet(null)} animal={a} />
      <OutcomeSheet breedingId={typeof sheet === 'object' && sheet ? sheet.outcome : null} onClose={() => setSheet(null)} animal={a} />
    </Screen>
  );
}

function Link({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  const c = useColors();
  return (
    <Text onPress={onPress} style={{ color: c.green, fontWeight: '600', fontSize: 15, textDecorationLine: 'underline' }}>
      {children}
    </Text>
  );
}

function WeightSheet({ visible, onClose, animal }: { visible: boolean; onClose: () => void; animal: Animal }) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [kg, setKg] = useState('');
  useEffect(() => {
    if (visible) {
      setDate(todayISO());
      setKg('');
    }
  }, [visible]);
  const submit = () => {
    const n = toNum(kg);
    if (!(n > 0)) return toast('Düzgün çəki daxil edin');
    farmStore.addWeight({ id: uid(), animalId: animal.id, date, kg: n });
    toast('Çəki qeyd olundu');
    onClose();
  };
  return (
    <Sheet visible={visible} icon="weight" title={`Çəki — ${animal.tag}`} onClose={onClose} onSubmit={submit}>
      <Grid2>
        <DateField label="Tarix" value={date} onChange={(v) => setDate(v ?? todayISO())} max={todayISO()} />
        <NumField label="Çəki (kq) *" value={kg} onChange={setKg} decimal />
      </Grid2>
    </Sheet>
  );
}

function BreedingSheet({ visible, onClose, animal }: { visible: boolean; onClose: () => void; animal: Animal }) {
  const toast = useToast();
  const s = speciesOf(animal);
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<BreedingMethod>('suni');
  const [sire, setSire] = useState('');
  useEffect(() => {
    if (visible) {
      setDate(todayISO());
      setMethod('suni');
      setSire('');
    }
  }, [visible]);
  const submit = () => {
    const expected = addDays(date, s.gest);
    farmStore.saveBreeding({ id: uid(), animalId: animal.id, date, method, sire: sire.trim(), expected, outcome: '' });
    toast(`Gözlənilən doğum: ${fmt(expected)}`);
    onClose();
  };
  return (
    <Sheet visible={visible} icon="dna" title={`Mayalanma — ${animal.tag}`} onClose={onClose} onSubmit={submit}>
      <DateField label="Tarix" value={date} onChange={(v) => setDate(v ?? todayISO())} max={todayISO()} />
      <ChipSelect<BreedingMethod> label="Üsul" options={[{ value: 'suni', label: 'Süni mayalanma' }, { value: 'tebii', label: 'Təbii cütləşmə' }]} value={method} onChange={setMethod} />
      <Field label="Ata (buğa/qoç, toxum kodu)" value={sire} onChangeText={setSire} autoCorrect={false} />
      <Muted small style={{ marginTop: 10 }}>
        {s.label} üçün boğazlıq müddəti ≈ {s.gest} gün. Gözlənilən doğum tarixi: {fmt(addDays(date, s.gest))}.
      </Muted>
    </Sheet>
  );
}

function OutcomeSheet({ breedingId, onClose, animal }: { breedingId: string | null; onClose: () => void; animal: Animal }) {
  const { data } = useFarm();
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [date, setDate] = useState(todayISO());
  useEffect(() => {
    if (breedingId) {
      setOutcome(OUTCOMES[0]);
      setDate(todayISO());
    }
  }, [breedingId]);
  const b = data.breedings.find((x) => x.id === breedingId);
  const submit = () => {
    if (!b) return onClose();
    farmStore.saveBreeding({ ...b, outcome: `${outcome} (${fmt(date)})` });
    onClose();
    if (outcome === 'Doğdu') {
      router.push({ pathname: '/animal/form', params: { species: animal.species, damTag: animal.tag, dob: date, breed: animal.breed } });
    }
  };
  return (
    <Sheet visible={!!breedingId} icon="baby-bottle" title={`Nəticə — ${animal.tag}`} onClose={onClose} onSubmit={submit}>
      <ChipSelect label="Nəticə" options={OUTCOMES.map((o) => ({ value: o, label: o }))} value={outcome} onChange={setOutcome} vertical />
      <DateField label="Tarix" value={date} onChange={(v) => setDate(v ?? todayISO())} max={todayISO()} />
      <Muted small style={{ marginTop: 10 }}>"Doğdu" seçsəniz, balanı ayrıca heyvan kimi əlavə etmək üçün forma açılacaq.</Muted>
    </Sheet>
  );
}
