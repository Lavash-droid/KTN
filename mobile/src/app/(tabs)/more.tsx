import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { isTransient, repo } from '../../data';
import { todayISO } from '../../domain/dates';
import { animalsCsv, medNeedsAttention, treatmentsCsv } from '../../domain/logic';
import { demoData, makeBackup, parseBackup } from '../../domain/transfer';
import { emptyFarmData, type Farm } from '../../domain/types';
import { readTextFile, shareTextFile } from '../../lib/files';
import { useAuth } from '../../store/auth';
import { farmStore, useFarm } from '../../store/farmStore';
import { Btn, Card, ChipSelect, Field, Grid2, H2, IconTile, List, ListItem, Muted, Screen } from '../../ui/components';
import { confirm, useToast } from '../../ui/feedback';
import { useColors, useThemePref, type ThemePref } from '../../ui/theme';

const BACKEND_LABEL = { supabase: 'Bulud (Supabase)', rest: 'Daxili server', local: 'Yalnız bu cihaz' } as const;

export default function More() {
  const c = useColors();
  const { pref, setPref } = useThemePref();
  const toast = useToast();
  const { session } = useAuth();
  const { data, status } = useFarm();
  const [farm, setFarm] = useState<Farm>(data.farm);
  const [busy, setBusy] = useState(false);
  useEffect(() => setFarm(data.farm), [data.farm]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message || 'Xəta baş verdi');
    } finally {
      setBusy(false);
    }
  };

  const restore = () =>
    run(async () => {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      let parsed;
      try {
        parsed = parseBackup(JSON.parse(await readTextFile(res.assets[0].uri)));
      } catch {
        throw new Error('Fayl oxunmadı — düzgün ehtiyat nüsxə deyil');
      }
      const n = parsed.data.animals.length;
      if (!(await confirm('Mövcud məlumat ehtiyat nüsxə ilə əvəz olunsun?', `${n} heyvan və onların qeydləri yüklənəcək.`, 'Əvəz et'))) return;
      await farmStore.replaceAll(parsed.data, parsed.photos);
      toast('Bərpa olundu');
      router.navigate('/');
    });

  const deleteAccount = async () => {
    const ok1 = await confirm(
      'Hesab silinsin?',
      'Hesabınız, fermanızın bütün heyvanları, qeydləri və şəkilləri serverdən birdəfəlik silinəcək. Bunu geri qaytarmaq olmaz.\n\nƏvvəlcə "Ehtiyat nüsxə (JSON)" ilə məlumatı saxlamağınız tövsiyə olunur.',
      'Davam et',
    );
    if (!ok1) return;
    const ok2 = await confirm('Son təsdiq', `${session?.email ?? session?.name ?? 'Hesab'} və bütün məlumat silinsin?`, 'Hesabı sil');
    if (!ok2) return;
    await run(async () => {
      try {
        await farmStore.deleteAccount();
      } catch (e) {
        throw new Error(isTransient(e) ? 'Hesabı silmək üçün internet bağlantısı lazımdır' : (e as Error).message);
      }
      toast('Hesab silindi');
    });
  };

  const sizeNote = data.meds.some(medNeedsAttention) ? ' · diqqət tələb edənlər var' : '';
  const lastSync = status.lastSync ? new Date(status.lastSync).toLocaleString('az-AZ') : '—';

  return (
    <Screen>
      <H2>Ferma</H2>
      <Card>
        <Field label="Fermanın adı" value={farm.name} onChangeText={(t) => setFarm({ ...farm, name: t })} />
        <Grid2>
          <Field label="Sahibi" value={farm.owner} onChangeText={(t) => setFarm({ ...farm, owner: t })} />
          <Field label="Rayon / kənd" value={farm.region} onChangeText={(t) => setFarm({ ...farm, region: t })} />
        </Grid2>
        <Btn
          title="Yadda saxla"
          style={{ marginTop: 14 }}
          onPress={() => {
            farmStore.saveFarm({ name: farm.name.trim() || 'Mənim fermam', owner: farm.owner.trim(), region: farm.region.trim() });
            toast('Yadda saxlanıldı');
          }}
        />
      </Card>

      <H2>Ferma ehtiyatı</H2>
      <List>
        <ListItem first icon="medical-bag" title="Dərman şkafı" subtitle={`${data.meds.length} dərman${sizeNote}`} onPress={() => router.push('/meds')} />
      </List>

      <H2>Hesabatlar və ehtiyat nüsxə</H2>
      <List>
        <ListItem first icon="file-excel" title="Heyvan siyahısı (CSV / Excel)" subtitle="Bütün heyvanlar, son çəki, status" onPress={() => run(() => shareTextFile(`suru-heyvanlar-${todayISO()}.csv`, animalsCsv(data), 'text/csv'))} />
        <ListItem icon="clipboard-text" title="Dərman jurnalı (CSV / Excel)" subtitle="Baytar və yoxlama üçün" onPress={() => run(() => shareTextFile(`suru-derman-jurnali-${todayISO()}.csv`, treatmentsCsv(data), 'text/csv'))} />
        <ListItem icon="download" title="Ehtiyat nüsxə (JSON)" subtitle="Bütün qeydlər bir faylda" onPress={() => run(() => shareTextFile(`suru-ehtiyat-${todayISO()}.json`, JSON.stringify(makeBackup(data)), 'application/json'))} />
        <ListItem icon="upload" title="Ehtiyat nüsxəni bərpa et" subtitle="Köhnə veb-tətbiqin (PWA) faylı da qəbul olunur · mövcud məlumatı əvəz edir" onPress={restore} />
      </List>

      <H2>Görünüş</H2>
      <Card>
        <ChipSelect<ThemePref>
          options={[
            { value: 'light', label: 'Açıq', icon: 'sun' },
            { value: 'dark', label: 'Qaranlıq', icon: 'moon' },
            { value: 'system', label: 'Sistem', icon: 'theme-auto' },
          ]}
          value={pref}
          onChange={setPref}
        />
        <Muted small style={{ marginTop: 8 }}>"Sistem" — telefonun və ya kompüterin ayarına uyğun dəyişir.</Muted>
      </Card>

      <H2>Hesab və sinxronizasiya</H2>
      <Card>
        <Muted small>
          {`Yaddaş: ${BACKEND_LABEL[repo.kind]}${session?.email || session?.name ? `\nHesab: ${[session.name, session.email].filter(Boolean).join(' · ')}` : ''}${session?.provider === 'mygov' ? ' (myGov)' : ''}\nSon sinxronizasiya: ${lastSync}${status.pending ? `\nGöndərilməmiş dəyişikliklər: ${status.pending}` : ''}${!status.online ? '\nServer hazırda əlçatan deyil — dəyişikliklər cihazda saxlanılır.' : ''}`}
        </Muted>
        <Grid2>
          <Btn title="İndi sinxronlaşdır" icon="sync" variant="ghost" small style={{ marginTop: 12 }} onPress={() => run(() => farmStore.sync())} loading={status.syncing} />
          {repo.kind !== 'local' ? (
            <Btn
              title="Çıxış"
              icon="logout"
              variant="ghost"
              small
              style={{ marginTop: 12 }}
              onPress={async () => {
                const warn = status.pending ? `${status.pending} dəyişiklik hələ serverə göndərilməyib və itəcək.` : '';
                if (await confirm('Hesabdan çıxılsın?', warn, 'Çıxış', !!warn)) await repo.auth.signOut();
              }}
            />
          ) : (
            <Text />
          )}
        </Grid2>
        {repo.kind !== 'local' && (
          <Btn
            title="Hesabı sil"
            icon="account-remove"
            variant="ghost"
            small
            style={{ marginTop: 10, alignSelf: 'flex-start', borderColor: c.danger }}
            onPress={deleteAccount}
          />
        )}
      </Card>

      <H2>Digər</H2>
      <List>
        <ListItem
          first
          icon="flask"
          title="Nümunə məlumat yüklə"
          subtitle="Tətbiqi sınamaq üçün"
          onPress={async () => {
            if (data.animals.length && !(await confirm('Nümunə məlumat mövcud məlumatı əvəz edəcək. Davam edilsin?', '', 'Davam et'))) return;
            await run(async () => {
              await farmStore.replaceAll(demoData());
              toast('Nümunə məlumat yükləndi');
              router.navigate('/');
            });
          }}
        />
        <ListItem
          icon={<IconTile name="trash" color={c.danger} bg={c.dangerSoft} />}
          title="Bütün məlumatı sil"
          titleColor={c.danger}
          subtitle="Geri qaytarmaq olmaz"
          onPress={async () => {
            if (!(await confirm('Bütün məlumat silinsin?', 'Bu əməliyyatı geri qaytarmaq olmaz.', 'Sil'))) return;
            await run(async () => {
              await farmStore.replaceAll(emptyFarmData());
              toast('Məlumat silindi');
              router.navigate('/');
            });
          }}
        />
      </List>
      <Muted small center style={{ marginTop: 24 }}>
        {busy ? 'Gözləyin…\n' : ''}Sürü v1.0 · Mütəmadi ehtiyat nüsxə götürün.
      </Muted>
    </Screen>
  );
}
