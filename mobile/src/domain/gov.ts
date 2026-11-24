/**
 * Dövlət hesabatları — EKTİS (Elektron Kənd Təsərrüfatı İnformasiya Sistemi, Kənd Təsərrüfatı Nazirliyi)
 * və AQTA (Azərbaycan Qida Təhlükəsizliyi Agentliyi).
 *
 * Fermanın qeydlərindən quruma bildirilməli hadisələr seçilir, artıq göndərilənlər (GovReport.itemKeys)
 * çıxılır, hesabat JSON (birbaşa inteqrasiya) və CSV (portala yükləmək / təqdim etmək) kimi hazırlanır.
 * UI və backend-dən asılı deyil.
 */
import { MOVEMENT, SPECIES } from './constants';
import { addDays, fmt, todayISO } from './dates';
import { csv, sexLabel, speciesOf } from './logic';
import type { Animal, FarmData, GovAgency, Movement, MovementType, Treatment } from './types';

export interface AgencyInfo {
  /** Qısa ad. */
  label: string;
  /** Tam ad. */
  full: string;
  /** Nə bildirilir — ekranda izah üçün. */
  scope: string;
}

export const AGENCIES: Record<GovAgency, AgencyInfo> = {
  ektis: {
    label: 'EKTİS',
    full: 'Elektron Kənd Təsərrüfatı İnformasiya Sistemi — Kənd Təsərrüfatı Nazirliyi',
    scope: 'Heyvanların qeydiyyatı və hərəkəti: doğum, alış, satış, köçürmə, kəsim, ölüm; sürünün say tərkibi.',
  },
  aqta: {
    label: 'AQTA',
    full: 'Azərbaycan Qida Təhlükəsizliyi Agentliyi',
    scope: 'Baytarlıq dərmanlarının istifadəsi və qalıq müddətləri; satış və kəsimə göndərilən heyvanlar; ölüm halları.',
  },
};
export const AGENCY_KEYS = Object.keys(AGENCIES) as GovAgency[];

/** Hansı hərəkətlər hansı quruma bildirilir. */
const MOVES: Record<GovAgency, MovementType[]> = {
  ektis: ['purchase', 'sale', 'move_out', 'slaughter', 'death'],
  aqta: ['sale', 'slaughter', 'death'],
};

export type GovItemType = 'reg' | MovementType | 'treatment';

/** Quruma bildiriləcək bir qeyd. */
export interface GovItem {
  /** Sabit açar: "reg:<heyvan>", "mv:<hərəkət>", "tr:<müalicə>". */
  key: string;
  type: GovItemType;
  date: string;
  animalId: string;
  title: string;
  detail: string;
  /** Göndərməzdən əvvəl düzəldilməli və ya diqqət tələb edən məqam. */
  warning: string | null;
  /** true — qanun pozuntusu ola bilər (məs. qalıq müddəti bitməmiş kəsim). */
  critical: boolean;
}

const tagOf = (a: Animal | undefined) => (a?.tag && a.tag !== '—' ? a.tag : '');

/** Heyvanın fermaya alışla gəlib-gəlmədiyi — gəlməyibsə doğum / ilkin qeydiyyat kimi bildirilir. */
const purchased = (data: FarmData, animalId: string) => data.movements.some((m) => m.animalId === animalId && m.type === 'purchase');

/** Hərəkət tarixində ət qalığı müddəti bitməmiş müalicə (varsa son tarix). */
export function meatWithdrawalAt(data: FarmData, animalId: string, date: string): string | null {
  let until: string | null = null;
  for (const t of data.treatments) {
    if (t.animalId !== animalId || !(t.meatWd > 0) || t.date > date) continue;
    const end = addDays(t.date, t.meatWd);
    if (end > date && (!until || end > until)) until = end;
  }
  return until;
}

function moveItem(data: FarmData, m: Movement, agency: GovAgency): GovItem {
  const a = data.animals.find((x) => x.id === m.animalId);
  const info = MOVEMENT[m.type];
  const parts = [a ? speciesOf(a).label : '', m.counterparty ? `${info.party}: ${m.counterparty}` : '', m.weight ? `${m.weight} kq` : ''];
  let warning: string | null = null;
  let critical = false;
  const wd = m.type === 'slaughter' || m.type === 'sale' ? meatWithdrawalAt(data, m.animalId, m.date) : null;
  if (wd) {
    warning = `Ət qalığı müddəti ${fmt(wd)}-dək bitməmişdi`;
    critical = m.type === 'slaughter';
  } else if (!tagOf(a)) warning = 'Bırka nömrəsi yoxdur';
  else if (!m.counterparty && m.type !== 'death') warning = `${info.party} göstərilməyib`;
  else if (!m.counterparty && m.type === 'death' && agency === 'aqta') warning = 'Ölüm səbəbi göstərilməyib';
  return {
    key: `mv:${m.id}`, type: m.type, date: m.date, animalId: m.animalId,
    title: `${info.label} — ${tagOf(a) || 'bırkasız'}`, detail: parts.filter(Boolean).join(' · '), warning, critical,
  };
}

function regItem(data: FarmData, a: Animal): GovItem {
  const born = !!a.damTag;
  const parts = [speciesOf(a).label, a.breed, sexLabel(a), a.dob ? `doğum: ${fmt(a.dob)}` : '', a.damTag ? `ana: ${a.damTag}` : ''];
  return {
    key: `reg:${a.id}`, type: 'reg', date: a.dob && born ? a.dob : a.createdAt, animalId: a.id,
    title: `${born ? 'Doğum' : 'Qeydiyyat'} — ${tagOf(a) || 'bırkasız'}`, detail: parts.filter(Boolean).join(' · '),
    warning: !tagOf(a) ? 'Bırka nömrəsi yoxdur' : !a.dob ? 'Doğum tarixi yoxdur' : null, critical: false,
  };
}

function treatmentItem(data: FarmData, t: Treatment): GovItem {
  const a = data.animals.find((x) => x.id === t.animalId);
  const wd = [t.meatWd ? `ət: ${fmt(addDays(t.date, t.meatWd))}-dək` : '', t.milkWd ? `süd: ${fmt(addDays(t.date, t.milkWd))}-dək` : ''].filter(Boolean).join(', ');
  return {
    key: `tr:${t.id}`, type: 'treatment', date: t.date, animalId: t.animalId,
    title: `${t.medicine}${t.dose ? ' · ' + t.dose : ''} — ${tagOf(a) || 'bırkasız'}`,
    detail: [t.reason, wd ? `qalıq ${wd}` : 'qalıq müddəti yoxdur'].filter(Boolean).join(' · '),
    warning: !tagOf(a) ? 'Bırka nömrəsi yoxdur' : null, critical: false,
  };
}

/** Quruma bildirilməli bütün qeydlər (göndərilib-göndərilməməsindən asılı olmayaraq), tarixə görə. */
export function govItems(data: FarmData, agency: GovAgency): GovItem[] {
  const out: GovItem[] = [];
  if (agency === 'ektis') {
    for (const a of data.animals) if (!purchased(data, a.id)) out.push(regItem(data, a));
  } else {
    for (const t of data.treatments) out.push(treatmentItem(data, t));
  }
  for (const m of data.movements) if (MOVES[agency].includes(m.type)) out.push(moveItem(data, m, agency));
  return out.sort((x, y) => x.date.localeCompare(y.date) || x.key.localeCompare(y.key));
}

/** Quruma artıq göndərilmiş (rədd edilməmiş) qeydlərin açarları. */
export function reportedKeys(data: FarmData, agency: GovAgency): Set<string> {
  const s = new Set<string>();
  for (const r of data.govReports) if (r.agency === agency && r.status !== 'rejected') for (const k of r.itemKeys) s.add(k);
  return s;
}

/** Hələ bildirilməmiş qeydlər; `from` verilərsə həmin tarixdən (daxil). */
export function pendingGovItems(data: FarmData, agency: GovAgency, from?: string | null): GovItem[] {
  const done = reportedKeys(data, agency);
  return govItems(data, agency).filter((i) => !done.has(i.key) && (!from || i.date >= from) && i.date <= todayISO());
}

/** Hesabatın səviyyəsində çatışmazlıqlar (fermanın identifikatorları). */
export function govReportIssues(data: FarmData, agency: GovAgency): string[] {
  const out: string[] = [];
  if (agency === 'ektis' && !data.farm.ektisNo.trim()) out.push('EKTİS qeydiyyat nömrəsi yazılmayıb');
  if (!data.farm.owner.trim()) out.push('Təsərrüfat sahibinin adı yazılmayıb');
  if (data.farm.voen && !/^\d{10}$/.test(data.farm.voen)) out.push('VÖEN 10 rəqəmdən ibarət olmalıdır');
  return out;
}

/** Aktiv heyvanların növ və cins üzrə sayı (sürünün tərkibi). */
export function herdComposition(data: FarmData) {
  const active = data.animals.filter((a) => a.status === 'aktiv');
  return (Object.keys(SPECIES) as (keyof typeof SPECIES)[])
    .map((k) => {
      const xs = active.filter((a) => a.species === k);
      return { species: k, label: SPECIES[k].label, female: xs.filter((a) => a.sex === 'd').length, male: xs.filter((a) => a.sex !== 'd').length };
    })
    .filter((x) => x.female + x.male > 0);
}

export const GOV_FORMAT = 'suru-gov-report';
export const GOV_VERSION = 1;

/**
 * Birbaşa inteqrasiya üçün hesabat (JSON). Qurumun API sxemi müqavilədən sonra məlum olacaq —
 * çevrilmə serverdə (supabase/functions/gov-report) aparılır, tətbiq bu neytral formatı göndərir.
 */
export function govPayload(data: FarmData, agency: GovAgency, items: GovItem[]) {
  const animal = (id: string) => {
    const a = data.animals.find((x) => x.id === id);
    return a ? { tag: tagOf(a), species: a.species, breed: a.breed, sex: a.sex === 'd' ? 'female' : 'male', dob: a.dob, damTag: a.damTag || null } : null;
  };
  return {
    format: GOV_FORMAT,
    version: GOV_VERSION,
    agency,
    generatedAt: new Date().toISOString(),
    farm: { name: data.farm.name, owner: data.farm.owner, region: data.farm.region, ektisNo: data.farm.ektisNo || null, voen: data.farm.voen || null },
    herd: herdComposition(data).map(({ species, female, male }) => ({ species, female, male })),
    items: items.map((i) => {
      const [kind, id] = i.key.split(':');
      const base = { key: i.key, type: i.type, date: i.date, animal: animal(i.animalId), warning: i.warning };
      if (kind === 'mv') {
        const m = data.movements.find((x) => x.id === id)!;
        return { ...base, counterparty: m.counterparty || null, weightKg: m.weight || null, meatWithdrawalUntil: meatWithdrawalAt(data, m.animalId, m.date) };
      }
      if (kind === 'tr') {
        const t = data.treatments.find((x) => x.id === id)!;
        return {
          ...base, medicine: t.medicine, dose: t.dose || null, reason: t.reason || null,
          meatWithdrawalDays: t.meatWd, meatWithdrawalUntil: t.meatWd ? addDays(t.date, t.meatWd) : null,
          milkWithdrawalDays: t.milkWd, milkWithdrawalUntil: t.milkWd ? addDays(t.date, t.milkWd) : null,
        };
      }
      return base;
    }),
  };
}
export type GovPayload = ReturnType<typeof govPayload>;

const TYPE_LABEL: Record<GovItemType, string> = {
  reg: 'Doğum / qeydiyyat',
  treatment: 'Baytarlıq dərmanı',
  ...Object.fromEntries(Object.entries(MOVEMENT).map(([k, v]) => [k, v.label])),
} as Record<GovItemType, string>;

/** Portala yükləmək və ya çap edib təqdim etmək üçün CSV (Excel). */
export function govCsv(data: FarmData, agency: GovAgency, items: GovItem[]): string {
  const f = data.farm;
  const rows: (string | number | null)[][] = [
    [`${AGENCIES[agency].label} hesabatı`, AGENCIES[agency].full],
    ['Təsərrüfat', f.name],
    ['Sahibi', f.owner],
    ['Rayon / kənd', f.region],
    ['EKTİS qeydiyyat nömrəsi', f.ektisNo],
    ['VÖEN', f.voen],
    ['Tarix', fmt(todayISO())],
    ['Sürünün tərkibi', herdComposition(data).map((h) => `${h.label}: ${h.female} dişi, ${h.male} erkək`).join('; ')],
    [],
  ];
  if (agency === 'ektis') {
    rows.push(['Tarix', 'Hadisə', 'Bırka', 'Növ', 'Cins', 'Cinsiyyət', 'Doğum tarixi', 'Ana bırkası', 'Qarşı tərəf / yer', 'Çəki (kq)', 'Qeyd']);
  } else {
    rows.push(['Tarix', 'Hadisə', 'Bırka', 'Növ', 'Dərman', 'Doza', 'Səbəb', 'Ət qalığı — son tarix', 'Süd qalığı — son tarix', 'Qarşı tərəf / səbəb', 'Qeyd']);
  }
  for (const i of items) {
    const a = data.animals.find((x) => x.id === i.animalId);
    const [kind, id] = i.key.split(':');
    const m = kind === 'mv' ? data.movements.find((x) => x.id === id) : undefined;
    const t = kind === 'tr' ? data.treatments.find((x) => x.id === id) : undefined;
    const note = i.warning ?? '';
    if (agency === 'ektis') {
      rows.push([fmt(i.date), TYPE_LABEL[i.type], tagOf(a), a ? speciesOf(a).label : '', a?.breed ?? '', a ? sexLabel(a) : '', fmt(a?.dob), a?.damTag ?? '', m?.counterparty ?? '', m?.weight || '', note]);
    } else {
      rows.push([
        fmt(i.date), TYPE_LABEL[i.type], tagOf(a), a ? speciesOf(a).label : '', t?.medicine ?? '', t?.dose ?? '', t?.reason ?? '',
        t?.meatWd ? fmt(addDays(t.date, t.meatWd)) : '', t?.milkWd ? fmt(addDays(t.date, t.milkWd)) : '', m?.counterparty ?? '', note,
      ]);
    }
  }
  return csv(rows);
}
