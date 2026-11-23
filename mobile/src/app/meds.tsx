import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MED_UNITS } from '../domain/constants';
import { fmt } from '../domain/dates';
import { findMed, medStatus } from '../domain/logic';
import type { Med } from '../domain/types';
import { uid } from '../lib/id';
import { farmStore, useFarm } from '../store/farmStore';
import { Badge, Btn, ChipSelect, DateField, Empty, Field, Grid2, H2, List, ListItem, Muted, NumField, Row, Screen, Sheet, toNum } from '../ui/components';
import { confirm, useToast } from '../ui/feedback';
import { PurchaseHistory, PurchaseSheet } from '../ui/PurchaseSheet';

export default function Meds() {
  const { data } = useFarm();
  const [editing, setEditing] = useState<Med | 'new' | null>(null);
  // Alış: null — bağlı; 'any' — ad yazılır; Med — kartdan seçilmiş dərman.
  const [buying, setBuying] = useState<Med | 'any' | null>(null);
  const items = [...data.meds].sort((a, b) => a.name.localeCompare(b.name, 'az'));

  return (
    <Screen>
      <Row>
        <Btn title="Alış qeyd et" icon="cart-in" onPress={() => setBuying('any')} style={{ flex: 1 }} />
        <Btn title="Yeni dərman" icon="plus" variant="tonal" onPress={() => setEditing('new')} style={{ flex: 1 }} />
      </Row>
      <View style={{ marginTop: 12 }}>
        <List>
          {items.length ? (
            items.map((m, i) => {
              const wd = [m.meatWd ? `ət ${m.meatWd} gün` : '', m.milkWd ? `süd ${m.milkWd} gün` : ''].filter(Boolean).join(', ');
              const s = medStatus(m);
              return (
                <ListItem
                  key={m.id}
                  first={i === 0}
                  icon="pill"
                  title={m.name}
                  subtitle={`${m.qty} ${m.unit}${m.expiry ? ' · son istifadə ' + fmt(m.expiry) : ''}${wd ? ' · qalıq: ' + wd : ''}`}
                  right={
                    <View style={{ gap: 4, alignItems: 'flex-end' }}>
                      {s.expired && <Badge kind="danger">Vaxtı keçib</Badge>}
                      {s.soon && <Badge kind="warn">Vaxtı bitir</Badge>}
                      {s.low && <Badge kind="warn">Az qalıb</Badge>}
                    </View>
                  }
                  onPress={() => setEditing(m)}
                />
              );
            })
          ) : (
            <Empty>Şkaf boşdur. Fermadakı dərman və peyvəndləri əlavə edin — müalicə yazanda qalıq müddətləri avtomatik dolacaq, ehtiyat azalacaq.</Empty>
          )}
        </List>
      </View>
      <Muted small style={{ marginTop: 14 }}>
        Son istifadə tarixi 30 gündən az qalan, vaxtı keçən və minimum miqdardan az qalan dərmanlar paneldə göstərilir. Alış qeyd edəndə ehtiyat artır, son istifadə tarixi yenilənir.
      </Muted>
      <H2>Son alışlar</H2>
      <PurchaseHistory kind="med" limit={15} />
      <MedSheet
        med={editing}
        onClose={() => setEditing(null)}
        onBuy={(m) => {
          setEditing(null);
          setBuying(m);
        }}
      />
      <PurchaseSheet kind="med" item={buying && buying !== 'any' ? buying : null} visible={!!buying} onClose={() => setBuying(null)} />
    </Screen>
  );
}

function MedSheet({ med, onClose, onBuy }: { med: Med | 'new' | null; onClose: () => void; onBuy: (m: Med) => void }) {
  const toast = useToast();
  const { data } = useFarm();
  const existing = med && med !== 'new' ? med : null;
  const [f, setF] = useState({ name: '', qty: '0', unit: 'ml', minQty: '0', expiry: null as string | null, meatWd: '0', milkWd: '0', notes: '' });
  useEffect(() => {
    if (!med) return;
    const m = existing;
    setF({
      name: m?.name ?? '', qty: String(m?.qty ?? 0), unit: m?.unit ?? 'ml', minQty: String(m?.minQty ?? 0), expiry: m?.expiry ?? null,
      meatWd: String(m?.meatWd ?? 0), milkWd: String(m?.milkWd ?? 0), notes: m?.notes ?? '',
    });
  }, [med]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const name = f.name.trim();
    if (!name) return toast('Dərmanın adını yazın');
    const dup = findMed(data.meds, name);
    if (dup && dup.id !== existing?.id) return toast('Bu adda dərman artıq var');
    farmStore.saveMed({
      id: existing?.id ?? uid(), name, qty: toNum(f.qty), unit: f.unit, minQty: toNum(f.minQty), expiry: f.expiry,
      meatWd: toNum(f.meatWd), milkWd: toNum(f.milkWd), notes: f.notes.trim(),
    });
    toast('Yadda saxlanıldı');
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirm(`${existing.name} şkafdan silinsin?`, 'Keçmiş müalicə qeydləri qalacaq.', 'Sil'))) return;
    farmStore.deleteMed(existing.id);
    onClose();
  };

  const units = MED_UNITS.includes(f.unit) ? MED_UNITS : [...MED_UNITS, f.unit];
  return (
    <Sheet visible={!!med} icon="medical-bag" title={existing ? existing.name : 'Yeni dərman'} onClose={onClose} onSubmit={submit}>
      <Field label="Ad *" value={f.name} onChangeText={(t) => set('name', t)} placeholder="Məs: İvermektin 1%" />
      <NumField label="Ehtiyat" value={f.qty} onChange={(t) => set('qty', t)} decimal />
      <ChipSelect label="Vahid" options={units.map((u) => ({ value: u, label: u }))} value={f.unit} onChange={(u) => set('unit', u)} />
      <Grid2>
        <NumField label="Minimum (xəbərdarlıq)" value={f.minQty} onChange={(t) => set('minQty', t)} decimal />
        <DateField label="Son istifadə tarixi" value={f.expiry} onChange={(d) => set('expiry', d)} optional />
      </Grid2>
      <Grid2>
        <NumField label="Ət qalığı (gün)" value={f.meatWd} onChange={(t) => set('meatWd', t)} />
        <NumField label="Süd qalığı (gün)" value={f.milkWd} onChange={(t) => set('milkWd', t)} />
      </Grid2>
      <Field label="Qeyd" value={f.notes} onChangeText={(t) => set('notes', t)} placeholder="Partiya nömrəsi, saxlama şəraiti…" />
      {existing && (
        <>
          <LastPurchase med={existing} />
          <Row style={{ marginTop: 14 }}>
            <Btn title="Alış qeyd et" icon="cart-in" variant="tonal" small onPress={() => onBuy(existing)} />
            <Btn title="Dərmanı sil" icon="trash" variant="danger" small onPress={remove} />
          </Row>
        </>
      )}
    </Sheet>
  );
}

function LastPurchase({ med }: { med: Med }) {
  const { data } = useFarm();
  const ps = data.purchases.filter((p) => p.kind === 'med' && p.itemId === med.id).sort((a, b) => b.date.localeCompare(a.date));
  if (!ps.length) return null;
  const p = ps[0];
  return (
    <Muted small style={{ marginTop: 12 }}>
      {`Son alış: ${fmt(p.date)} · +${p.qty} ${p.unit}${p.supplier ? ' · ' + p.supplier : ''}${p.batch ? ' · partiya ' + p.batch : ''}${ps.length > 1 ? ` (cəmi ${ps.length} alış)` : ''}`}
    </Muted>
  );
}
