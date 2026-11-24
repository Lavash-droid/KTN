/**
 * Dövlət hesabatları — EKTİS və AQTA.
 * Bildirilməmiş qeydlər göstərilir; hesabat ya birbaşa quruma göndərilir (inteqrasiya qoşulubsa və hesab
 * myGov ilə təsdiqlənibsə), ya da CSV kimi ixrac edilib portala yüklənir və "bildirilib" kimi qeyd olunur.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { GOV_OFFLINE, repo, type GovStatus } from '../data';
import { MOVEMENT } from '../domain/constants';
import { addDays, fmt, todayISO } from '../domain/dates';
import { AGENCIES, AGENCY_KEYS, govCsv, govPayload, govReportIssues, herdComposition, pendingGovItems, type GovItem } from '../domain/gov';
import type { GovAgency, GovReport } from '../domain/types';
import { shareTextFile } from '../lib/files';
import { uid } from '../lib/id';
import { useAuth } from '../store/auth';
import { farmStore, useFarm } from '../store/farmStore';
import { AlertBox, Badge, Btn, Card, Empty, Field, Grid2, H2, List, ListItem, Muted, Screen, Segmented, Sheet } from '../ui/components';
import { confirm, useToast } from '../ui/feedback';
import type { IconName } from '../ui/Icon';
import { Text } from '../ui/Text';
import { FONT, useColors } from '../ui/theme';

type Period = '30' | '90' | 'year' | 'all';
const PERIOD_FROM: Record<Period, () => string | null> = {
  '30': () => addDays(todayISO(), -29),
  '90': () => addDays(todayISO(), -89),
  year: () => `${todayISO().slice(0, 4)}-01-01`,
  all: () => null,
};
const SHOW = 150;

const itemIcon = (i: GovItem): IconName => (i.type === 'reg' ? 'baby-bottle' : i.type === 'treatment' ? 'pill' : MOVEMENT[i.type].icon);

export default function Reports() {
  const c = useColors();
  const toast = useToast();
  const { session } = useAuth();
  const { data } = useFarm();
  const params = useLocalSearchParams<{ agency?: string }>();
  const [agency, setAgency] = useState<GovAgency>(params.agency === 'aqta' ? 'aqta' : 'ektis');
  const [period, setPeriod] = useState<Period>('30');
  const [gov, setGov] = useState<GovStatus>(GOV_OFFLINE);
  const [busy, setBusy] = useState(false);
  const [mark, setMark] = useState<string[] | null>(null);
  const [reference, setReference] = useState('');
  const [ids, setIds] = useState({ ektisNo: data.farm.ektisNo, voen: data.farm.voen });
  useEffect(() => setIds({ ektisNo: data.farm.ektisNo, voen: data.farm.voen }), [data.farm.ektisNo, data.farm.voen]);

  useEffect(() => {
    let alive = true;
    void repo.gov.status().then((s) => alive && setGov(s));
    return () => {
      alive = false;
    };
  }, []);

  const info = AGENCIES[agency];
  const items = useMemo(() => pendingGovItems(data, agency, PERIOD_FROM[period]()), [data, agency, period]);
  const issues = govReportIssues(data, agency);
  const history = useMemo(() => data.govReports.filter((r) => r.agency === agency).sort((a, b) => b.date.localeCompare(a.date)), [data.govReports, agency]);
  const critical = items.filter((i) => i.critical);
  const warned = items.filter((i) => i.warning).length;

  const viaMygov = session?.provider === 'mygov';
  const connected = gov.agencies[agency];
  const canSend = connected && (!gov.mygovRequired || viaMygov);
  const sendHint = !connected
    ? `${info.label} ilə birbaşa inteqrasiya hələ qoşulmayıb. Hesabatı fayl kimi ixrac edib ${info.label} portalına yükləyin və ya qurumun yerli bölməsinə təqdim edin.`
    : !canSend
      ? `Birbaşa göndəriş üçün hesabınız myGov ilə təsdiqlənməlidir — çıxış edib "myGov ilə daxil ol" seçin.`
      : `Hesabat ${session?.name ? session.name + ' adından ' : ''}myGov ilə təsdiqlənmiş hesabdan göndəriləcək.`;

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

  const record = (keys: string[], method: GovReport['method'], status: GovReport['status'], ref: string) =>
    farmStore.saveGovReport({ id: uid(), agency, date: todayISO(), status, method, reference: ref.trim(), itemKeys: keys, notes: '' });

  const send = () =>
    run(async () => {
      if (!(await confirm(`${info.label}-ə göndərilsin?`, `${items.length} qeyd göndəriləcək.${warned ? `\n${warned} qeyddə diqqət tələb edən məqam var.` : ''}`, 'Göndər', false))) return;
      const res = await repo.gov.submit(agency, govPayload(data, agency, items));
      record(items.map((i) => i.key), 'api', res.status, res.reference);
      toast(`${info.label}: ${res.status === 'accepted' ? 'qəbul olundu' : 'göndərildi'}${res.reference ? ` · № ${res.reference}` : ''}`);
    });

  const exportFile = () =>
    run(async () => {
      await shareTextFile(`suru-${agency}-${todayISO()}.csv`, govCsv(data, agency, items), 'text/csv');
      setReference('');
      setMark(items.map((i) => i.key));
    });

  const saveIds = () => {
    const voen = ids.voen.replace(/\s/g, '');
    if (voen && !/^\d{10}$/.test(voen)) return toast('VÖEN 10 rəqəmdən ibarət olmalıdır');
    farmStore.saveFarm({ ...data.farm, ektisNo: ids.ektisNo.trim(), voen });
    toast('Yadda saxlanıldı');
  };
  const idsChanged = ids.ektisNo.trim() !== data.farm.ektisNo || ids.voen.replace(/\s/g, '') !== data.farm.voen;

  return (
    <Screen>
      <Segmented<GovAgency> options={AGENCY_KEYS.map((k) => ({ value: k, label: AGENCIES[k].label, icon: 'bank' }))} value={agency} onChange={setAgency} />
      <Card style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 16, fontFamily: FONT.semibold, color: c.text }}>{info.full}</Text>
        <Muted small style={{ marginTop: 4 }}>{info.scope}</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <Badge kind={connected ? 'ok' : 'info'}>{connected ? 'Birbaşa göndəriş qoşulub' : 'Fayl ilə təqdim'}</Badge>
          <Badge kind={viaMygov ? 'ok' : 'warn'}>{viaMygov ? 'myGov ilə təsdiqlənib' : 'myGov ilə daxil olunmayıb'}</Badge>
        </View>
      </Card>

      <H2>Təsərrüfat</H2>
      <Card>
        <Grid2>
          <Field label="EKTİS qeydiyyat nömrəsi" value={ids.ektisNo} onChangeText={(t) => setIds({ ...ids, ektisNo: t })} autoCapitalize="characters" placeholder="EKTİS-dəki nömrə" />
          <Field label="VÖEN (varsa)" value={ids.voen} onChangeText={(t) => setIds({ ...ids, voen: t })} keyboardType="number-pad" maxLength={12} placeholder="10 rəqəm" />
        </Grid2>
        {idsChanged ? <Btn title="Yadda saxla" small variant="tonal" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={saveIds} /> : null}
        <Muted small style={{ marginTop: 10 }}>
          {`Sahibi: ${data.farm.owner || '—'} · ${data.farm.region || 'rayon yazılmayıb'}\nSürü: ${herdComposition(data).map((h) => `${h.label} ${h.female + h.male}`).join(', ') || 'aktiv heyvan yoxdur'}`}
        </Muted>
        {issues.length ? (
          <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: c.warnSoft }}>
            <Text style={{ color: c.warn, fontSize: 13.5 }}>{issues.map((x) => `• ${x}`).join('\n')}</Text>
          </View>
        ) : null}
      </Card>

      <H2>{`Bildirilməmiş qeydlər — ${items.length}`}</H2>
      <Segmented<Period>
        options={[
          { value: '30', label: '30 gün' },
          { value: '90', label: '90 gün' },
          { value: 'year', label: 'Bu il' },
          { value: 'all', label: 'Hamısı' },
        ]}
        value={period}
        onChange={setPeriod}
      />
      {critical.length ? (
        <View style={{ marginTop: 12 }}>
          <AlertBox
            level="danger"
            icon="alert"
            title={`${critical.length} kəsim dərman qalığı müddəti bitməmiş edilib`}
            subtitle="Bu barədə AQTA-ya məlumat verin və baytarla məsləhətləşin. Qeydlər hesabatda olduğu kimi göndəriləcək."
          />
        </View>
      ) : null}
      <View style={{ marginTop: 12 }}>
        <List>
          {items.length ? (
            items.slice(0, SHOW).map((i, n) => (
              <ListItem
                key={i.key}
                first={n === 0}
                icon={itemIcon(i)}
                chevron={false}
                title={i.title}
                subtitle={`${fmt(i.date)}${i.detail ? ' · ' + i.detail : ''}`}
                meta={i.warning ? <Badge kind={i.critical ? 'danger' : 'warn'}>{i.warning}</Badge> : undefined}
              />
            ))
          ) : (
            <Empty icon="check-circle">{`Seçilmiş dövrdə ${info.label}-ə bildirilməmiş qeyd yoxdur.`}</Empty>
          )}
        </List>
      </View>
      {items.length > SHOW ? <Muted small center style={{ marginTop: 8 }}>{`… və daha ${items.length - SHOW} qeyd (hamısı hesabata daxildir)`}</Muted> : null}

      <H2>Göndəriş</H2>
      <Card>
        <Btn title={`${info.label}-ə göndər${items.length ? ` (${items.length})` : ''}`} icon="send" onPress={send} disabled={!canSend || !items.length} loading={busy} />
        <Btn title="Fayl kimi ixrac et (CSV / Excel)" icon="file-export" variant="tonal" style={{ marginTop: 10 }} onPress={exportFile} disabled={!items.length || busy} />
        <Muted small style={{ marginTop: 10 }}>{sendHint}</Muted>
      </Card>

      <H2>Göndəriş tarixçəsi</H2>
      <List>
        {history.length ? (
          history.map((r, n) => (
            <ListItem
              key={r.id}
              first={n === 0}
              icon="history"
              title={`${fmt(r.date)} · ${r.itemKeys.length} qeyd`}
              subtitle={[r.method === 'api' ? 'Birbaşa göndəriş' : 'Fayl ilə təqdim', r.reference ? `№ ${r.reference}` : ''].filter(Boolean).join(' · ')}
              right={<Badge kind={r.status === 'accepted' ? 'ok' : r.status === 'rejected' ? 'danger' : 'info'}>{r.status === 'accepted' ? 'Qəbul olunub' : r.status === 'rejected' ? 'Rədd edilib' : 'Göndərilib'}</Badge>}
              onPress={async () => {
                if (await confirm('Göndəriş qeydi silinsin?', `Bu ${r.itemKeys.length} qeyd yenidən "bildirilməmiş" siyahısına qayıdacaq. Quruma göndərilmiş məlumat bundan dəyişmir.`, 'Sil')) {
                  farmStore.deleteGovReport(r.id);
                }
              }}
            />
          ))
        ) : (
          <Empty icon="history">Hələ hesabat göndərilməyib.</Empty>
        )}
      </List>
      <Muted small style={{ marginTop: 14 }}>
        Göndərilmiş qeydlər yadda saxlanılır və növbəti hesabata təkrar düşmür. Qeyd göndərildikdən sonra dəyişdirilibsə, düzəlişi qurumun portalında edin.
      </Muted>

      <Sheet
        visible={!!mark}
        title="Təqdimatı qeyd et"
        icon="check-circle"
        onClose={() => setMark(null)}
        submitLabel="Bildirilib kimi qeyd et"
        onSubmit={() => {
          if (!mark) return;
          record(mark, 'file', 'sent', reference);
          setMark(null);
          toast(`${mark.length} qeyd ${info.label}-ə bildirilmiş kimi qeyd olundu`);
        }}
      >
        <Muted>{`Faylı ${info.label} portalına yüklədinizsə və ya qurumun bölməsinə təqdim etdinizsə, ${mark?.length ?? 0} qeyd "bildirilib" kimi işarələnəcək. Hələ təqdim etməmisinizsə, bu pəncərəni bağlayın — qeydlər siyahıda qalacaq.`}</Muted>
        <Field label="Müraciət / qeydiyyat nömrəsi (varsa)" value={reference} onChangeText={setReference} placeholder="məs. portalın verdiyi nömrə" />
      </Sheet>
    </Screen>
  );
}
