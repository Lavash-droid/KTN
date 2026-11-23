import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { isTransient, repo } from '../../data';
import { addDays, todayISO } from '../../domain/dates';
import { animalsCsv, expenseSummary, farmReport, feedLow, medNeedsAttention, milkCsv, milkStats, movementsCsv, purchasesCsv, tradeSummary, treatmentsCsv } from '../../domain/logic';
import { demoData, makeBackup, parseBackup } from '../../domain/transfer';
import { emptyFarmData, type Farm } from '../../domain/types';
import { readTextFile, shareTextFile } from '../../lib/files';
import { useAuth } from '../../store/auth';
import { farmStore, useFarm } from '../../store/farmStore';
import { Btn, Card, Field, Grid2, H2, IconTile, List, ListItem, Muted, Screen, Segmented } from '../../ui/components';
import { confirm, useToast } from '../../ui/feedback';
import { FONT, useColors, useThemePref, type ThemePref } from '../../ui/theme';

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
  const feedNote = data.feeds.some(feedLow) ? ' · az qalanlar var' : '';
  const milk = milkStats(data, 30);
  const emailReport = (days: number) =>
    run(async () => {
      const from = addDays(todayISO(), -days + 1);
      const subject = `${data.farm.name || 'Ferma'} — ${days} günlük hesabat`;
      const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(farmReport(data, from))}`;
      try {
        await Linking.openURL(url);
      } catch {
        throw new Error('E-poçt tətbiqi tapılmadı');
      }
    });
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
        <ListItem icon="feed" title="Yem anbarı" subtitle={`${data.feeds.length} növ yem${feedNote}`} onPress={() => router.push('/feeds')} />
        <ListItem icon="milk" title="Süd çəni" subtitle={milk.perDay !== null ? `Son 30 gün: gündə orta ${milk.perDay} l` : 'Gündəlik süd, yağlılıq, zülal, alıcı'} onPress={() => router.push('/milk')} />
      </List>

      <H2>{`Alqı-satqı — ${todayISO().slice(0, 4)}`}</H2>
      <TradeCard />

      <H2>{`Xərc və gəlir — ${todayISO().slice(0, 4)}`}</H2>
      <ExpenseCard />

      <H2>Hesabatlar və ehtiyat nüsxə</H2>
      <List>
        <ListItem first icon="file-excel" title="Heyvan siyahısı (CSV / Excel)" subtitle="Bütün heyvanlar, son çəki, status" onPress={() => run(() => shareTextFile(`suru-heyvanlar-${todayISO()}.csv`, animalsCsv(data), 'text/csv'))} />
        <ListItem icon="cart-out" title="Alqı-satqı jurnalı (CSV / Excel)" subtitle="Alış, satış, köçürmə, kəsim, ölüm" onPress={() => run(() => shareTextFile(`suru-alqi-satqi-${todayISO()}.csv`, movementsCsv(data), 'text/csv'))} />
        <ListItem icon="clipboard-text" title="Dərman jurnalı (CSV / Excel)" subtitle="Baytar və yoxlama üçün" onPress={() => run(() => shareTextFile(`suru-derman-jurnali-${todayISO()}.csv`, treatmentsCsv(data), 'text/csv'))} />
        <ListItem icon="receipt" title="Alış jurnalı (CSV / Excel)" subtitle="Dərman və yem alışları, təchizatçı, partiya" onPress={() => run(() => shareTextFile(`suru-alislar-${todayISO()}.csv`, purchasesCsv(data), 'text/csv'))} />
        <ListItem icon="milk" title="Süd jurnalı (CSV / Excel)" subtitle="Litr, keyfiyyət, alıcı, məbləğ" onPress={() => run(() => shareTextFile(`suru-sud-${todayISO()}.csv`, milkCsv(data), 'text/csv'))} />
        <ListItem icon="email" title="Həftəlik hesabatı e-poçtla göndər" subtitle="Son 7 gün: heyvanlar, alqı-satqı, xərclər, xəbərdarlıqlar" onPress={() => emailReport(7)} />
        <ListItem icon="email" title="Aylıq hesabatı e-poçtla göndər" subtitle="Son 30 gün" onPress={() => emailReport(30)} />
        <ListItem icon="download" title="Ehtiyat nüsxə (JSON)" subtitle="Bütün qeydlər bir faylda" onPress={() => run(() => shareTextFile(`suru-ehtiyat-${todayISO()}.json`, JSON.stringify(makeBackup(data)), 'application/json'))} />
        <ListItem icon="upload" title="Ehtiyat nüsxəni bərpa et" subtitle="Köhnə veb-tətbiqin (PWA) faylı da qəbul olunur · mövcud məlumatı əvəz edir" onPress={restore} />
      </List>

      <H2>Görünüş</H2>
      <Card>
        <Segmented<ThemePref>
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

const azn = (n: number) => `${n.toLocaleString('az-AZ', { maximumFractionDigits: 2 })} ₼`;

/** Bu ilin alış-satış yekunu. */
function TradeCard() {
  const c = useColors();
  const { data } = useFarm();
  const t = tradeSummary(data, `${todayISO().slice(0, 4)}-01-01`);
  const net = Math.round((t.revenue - t.spend) * 100) / 100;
  const cell = (label: string, value: string, sub?: string, color?: string) => (
    <View style={{ flexGrow: 1, flexBasis: 140, padding: 14, borderRadius: 14, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.line }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: color ?? c.text, fontSize: 24, fontFamily: FONT.display, marginTop: 4, letterSpacing: -0.3 }}>{value}</Text>
      {sub ? <Text style={{ color: c.muted, fontSize: 12.5 }}>{sub}</Text> : null}
    </View>
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {cell('Satış', azn(t.revenue), `${t.sold} heyvan${t.avgSale ? ` · orta ${azn(t.avgSale)}` : ''}`)}
        {cell('Alış', azn(t.spend), `${t.bought} heyvan`)}
        {cell('Fərq', azn(net), 'satış − alış', net >= 0 ? c.green : c.danger)}
      </View>
      <Muted small style={{ marginTop: 10 }}>Satış heyvan kartında "Satış / çıxış", alış isə yeni heyvan əlavə edərkən "Alınıb" ilə qeyd olunur.</Muted>
    </Card>
  );
}

/** Bu ilin dərman/yem xərci və süd gəliri. */
function ExpenseCard() {
  const c = useColors();
  const { data } = useFarm();
  const e = expenseSummary(data, `${todayISO().slice(0, 4)}-01-01`);
  const net = Math.round((e.milkRevenue - e.meds - e.feeds) * 100) / 100;
  const cell = (label: string, value: string, sub?: string, color?: string) => (
    <View style={{ flexGrow: 1, flexBasis: 140, padding: 14, borderRadius: 14, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.line }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: color ?? c.text, fontSize: 24, fontFamily: FONT.display, marginTop: 4, letterSpacing: -0.3 }}>{value}</Text>
      {sub ? <Text style={{ color: c.muted, fontSize: 12.5 }}>{sub}</Text> : null}
    </View>
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {cell('Dərman', azn(e.meds), 'alışlar')}
        {cell('Yem', azn(e.feeds), 'alışlar')}
        {cell('Süd satışı', azn(e.milkRevenue), `${e.milkLiters.toLocaleString('az-AZ')} l`)}
        {cell('Fərq', azn(net), 'süd − dərman − yem', net >= 0 ? c.green : c.danger)}
      </View>
      <Muted small style={{ marginTop: 10 }}>Heyvan alqı-satqısı yuxarıdakı kartdadır. Xərclər məbləği yazılmış alışlar üzrə hesablanır.</Muted>
    </Card>
  );
}
