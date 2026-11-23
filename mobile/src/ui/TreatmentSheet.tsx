/** Müalicə formu: tək heyvan və ya qrup (bütün sürü / növ / qrup). Dərman şkafı ilə bağlıdır. */
import { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { SPECIES, SPECIES_KEYS } from '../domain/constants';
import { fmt, todayISO } from '../domain/dates';
import { findMed, medStatus } from '../domain/logic';
import type { Animal, Treatment } from '../domain/types';
import { uid } from '../lib/id';
import { farmStore, useFarm } from '../store/farmStore';
import { ChipSelect, DateField, Field, Grid2, Muted, NumField, Sheet, SuggestField, toNum, type Option } from './components';
import { useToast } from './feedback';
import { useColors } from './theme';

export function TreatmentSheet({ visible, onClose, animal }: { visible: boolean; onClose: () => void; animal?: Animal }) {
  const c = useColors();
  const toast = useToast();
  const { data } = useFarm();
  const group = !animal;

  const active = useMemo(() => data.animals.filter((a) => a.status === 'aktiv'), [data.animals]);
  const targets = useMemo(() => {
    const t: Option<string>[] = [{ value: 'all', label: `Bütün aktiv heyvanlar (${active.length})` }];
    for (const k of SPECIES_KEYS) {
      const n = active.filter((a) => a.species === k).length;
      if (n) t.push({ value: `sp:${k}`, label: `Bütün ${SPECIES[k].plural} (${n})`, icon: SPECIES[k].icon });
    }
    const groups = [...new Set(active.map((a) => a.group.trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'az'));
    for (const g of groups) t.push({ value: `gr:${g}`, label: `Qrup: ${g} (${active.filter((a) => a.group.trim() === g).length})` });
    return t;
  }, [active]);

  const [target, setTarget] = useState('all');
  const [date, setDate] = useState(todayISO());
  const [medicine, setMedicine] = useState('');
  const [dose, setDose] = useState('');
  const [reason, setReason] = useState('');
  const [meatWd, setMeatWd] = useState('0');
  const [milkWd, setMilkWd] = useState('0');
  const [used, setUsed] = useState('0');

  useEffect(() => {
    if (!visible) return;
    setTarget('all');
    setDate(todayISO());
    setMedicine('');
    setDose('');
    setReason('');
    setMeatWd('0');
    setMilkWd('0');
    setUsed('0');
  }, [visible]);

  const med = findMed(data.meds, medicine);
  // Şkafdakı dərman seçiləndə qalıq müddətləri avtomatik dolur.
  useEffect(() => {
    if (med) {
      setMeatWd(String(med.meatWd));
      setMilkWd(String(med.milkWd));
    }
  }, [med?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!medicine.trim()) return toast('Dərmanın adını yazın');
    const list = group
      ? active.filter((a) => (target === 'all' ? true : target.startsWith('sp:') ? a.species === target.slice(3) : a.group.trim() === target.slice(3)))
      : [animal];
    if (!list.length) return toast('Seçilən qrupda heyvan yoxdur');
    const batchId = group ? uid() : null;
    const rows: Treatment[] = list.map((a) => ({
      id: uid(), animalId: a.id, batchId, date, medicine: medicine.trim(), dose: dose.trim(), reason: reason.trim(),
      meatWd: toNum(meatWd), milkWd: toNum(milkWd),
    }));
    const amount = toNum(used) * list.length;
    const note = farmStore.addTreatments(rows, med && amount > 0 ? { med, amount } : undefined);
    toast((group ? `${list.length} heyvan üçün müalicə qeyd olundu` : 'Müalicə qeyd olundu') + note);
    onClose();
  };

  const st = med ? medStatus(med) : null;
  return (
    <Sheet visible={visible} icon={group ? 'pill-multiple' : 'pill'} title={group ? 'Qrup müalicəsi' : `Müalicə — ${animal.tag}`} onClose={onClose} onSubmit={submit}>
      {group && <ChipSelect label="Kimlər müalicə olunur?" options={targets} value={target} onChange={setTarget} vertical />}
      <DateField label="Tarix" value={date} onChange={(v) => setDate(v ?? todayISO())} max={todayISO()} />
      <SuggestField label="Dərman / peyvənd *" value={medicine} onChange={setMedicine} suggestions={data.meds.map((m) => m.name)} placeholder="Məs: İvermektin, Şap peyvəndi" />
      {med && st && (
        <Text style={{ color: st.expired ? c.danger : c.muted, fontSize: 13.5, marginTop: 6 }}>
          {st.expired
            ? `Diqqət: bu dərmanın son istifadə tarixi keçib (${fmt(med.expiry)})! Ehtiyatda: ${med.qty} ${med.unit}.`
            : `Şkafda: ${med.qty} ${med.unit}${med.expiry ? ' · son istifadə: ' + fmt(med.expiry) : ''}. Qalıq müddətləri şkafdan götürüldü.`}
        </Text>
      )}
      {med && <NumField label={`Şkafdan çıxılsın${group ? ' (hər heyvana)' : ''}, ${med.unit}`} value={used} onChange={setUsed} decimal />}
      <Grid2>
        <Field label={group ? 'Doza (hər heyvana)' : 'Doza'} value={dose} onChangeText={setDose} placeholder={group ? '2 ml' : '10 ml'} />
        <Field label="Səbəb" value={reason} onChangeText={setReason} placeholder={group ? 'Peyvənd, parazit…' : 'Parazit, mastit…'} />
      </Grid2>
      <Grid2>
        <NumField label="Ət qalığı (gün)" value={meatWd} onChange={setMeatWd} />
        <NumField label="Süd qalığı (gün)" value={milkWd} onChange={setMilkWd} />
      </Grid2>
      {!group && <Muted small style={{ marginTop: 10 }}>Qalıq müddətini dərmanın təlimatından və ya baytardan öyrənin. Tətbiq son tarixi avtomatik hesablayacaq.</Muted>}
    </Sheet>
  );
}
