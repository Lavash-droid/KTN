/** Heyvan əlavə etmə / redaktə. Parametrlər: ?id= (redaktə) və ya ?species=&damTag=&dob=&breed= (bala). */
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../ui/Text';
import { SPECIES, SPECIES_KEYS, STATUS } from '../../domain/constants';
import { isISODate, todayISO } from '../../domain/dates';
import { animalLabel } from '../../domain/logic';
import type { Animal, AnimalStatus, Sex, SpeciesKey } from '../../domain/types';
import { preparePhoto } from '../../lib/files';
import { uid } from '../../lib/id';
import { farmStore, useFarm } from '../../store/farmStore';
import { Btn, Card, ChipSelect, DateField, Field, Grid2, Muted, NumField, Photo, Row, Screen, SuggestField, toNum } from '../../ui/components';
import { confirm, useToast } from '../../ui/feedback';
import { Icon } from '../../ui/Icon';
import { RADIUS, useColors } from '../../ui/theme';

type Params = { id?: string; species?: string; damTag?: string; dob?: string; breed?: string };

export default function AnimalForm() {
  const c = useColors();
  const toast = useToast();
  const params = useLocalSearchParams<Params>();
  const { data } = useFarm();
  const existing = params.id ? data.animals.find((a) => a.id === params.id) : undefined;
  const isCalf = !existing && !!params.damTag;

  const [v, setV] = useState<Animal>(() =>
    existing ?? {
      id: uid(), tag: '', name: '', species: (params.species as SpeciesKey) in SPECIES ? (params.species as SpeciesKey) : 'inek',
      breed: params.breed ?? '', sex: 'd', dob: isISODate(params.dob) ? params.dob : null, damTag: params.damTag ?? '', group: '',
      status: 'aktiv', notes: '', photo: null, createdAt: todayISO(),
    },
  );
  // undefined = dəyişməyib, string = yeni lokal şəkil, null = silinəcək
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  // Yeni heyvanın mənşəyi: fermada doğulub və ya alınıb (alış qeydi yaradılır)
  const [origin, setOrigin] = useState<'born' | 'bought'>('born');
  const [buy, setBuy] = useState({ date: todayISO() as string | null, seller: '', price: '', weight: '' });
  const set = <K extends keyof Animal>(k: K, val: Animal[K]) => setV((p) => ({ ...p, [k]: val }));

  if (params.id && !existing) {
    return (
      <Screen>
        <Card>
          <Muted>Heyvan tapılmadı.</Muted>
        </Card>
      </Screen>
    );
  }

  const pick = async (camera: boolean) => {
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast('Kameraya icazə verilməyib');
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setPhoto(await preparePhoto(asset.uri, asset.width, asset.height));
    } catch {
      toast('Şəkil oxunmadı');
    }
  };

  const save = () => {
    const tag = v.tag.trim();
    if (!tag) return toast('Bırka nömrəsi tələb olunur');
    const dup = data.animals.find((x) => x.tag.trim().toLowerCase() === tag.toLowerCase() && x.id !== v.id);
    if (dup) return toast('Bu bırka nömrəsi artıq mövcuddur');
    farmStore.saveAnimal({ ...v, tag, name: v.name.trim(), breed: v.breed.trim(), group: v.group.trim(), damTag: v.damTag.trim() }, photo);
    if (!existing && origin === 'bought') {
      const date = buy.date ?? todayISO();
      const kg = toNum(buy.weight);
      farmStore.addMovement({ id: uid(), animalId: v.id, date, type: 'purchase', counterparty: buy.seller.trim(), price: toNum(buy.price), weight: kg, notes: '' });
      if (kg > 0) farmStore.addWeight({ id: uid(), animalId: v.id, date, kg });
    }
    toast(existing ? 'Yeniləndi' : 'Heyvan əlavə olundu');
    if (existing) router.back();
    else router.replace(`/animal/${v.id}`);
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirm(`${animalLabel(existing)} və bütün qeydləri silinsin?`, '', 'Sil'))) return;
    farmStore.deleteAnimal(existing.id);
    toast('Silindi');
    router.dismissTo('/animals');
  };

  const shownPhoto = photo === undefined ? v.photo : photo;
  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Heyvanı redaktə et' : isCalf ? 'Yeni bala' : 'Yeni heyvan' }} />
      {isCalf && <Muted small style={{ marginBottom: 10 }}>Balanın məlumatlarını tamamlayın — ana, növ və doğum tarixi artıq doldurulub.</Muted>}
      <Card>
        <Row gap={14} style={{ alignItems: 'center', marginBottom: 4 }}>
          <View style={{ width: 84, height: 84, borderRadius: RADIUS, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Photo src={shownPhoto} style={{ width: 84, height: 84 }} fallback={<Icon name="camera" size={32} color={c.accent} />} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              <Btn title="Şəkil çək" icon="camera" variant="ghost" small onPress={() => pick(true)} />
              <Btn title="Qalereya" icon="image" variant="ghost" small onPress={() => pick(false)} />
              {shownPhoto ? <Btn title="Sil" variant="ghost" small onPress={() => setPhoto(null)} /> : null}
            </Row>
            <Muted small>Bırka itəndə heyvanı tanımağa kömək edir.</Muted>
          </View>
        </Row>

        <ChipSelect<SpeciesKey> label="Növ" options={SPECIES_KEYS.map((k) => ({ value: k, label: SPECIES[k].label, icon: SPECIES[k].icon }))} value={v.species} onChange={(s) => set('species', s)} />
        <Grid2>
          <Field label="Bırka nömrəsi *" value={v.tag} onChangeText={(t) => set('tag', t)} placeholder="AZ 0001 2345" autoCapitalize="characters" autoCorrect={false} />
          <Field label="Ad (istəyə görə)" value={v.name} onChangeText={(t) => set('name', t)} placeholder="Maral" />
        </Grid2>
        <SuggestField label="Cins" value={v.breed} onChange={(t) => set('breed', t)} suggestions={SPECIES[v.species].breeds} />
        <ChipSelect<Sex> label="Cinsiyyət" options={[{ value: 'd', label: 'Dişi' }, { value: 'e', label: 'Erkək' }]} value={v.sex} onChange={(s) => set('sex', s)} />
        <Grid2>
          <DateField label="Doğum tarixi" value={v.dob} onChange={(d) => set('dob', d)} optional max={todayISO()} />
          <Field label="Ananın bırkası" value={v.damTag} onChangeText={(t) => set('damTag', t)} autoCapitalize="characters" autoCorrect={false} />
        </Grid2>
        <SuggestField
          label="Qrup / tövlə"
          value={v.group}
          onChange={(t) => set('group', t)}
          suggestions={[...new Set(data.animals.map((a) => a.group).filter(Boolean))]}
          placeholder="Sağmal, Buzovlar…"
        />
        <ChipSelect<AnimalStatus> label="Status" options={(Object.keys(STATUS) as AnimalStatus[]).map((k) => ({ value: k, label: STATUS[k] }))} value={v.status} onChange={(s) => set('status', s)} />
        {!existing && !isCalf && (
          <>
            <ChipSelect<'born' | 'bought'>
              label="Mənşəyi"
              options={[{ value: 'born', label: 'Fermada doğulub' }, { value: 'bought', label: 'Alınıb', icon: 'cart-in' }]}
              value={origin}
              onChange={setOrigin}
            />
            {origin === 'bought' && (
              <>
                <Grid2>
                  <DateField label="Alış tarixi" value={buy.date} onChange={(d) => setBuy({ ...buy, date: d })} max={todayISO()} />
                  <Field label="Satıcı" value={buy.seller} onChangeText={(t) => setBuy({ ...buy, seller: t })} placeholder="Bazar, fermer…" />
                </Grid2>
                <Grid2>
                  <NumField label="Qiymət (AZN)" value={buy.price} onChange={(t) => setBuy({ ...buy, price: t })} decimal />
                  <NumField label="Çəki (kq)" value={buy.weight} onChange={(t) => setBuy({ ...buy, weight: t })} decimal />
                </Grid2>
              </>
            )}
          </>
        )}
        <Field label="Qeyd" value={v.notes} onChangeText={(t) => set('notes', t)} multiline />

        <Row style={{ marginTop: 18 }}>
          {existing ? <Btn title="Sil" variant="danger" onPress={remove} style={{ flex: 1 }} /> : null}
          <Btn title="Yadda saxla" onPress={save} style={{ flex: 2 }} />
        </Row>
      </Card>
    </Screen>
  );
}
