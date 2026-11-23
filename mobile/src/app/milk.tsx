import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { addDays, fmt, todayISO } from '../domain/dates';
import { expenseSummary, milkStats } from '../domain/logic';
import type { MilkRecord } from '../domain/types';
import { uid } from '../lib/id';
import { farmStore, useFarm } from '../store/farmStore';
import { Badge, Btn, Card, DateField, Empty, Field, Grid2, H2, List, ListItem, Muted, NumField, Screen, Sheet, SuggestField, toNum } from '../ui/components';
import { confirm, useToast } from '../ui/feedback';
import { azn } from '../ui/PurchaseSheet';
import { useColors } from '../ui/theme';

const PAGE = 40;

export default function Milk() {
  const c = useColors();
  const { data } = useFarm();
  const [editing, setEditing] = useState<MilkRecord | 'new' | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const s = milkStats(data, 30);
  const rev = expenseSummary(data, addDays(todayISO(), -29)).milkRevenue;
  const rows = useMemo(() => [...data.milkRecords].sort((a, b) => b.date.localeCompare(a.date)), [data.milkRecords]);

  const cell = (label: string, value: string, sub?: string) => (
    <View style={{ flexGrow: 1, flexBasis: 130, padding: 12, borderRadius: 12, backgroundColor: c.bg }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '700', marginTop: 2 }}>{value}</Text>
      {sub ? <Text style={{ color: c.muted, fontSize: 12.5 }}>{sub}</Text> : null}
    </View>
  );
  const num = (x: number) => x.toLocaleString('az-AZ', { maximumFractionDigits: 2 });

  return (
    <Screen>
      <Btn title="Süd qeydi əlavə et" icon="plus" onPress={() => setEditing('new')} />
      <H2>Son 30 gün</H2>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cell('Cəmi süd', `${num(s.liters)} l`, s.perDay !== null ? `gündə orta ${num(s.perDay)} l` : 'qeyd yoxdur')}
          {cell('Gəlir', azn(rev), 'qiyməti yazılanlar üzrə')}
          {cell('Yağ / zülal', s.fat !== null || s.protein !== null ? `${s.fat !== null ? num(s.fat) : '—'}% / ${s.protein !== null ? num(s.protein) : '—'}%` : '—', 'litrə görə orta')}
          {cell('SHS', s.scc !== null ? `${Math.round(s.scc / 1000)} min` : '—', 'somatik hüceyrə / ml')}
        </View>
        {s.scc !== null && s.scc > 400000 ? (
          <Muted small style={{ marginTop: 10, color: c.warn }}>Somatik hüceyrə sayı 400 mindən yüksəkdir — mastit üçün sürünü yoxlatmağınız tövsiyə olunur.</Muted>
        ) : null}
      </Card>

      <H2>Qeydlər</H2>
      <List>
        {rows.length ? (
          rows.slice(0, limit).map((r, i) => (
            <ListItem
              key={r.id}
              first={i === 0}
              icon="milk"
              title={`${fmt(r.date)} · ${num(r.liters)} l`}
              subtitle={[r.fat ? `yağ ${num(r.fat)}%` : '', r.protein ? `zülal ${num(r.protein)}%` : '', r.scc ? `SHS ${Math.round(r.scc / 1000)} min` : '', r.buyer].filter(Boolean).join(' · ') || undefined}
              right={r.price ? <Badge kind="info">{azn(Math.round(r.price * r.liters * 100) / 100)}</Badge> : undefined}
              onPress={() => setEditing(r)}
            />
          ))
        ) : (
          <Empty>Süd çəni qeydləri burada görünəcək: gündəlik və ya hər təhvildə litr, yağlılıq, zülal və alıcı. Laboratoriya nəticəsi yoxdursa yalnız litri yazın.</Empty>
        )}
      </List>
      {rows.length > limit && <Btn title="Daha çox göstər" variant="ghost" small style={{ marginTop: 10, alignSelf: 'center' }} onPress={() => setLimit(limit + PAGE)} />}
      <MilkSheet rec={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function MilkSheet({ rec, onClose }: { rec: MilkRecord | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const { data } = useFarm();
  const existing = rec && rec !== 'new' ? rec : null;
  const buyers = useMemo(() => [...new Set(data.milkRecords.map((m) => m.buyer).filter(Boolean))], [data.milkRecords]);
  const blank = { date: todayISO() as string | null, liters: '', fat: '', protein: '', scc: '', buyer: '', price: '', notes: '' };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!rec) return;
    if (existing) {
      const s = (n: number) => (n ? String(n) : '');
      setF({ date: existing.date, liters: String(existing.liters), fat: s(existing.fat), protein: s(existing.protein), scc: s(existing.scc), buyer: existing.buyer, price: s(existing.price), notes: existing.notes });
    } else {
      // Yeni qeyd: son alıcı və qiymət təklif olunur.
      const last = [...data.milkRecords].sort((a, b) => b.date.localeCompare(a.date))[0];
      setF({ ...blank, buyer: last?.buyer ?? '', price: last?.price ? String(last.price) : '' });
    }
  }, [rec]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const liters = toNum(f.liters);
    if (!(liters > 0)) return toast('Litri yazın');
    if (!f.date) return toast('Tarixi seçin');
    const fat = toNum(f.fat), protein = toNum(f.protein), scc = Math.round(toNum(f.scc));
    if (fat < 0 || fat > 15) return toast('Yağlılıq 0–15% arasında olmalıdır');
    if (protein < 0 || protein > 10) return toast('Zülal 0–10% arasında olmalıdır');
    farmStore.saveMilk({
      id: existing?.id ?? uid(), date: f.date, liters, fat, protein, scc: Math.max(0, scc),
      buyer: f.buyer.trim(), price: toNum(f.price), notes: f.notes.trim(),
    });
    toast('Yadda saxlanıldı');
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirm('Süd qeydi silinsin?', `${fmt(existing.date)} · ${existing.liters} l`, 'Sil'))) return;
    farmStore.deleteMilk(existing.id);
    onClose();
  };

  return (
    <Sheet visible={!!rec} icon="milk" title={existing ? 'Süd qeydi' : 'Yeni süd qeydi'} onClose={onClose} onSubmit={submit}>
      <Grid2>
        <DateField label="Tarix" value={f.date} onChange={(d) => set('date', d)} max={todayISO()} />
        <NumField label="Litr *" value={f.liters} onChange={(t) => set('liters', t)} decimal />
      </Grid2>
      <Grid2>
        <NumField label="Yağlılıq (%)" value={f.fat} onChange={(t) => set('fat', t)} decimal placeholder="3,6" />
        <NumField label="Zülal (%)" value={f.protein} onChange={(t) => set('protein', t)} decimal placeholder="3,2" />
      </Grid2>
      <NumField label="Somatik hüceyrə (hüceyrə/ml)" value={f.scc} onChange={(t) => set('scc', t)} placeholder="200000" />
      <SuggestField label="Alıcı" value={f.buyer} onChange={(t) => set('buyer', t)} suggestions={buyers} placeholder="Süd zavodu, toplayıcı…" />
      <NumField label="1 litrin qiyməti (₼)" value={f.price} onChange={(t) => set('price', t)} decimal placeholder="0,85" />
      <Field label="Qeyd" value={f.notes} onChangeText={(t) => set('notes', t)} />
      {existing && <Btn title="Qeydi sil" icon="trash" variant="danger" small onPress={remove} style={{ alignSelf: 'flex-start', marginTop: 14 }} />}
    </Sheet>
  );
}
