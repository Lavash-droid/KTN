import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { FEED_UNITS } from '../domain/constants';
import { todayISO } from '../domain/dates';
import { expenseSummary, feedLow } from '../domain/logic';
import type { Feed } from '../domain/types';
import { uid } from '../lib/id';
import { farmStore, useFarm } from '../store/farmStore';
import { Badge, Btn, ChipSelect, Empty, Field, Grid2, H2, List, ListItem, Muted, NumField, Row, Screen, Sheet, toNum } from '../ui/components';
import { confirm, useToast } from '../ui/feedback';
import { azn, PurchaseHistory, PurchaseSheet } from '../ui/PurchaseSheet';

const norm = (s: string) => s.trim().toLocaleLowerCase('az');

export default function Feeds() {
  const { data } = useFarm();
  const [editing, setEditing] = useState<Feed | 'new' | null>(null);
  const [buying, setBuying] = useState<Feed | 'any' | null>(null);
  const [using, setUsing] = useState<Feed | null>(null);
  const items = [...data.feeds].sort((a, b) => a.name.localeCompare(b.name, 'az'));
  const year = todayISO().slice(0, 4);
  const spent = expenseSummary(data, `${year}-01-01`).feeds;

  return (
    <Screen>
      <Row>
        <Btn title="Alış qeyd et" icon="cart-in" onPress={() => setBuying('any')} style={{ flex: 1 }} />
        <Btn title="Yeni yem" icon="plus" variant="tonal" onPress={() => setEditing('new')} style={{ flex: 1 }} />
      </Row>
      <View style={{ marginTop: 12 }}>
        <List>
          {items.length ? (
            items.map((f, i) => (
              <ListItem
                key={f.id}
                first={i === 0}
                icon="feed"
                title={f.name}
                subtitle={`${f.qty} ${f.unit}${f.minQty ? ` · minimum ${f.minQty}` : ''}${f.notes ? ' · ' + f.notes : ''}`}
                right={feedLow(f) ? <Badge kind="warn">Az qalıb</Badge> : undefined}
                onPress={() => setEditing(f)}
              />
            ))
          ) : (
            <Empty>Anbar boşdur. Silos, arpa, yonca, qarışıq yem kimi ehtiyatları əlavə edin — alış ehtiyatı artırır, sərf azaldır, minimumdan aşağı düşəndə paneldə xəbərdarlıq çıxır.</Empty>
          )}
        </List>
      </View>
      <H2>{`Yem alışları — ${year}`}</H2>
      <Muted small style={{ marginBottom: 8 }}>{`Bu il yemə xərc: ${azn(spent)}`}</Muted>
      <PurchaseHistory kind="feed" limit={15} />

      <FeedSheet
        feed={editing}
        onClose={() => setEditing(null)}
        onBuy={(f) => {
          setEditing(null);
          setBuying(f);
        }}
        onUse={(f) => {
          setEditing(null);
          setUsing(f);
        }}
      />
      <PurchaseSheet kind="feed" item={buying && buying !== 'any' ? buying : null} visible={!!buying} onClose={() => setBuying(null)} />
      <UseSheet feed={using} onClose={() => setUsing(null)} />
    </Screen>
  );
}

function FeedSheet({ feed, onClose, onBuy, onUse }: { feed: Feed | 'new' | null; onClose: () => void; onBuy: (f: Feed) => void; onUse: (f: Feed) => void }) {
  const toast = useToast();
  const { data } = useFarm();
  const existing = feed && feed !== 'new' ? feed : null;
  const [f, setF] = useState({ name: '', qty: '0', unit: 'kq', minQty: '0', notes: '' });
  useEffect(() => {
    if (!feed) return;
    setF({ name: existing?.name ?? '', qty: String(existing?.qty ?? 0), unit: existing?.unit ?? 'kq', minQty: String(existing?.minQty ?? 0), notes: existing?.notes ?? '' });
  }, [feed]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const name = f.name.trim();
    if (!name) return toast('Yemin adını yazın');
    const dup = data.feeds.find((x) => norm(x.name) === norm(name));
    if (dup && dup.id !== existing?.id) return toast('Bu adda yem artıq var');
    farmStore.saveFeed({ id: existing?.id ?? uid(), name, qty: toNum(f.qty), unit: f.unit, minQty: toNum(f.minQty), notes: f.notes.trim() });
    toast('Yadda saxlanıldı');
    onClose();
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirm(`${existing.name} anbardan silinsin?`, 'Alış tarixçəsi və xərclər qalacaq.', 'Sil'))) return;
    farmStore.deleteFeed(existing.id);
    onClose();
  };

  const units = FEED_UNITS.includes(f.unit) ? FEED_UNITS : [...FEED_UNITS, f.unit];
  return (
    <Sheet visible={!!feed} icon="feed" title={existing ? existing.name : 'Yeni yem'} onClose={onClose} onSubmit={submit}>
      <Field label="Ad *" value={f.name} onChangeText={(t) => set('name', t)} placeholder="Məs: Qarğıdalı silosu" />
      <ChipSelect label="Vahid" options={units.map((u) => ({ value: u, label: u }))} value={f.unit} onChange={(u) => set('unit', u)} />
      <Grid2>
        <NumField label="Ehtiyat" value={f.qty} onChange={(t) => set('qty', t)} decimal />
        <NumField label="Minimum (xəbərdarlıq)" value={f.minQty} onChange={(t) => set('minQty', t)} decimal />
      </Grid2>
      <Field label="Qeyd" value={f.notes} onChangeText={(t) => set('notes', t)} placeholder="Saxlama yeri, keyfiyyət…" />
      {existing && (
        <Row style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <Btn title="Alış" icon="cart-in" variant="tonal" small onPress={() => onBuy(existing)} />
          <Btn title="Sərf" icon="minus" variant="tonal" small onPress={() => onUse(existing)} />
          <Btn title="Sil" icon="trash" variant="danger" small onPress={remove} />
        </Row>
      )}
    </Sheet>
  );
}

/** Yem sərfi — anbardan çıxılır. */
function UseSheet({ feed, onClose }: { feed: Feed | null; onClose: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  useEffect(() => setAmount(''), [feed]);
  const submit = () => {
    if (!feed) return;
    const n = toNum(amount);
    if (!(n > 0)) return toast('Miqdarı yazın');
    farmStore.useFeed(feed.id, n);
    const left = Math.max(0, Math.round((feed.qty - n) * 100) / 100);
    toast(`Qaldı: ${left} ${feed.unit}`);
    onClose();
  };
  return (
    <Sheet visible={!!feed} icon="minus" title={feed ? `Sərf — ${feed.name}` : ''} onClose={onClose} onSubmit={submit} submitLabel="Çıx">
      <Muted small style={{ marginTop: 6 }}>{feed ? `Anbarda: ${feed.qty} ${feed.unit}` : ''}</Muted>
      <NumField label={`Sərf olunan miqdar (${feed?.unit ?? ''})`} value={amount} onChange={setAmount} decimal />
    </Sheet>
  );
}
