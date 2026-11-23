import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { FEED_UNITS, MED_UNITS } from '../domain/constants';
import { fmt, todayISO } from '../domain/dates';
import type { Feed, Med, Purchase, PurchaseKind } from '../domain/types';
import { uid } from '../lib/id';
import { farmStore, useFarm } from '../store/farmStore';
import { Badge, ChipSelect, DateField, Empty, Field, Grid2, List, ListItem, Muted, NumField, Sheet, SuggestField, toNum } from './components';
import { confirm, useToast } from './feedback';

const norm = (s: string) => s.trim().toLocaleLowerCase('az');
export const azn = (n: number) => `${n.toLocaleString('az-AZ', { maximumFractionDigits: 2 })} ₼`;

/**
 * Dərman və ya yem alışı. Maddə əvvəlcədən seçilə bilər (kartdan) və ya adla yazılır:
 * mövcud ada uyğun gəlirsə ona bağlanır, yoxdursa şkafa / anbara yeni maddə kimi əlavə olunur.
 */
export function PurchaseSheet({ kind, item, visible, onClose }: { kind: PurchaseKind; item?: Med | Feed | null; visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data } = useFarm();
  const items: (Med | Feed)[] = kind === 'med' ? data.meds : data.feeds;
  const units = kind === 'med' ? MED_UNITS : FEED_UNITS;
  const suppliers = useMemo(
    () => [...new Set(data.purchases.filter((p) => p.kind === kind && p.supplier).map((p) => p.supplier))],
    [data.purchases, kind],
  );
  const [f, setF] = useState({ name: '', unit: units[0], date: todayISO() as string | null, qty: '', price: '', supplier: '', batch: '', expiry: null as string | null, notes: '' });
  useEffect(() => {
    if (!visible) return;
    setF({ name: item?.name ?? '', unit: item?.unit ?? units[0], date: todayISO(), qty: '', price: '', supplier: '', batch: '', expiry: null, notes: '' });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const match = item ?? items.find((x) => norm(x.name) === norm(f.name));
  const unit = match?.unit ?? f.unit;

  const submit = () => {
    const name = (match?.name ?? f.name).trim();
    if (!name) return toast(kind === 'med' ? 'Dərmanın adını yazın' : 'Yemin adını yazın');
    const qty = toNum(f.qty);
    if (!(qty > 0)) return toast('Miqdarı yazın');
    if (!f.date) return toast('Tarixi seçin');
    let itemId = match?.id ?? null;
    if (!itemId) {
      itemId = uid();
      if (kind === 'med') farmStore.saveMed({ id: itemId, name, qty: 0, unit, minQty: 0, expiry: null, meatWd: 0, milkWd: 0, notes: '' });
      else farmStore.saveFeed({ id: itemId, name, qty: 0, unit, minQty: 0, notes: '' });
    }
    const p: Purchase = {
      id: uid(), kind, itemId, itemName: name, date: f.date, qty, unit, price: toNum(f.price),
      supplier: f.supplier.trim(), batch: kind === 'med' ? f.batch.trim() : '', expiry: kind === 'med' ? f.expiry : null, notes: f.notes.trim(),
    };
    farmStore.addPurchase(p);
    toast(match ? `Ehtiyat artdı: +${qty} ${unit}` : `${name} ${kind === 'med' ? 'şkafa' : 'anbara'} əlavə olundu`);
    onClose();
  };

  return (
    <Sheet visible={visible} icon="cart-in" title={item ? `Alış — ${item.name}` : kind === 'med' ? 'Dərman alışı' : 'Yem alışı'} onClose={onClose} onSubmit={submit} submitLabel="Qeyd et">
      {!item && (
        <>
          <SuggestField
            label={kind === 'med' ? 'Dərman *' : 'Yem *'}
            value={f.name}
            onChange={(t) => set('name', t)}
            suggestions={items.map((x) => x.name)}
            placeholder={kind === 'med' ? 'Məs: İvermektin 1%' : 'Məs: Arpa, qarğıdalı silosu'}
          />
          {f.name.trim() ? (
            <Muted small style={{ marginTop: 6 }}>
              {match ? `Mövcuddur: ${match.qty} ${match.unit} — ehtiyata əlavə olunacaq.` : `Yeni ${kind === 'med' ? 'dərman şkafa' : 'yem anbara'} əlavə olunacaq.`}
            </Muted>
          ) : null}
          {!match && <ChipSelect label="Vahid" options={units.map((u) => ({ value: u, label: u }))} value={f.unit} onChange={(u) => set('unit', u)} />}
        </>
      )}
      <Grid2>
        <NumField label={`Miqdar (${unit}) *`} value={f.qty} onChange={(t) => set('qty', t)} decimal />
        <NumField label="Ümumi məbləğ (₼)" value={f.price} onChange={(t) => set('price', t)} decimal placeholder="0" />
      </Grid2>
      <DateField label="Tarix" value={f.date} onChange={(d) => set('date', d)} max={todayISO()} />
      <SuggestField label="Təchizatçı" value={f.supplier} onChange={(t) => set('supplier', t)} suggestions={suppliers} placeholder={kind === 'med' ? 'Aptek, baytar, distribyutor' : 'Satıcı, kənd, şirkət'} />
      {kind === 'med' && (
        <Grid2>
          <Field label="Partiya (seriya) №" value={f.batch} onChangeText={(t) => set('batch', t)} />
          <DateField label="Son istifadə tarixi" value={f.expiry} onChange={(d) => set('expiry', d)} optional />
        </Grid2>
      )}
      <Field label="Qeyd" value={f.notes} onChangeText={(t) => set('notes', t)} />
    </Sheet>
  );
}

/** Alış tarixçəsi; sətrə toxunanda silmək təklif olunur (ehtiyatdan geri çıxılır). */
export function PurchaseHistory({ kind, itemId, limit = 20 }: { kind: PurchaseKind; itemId?: string; limit?: number }) {
  const { data } = useFarm();
  const toast = useToast();
  const rows = data.purchases
    .filter((p) => p.kind === kind && (!itemId || p.itemId === itemId))
    .sort((a, b) => b.date.localeCompare(a.date));
  const shown = rows.slice(0, limit);
  const remove = async (p: Purchase) => {
    if (!(await confirm('Alış qeydi silinsin?', `${p.itemName}: ${p.qty} ${p.unit} ehtiyatdan geri çıxılacaq.`, 'Sil'))) return;
    farmStore.deletePurchase(p.id);
    toast('Silindi');
  };
  return (
    <View>
      <List>
        {shown.length ? (
          shown.map((p, i) => (
            <ListItem
              key={p.id}
              first={i === 0}
              icon="receipt"
              chevron={false}
              title={`${itemId ? '' : p.itemName + ' · '}+${p.qty} ${p.unit}`}
              subtitle={[fmt(p.date), p.supplier, p.batch ? `partiya ${p.batch}` : '', p.expiry ? `son istifadə ${fmt(p.expiry)}` : ''].filter(Boolean).join(' · ')}
              right={p.price ? <Badge kind="info">{azn(p.price)}</Badge> : undefined}
              onPress={() => remove(p)}
            />
          ))
        ) : (
          <Empty>Hələ alış qeyd olunmayıb.</Empty>
        )}
      </List>
      {rows.length > limit ? <Muted small style={{ marginTop: 6 }}>{`Son ${limit} alış göstərilir (cəmi ${rows.length}). Hamısı — "Alış jurnalı (CSV)" hesabatında.`}</Muted> : null}
    </View>
  );
}
