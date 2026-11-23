/** Biznes məntiqi — PWA versiyasından köçürülüb, UI və backend-dən asılı deyil. */
import { MOVEMENT, SCAN_RESULT, SPECIES, STATUS, type IconKey } from './constants';
import { addDays, daysBetween, fmt, inDays, todayISO } from './dates';
import type { Animal, Breeding, FarmData, Feed, Med, PregCheck } from './types';

export const animalLabel = (a: Animal | undefined | null) =>
  a ? `${a.tag}${a.name ? ' · ' + a.name : ''}` : 'Silinmiş heyvan';

export const speciesOf = (a: Pick<Animal, 'species'>) => SPECIES[a.species] ?? SPECIES.inek;

export const sexLabel = (a: Pick<Animal, 'sex'>) => (a.sex === 'd' ? 'Dişi' : 'Erkək');

export const round1 = (x: number) => Math.round(x * 10) / 10;

export interface Withdrawal {
  meat: string | null;
  milk: string | null;
}

/** Dərman qalığı: heyvanın aktiv ət/süd məhdudiyyəti varsa son tarixləri qaytarır. */
export function withdrawal(data: FarmData, animalId: string): Withdrawal | null {
  const t = todayISO();
  let meat: string | null = null;
  let milk: string | null = null;
  for (const tr of data.treatments) {
    if (tr.animalId !== animalId) continue;
    if (tr.meatWd > 0) {
      const m = addDays(tr.date, tr.meatWd);
      if (m >= t && (!meat || m > meat)) meat = m;
    }
    if (tr.milkWd > 0) {
      const k = addDays(tr.date, tr.milkWd);
      if (k >= t && (!milk || k > milk)) milk = k;
    }
  }
  return meat || milk ? { meat, milk } : null;
}

/** Çəki statistikası: son çəki və orta gündəlik artım (q/gün). */
export function weightStats(data: FarmData, animalId: string) {
  const ws = data.weights.filter((w) => w.animalId === animalId).sort((a, b) => a.date.localeCompare(b.date));
  if (!ws.length) return null;
  const last = ws[ws.length - 1];
  let adg: number | null = null;
  if (ws.length > 1) {
    const d = daysBetween(ws[0].date, last.date);
    if (d > 0) adg = Math.round(((last.kg - ws[0].kg) / d) * 1000);
  }
  return { last, adg, count: ws.length };
}

/* ---------- Dərman şkafı ---------- */
export function findMed(meds: Med[], name: string): Med | undefined {
  const n = (name || '').trim().toLowerCase();
  return n ? meds.find((m) => m.name.trim().toLowerCase() === n) : undefined;
}

export interface MedStatus {
  expired: boolean;
  soon: boolean;
  low: boolean;
}

/** Dərmanın vəziyyəti: vaxtı keçib / yaxında bitir / az qalıb. */
export function medStatus(m: Med): MedStatus {
  const t = todayISO();
  const s: MedStatus = { expired: false, soon: false, low: false };
  if (m.expiry) {
    if (m.expiry < t) s.expired = true;
    else if (m.expiry <= addDays(t, 30)) s.soon = true;
  }
  if (m.minQty > 0 && m.qty <= m.minQty) s.low = true;
  return s;
}

export const medNeedsAttention = (m: Med) => {
  const s = medStatus(m);
  return s.expired || s.soon || s.low;
};

/** Ehtiyatdan çıxılandan sonrakı miqdarı və xəbərdarlıq mətnini qaytarır. */
export function stockAfterUse(m: Med, amount: number): { qty: number; note: string } {
  const qty = Math.max(0, round1(m.qty - amount));
  let note = '';
  if (qty === 0) note = ` · ${m.name} şkafda bitdi`;
  else if (medStatus({ ...m, qty }).low) note = ` · ${m.name} az qalıb (${qty} ${m.unit})`;
  return { qty, note };
}

export type PendingBirth = Breeding & { animal: Animal };

export function pendingBirths(data: FarmData): PendingBirth[] {
  return data.breedings
    .filter((b) => !b.outcome)
    .map((b) => ({ ...b, animal: data.animals.find((a) => a.id === b.animalId)! }))
    .filter((b) => b.animal && b.animal.status === 'aktiv')
    .sort((a, b) => a.expected.localeCompare(b.expected));
}

export const isPregnant = (data: FarmData, animalId: string) =>
  data.breedings.some((b) => b.animalId === animalId && !b.outcome);

/* ---------- Boğazlıq və qızğınlıq ---------- */
export type PregState = 'none' | 'bred' | 'pregnant';
export interface Pregnancy {
  state: PregState;
  breeding?: Breeding;
  scan?: PregCheck;
}

/** Son açıq mayalanma və ona aid son yoxlama: "mayalanıb" (təsdiqsiz) və ya "boğazdır" (təsdiqlənib). */
export function pregnancy(data: FarmData, animalId: string): Pregnancy {
  const b = data.breedings
    .filter((x) => x.animalId === animalId && !x.outcome)
    .sort((x, y) => y.date.localeCompare(x.date))[0];
  if (!b) return { state: 'none' };
  const scan = data.pregChecks
    .filter((p) => p.animalId === animalId && (p.breedingId === b.id || (!p.breedingId && p.date >= b.date)))
    .sort((x, y) => y.date.localeCompare(x.date))[0];
  return { state: scan?.result === 'positive' ? 'pregnant' : 'bred', breeding: b, scan };
}

/** Növbəti gözlənilən qızğınlıq: son qızğınlıq + növün tsikli (boğaz/mayalanmış heyvan üçün yoxdur). */
export function nextHeat(data: FarmData, a: Animal): string | null {
  if (a.sex !== 'd' || a.status !== 'aktiv') return null;
  if (pregnancy(data, a.id).state !== 'none') return null;
  const last = data.heats.filter((h) => h.animalId === a.id).sort((x, y) => y.date.localeCompare(x.date))[0];
  if (!last) return null;
  const cycle = speciesOf(a).cycle;
  const t = todayISO();
  let next = addDays(last.date, cycle);
  // Bir neçə tsikl keçibsə, bu günə ən yaxın gələcək tsikli göstəririk (ən çox 6 tsikl).
  for (let i = 0; i < 6 && next < addDays(t, -2); i++) next = addDays(next, cycle);
  return next < addDays(t, -2) ? null : next;
}

/* ---------- Panel xəbərdarlıqları ---------- */
export type AlertLevel = 'danger' | 'warn' | 'info';
export interface HomeAlert {
  key: string;
  level: AlertLevel;
  icon: IconKey;
  title: string;
  subtitle: string;
  /** Expo Router marşrutu. */
  href: string;
}

export function homeAlerts(data: FarmData): HomeAlert[] {
  const t = todayISO();
  const active = data.animals.filter((a) => a.status === 'aktiv');
  const out: HomeAlert[] = [];

  for (const a of active) {
    const w = withdrawal(data, a.id);
    if (!w) continue;
    const parts: string[] = [];
    if (w.meat) parts.push(`ət: ${fmt(w.meat)}-dək`);
    if (w.milk) parts.push(`süd: ${fmt(w.milk)}-dək`);
    out.push({ key: 'wd' + a.id, level: 'danger', icon: 'pill', title: `${animalLabel(a)} — dərman qalığı`, subtitle: parts.join(', '), href: `/animal/${a.id}` });
  }
  for (const b of pendingBirths(data)) {
    const n = daysBetween(t, b.expected);
    if (n > 30) continue;
    out.push({ key: 'b' + b.id, level: n < 0 ? 'warn' : 'info', icon: 'baby-bottle', title: `${animalLabel(b.animal)} — gözlənilən doğum`, subtitle: `${fmt(b.expected)} (${inDays(n)})`, href: `/animal/${b.animal.id}` });
  }
  for (const a of active) {
    if (a.sex !== 'd') continue;
    const p = pregnancy(data, a.id);
    if (p.state === 'bred' && p.breeding && !p.scan) {
      const due = addDays(p.breeding.date, speciesOf(a).scanAfter);
      // Yalnız məntiqli pəncərədə: tövsiyə olunan gündən 60 gün sonraya qədər (doğuma yaxın heyvana lazım deyil).
      if (due <= t && daysBetween(due, t) <= 60) {
        out.push({ key: 'sc' + a.id, level: 'warn', icon: 'scan', title: `${animalLabel(a)} — boğazlıq yoxlaması vaxtıdır`, subtitle: `Mayalanma: ${fmt(p.breeding.date)} (${daysBetween(p.breeding.date, t)} gün əvvəl)`, href: `/animal/${a.id}` });
      }
    }
    const h = nextHeat(data, a);
    if (h) {
      const n = daysBetween(t, h);
      if (n <= 3) out.push({ key: 'h' + a.id, level: 'info', icon: 'heat', title: `${animalLabel(a)} — gözlənilən qızğınlıq`, subtitle: `${fmt(h)} (${inDays(n)})`, href: `/animal/${a.id}` });
    }
  }
  for (const f of data.feeds) {
    if (!feedLow(f)) continue;
    out.push({ key: 'f' + f.id, level: 'warn', icon: 'feed', title: `${f.name} — yem anbarı`, subtitle: `az qalıb: ${f.qty} ${f.unit} (minimum ${f.minQty})`, href: '/feeds' });
  }
  const tasks = data.tasks
    .filter((x) => !x.done && x.due && x.due <= addDays(t, 7))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  for (const k of tasks) {
    const n = daysBetween(t, k.due!);
    out.push({ key: 't' + k.id, level: n < 0 ? 'warn' : 'info', icon: 'calendar-clock', title: k.title, subtitle: `${fmt(k.due)} (${inDays(n)})`, href: '/tasks' });
  }
  for (const m of data.meds) {
    const s = medStatus(m);
    if (!s.expired && !s.soon && !s.low) continue;
    const parts: string[] = [];
    if (s.expired) parts.push(`son istifadə tarixi keçib (${fmt(m.expiry)})`);
    if (s.soon) parts.push(`son istifadə: ${fmt(m.expiry)} (${inDays(daysBetween(t, m.expiry!))})`);
    if (s.low) parts.push(`az qalıb: ${m.qty} ${m.unit}`);
    out.push({ key: 'm' + m.id, level: s.expired ? 'danger' : 'warn', icon: 'medical-bag', title: `${m.name} — dərman şkafı`, subtitle: parts.join(' · '), href: '/meds' });
  }
  return out;
}

/* ---------- Hadisələr (tarixçə) ---------- */
export type EventKind = 'tr' | 'w' | 'b' | 'pc' | 'h' | 'mv';
export interface AnimalEvent {
  kind: EventKind;
  id: string;
  animalId: string;
  date: string;
  icon: IconKey;
  title: string;
  subtitle: string;
  /** Mayalanma nəticəsi hələ qeyd olunmayıbsa true. */
  openBreeding: boolean;
}

export function events(data: FarmData, animalId?: string): AnimalEvent[] {
  const match = (x: { animalId: string }) => !animalId || x.animalId === animalId;
  const list: AnimalEvent[] = [];
  for (const e of data.treatments.filter(match)) {
    const p: string[] = [];
    if (e.reason) p.push(e.reason);
    if (e.meatWd) p.push(`ət qalığı ${e.meatWd} gün`);
    if (e.milkWd) p.push(`süd qalığı ${e.milkWd} gün`);
    list.push({ kind: 'tr', id: e.id, animalId: e.animalId, date: e.date, icon: 'pill', title: `${e.medicine}${e.dose ? ' · ' + e.dose : ''}`, subtitle: p.join(' · '), openBreeding: false });
  }
  for (const e of data.weights.filter(match)) {
    list.push({ kind: 'w', id: e.id, animalId: e.animalId, date: e.date, icon: 'weight', title: `${e.kg} kq`, subtitle: '', openBreeding: false });
  }
  for (const e of data.breedings.filter(match)) {
    const sub = [e.sire ? `Ata: ${e.sire}` : '', `Gözlənilən doğum: ${fmt(e.expected)}`, e.outcome ? `Nəticə: ${e.outcome}` : ''].filter(Boolean).join(' · ');
    list.push({ kind: 'b', id: e.id, animalId: e.animalId, date: e.date, icon: 'dna', title: e.method === 'suni' ? 'Süni mayalanma' : 'Təbii cütləşmə', subtitle: sub, openBreeding: !e.outcome });
  }
  for (const e of data.pregChecks.filter(match)) {
    const sub = [e.fetuses ? `${e.fetuses} döl` : '', e.method === 'manual' ? 'əl ilə' : 'USM', e.notes].filter(Boolean).join(' · ');
    list.push({ kind: 'pc', id: e.id, animalId: e.animalId, date: e.date, icon: 'scan', title: `Boğazlıq yoxlaması: ${SCAN_RESULT[e.result]}`, subtitle: sub, openBreeding: false });
  }
  for (const e of data.heats.filter(match)) {
    list.push({ kind: 'h', id: e.id, animalId: e.animalId, date: e.date, icon: 'heat', title: 'Qızğınlıq', subtitle: e.notes, openBreeding: false });
  }
  for (const e of data.movements.filter(match)) {
    const m = MOVEMENT[e.type];
    const sub = [e.counterparty, e.price ? `${e.price} AZN` : '', e.weight ? `${e.weight} kq` : '', e.notes].filter(Boolean).join(' · ');
    list.push({ kind: 'mv', id: e.id, animalId: e.animalId, date: e.date, icon: m.icon, title: m.label, subtitle: sub, openBreeding: false });
  }
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- Alqı-satqı ---------- */
export interface TradeSummary {
  sold: number;
  revenue: number;
  bought: number;
  spend: number;
  /** Satılan heyvanların orta qiyməti (qiyməti yazılanlar üzrə). */
  avgSale: number | null;
}

/** Verilən tarixdən (daxil) bu günədək alış və satış yekunu. */
export function tradeSummary(data: FarmData, from?: string): TradeSummary {
  const mv = data.movements.filter((m) => !from || m.date >= from);
  const sales = mv.filter((m) => m.type === 'sale');
  const buys = mv.filter((m) => m.type === 'purchase');
  const priced = sales.filter((m) => m.price > 0);
  const sum = (xs: { price: number }[]) => Math.round(xs.reduce((s, x) => s + (x.price || 0), 0) * 100) / 100;
  return {
    sold: sales.length,
    revenue: sum(sales),
    bought: buys.length,
    spend: sum(buys),
    avgSale: priced.length ? Math.round(sum(priced) / priced.length) : null,
  };
}

/* ---------- CSV ixrac ---------- */
function csv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: unknown) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Excel-in Azərbaycan hərflərini düzgün göstərməsi üçün BOM əlavə olunur.
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\n');
}

export function animalsCsv(data: FarmData): string {
  const rows: (string | number | null)[][] = [['Bırka', 'Ad', 'Növ', 'Cins', 'Cinsiyyət', 'Doğum tarixi', 'Ana', 'Qrup', 'Status', 'Son çəki (kq)', 'Orta artım (q/gün)']];
  for (const a of data.animals) {
    const w = weightStats(data, a.id);
    rows.push([a.tag, a.name, speciesOf(a).label, a.breed, sexLabel(a), fmt(a.dob), a.damTag, a.group, STATUS[a.status], w ? w.last.kg : '', w && w.adg !== null ? w.adg : '']);
  }
  return csv(rows);
}

export function treatmentsCsv(data: FarmData): string {
  const rows: (string | number)[][] = [['Tarix', 'Bırka', 'Dərman', 'Doza', 'Səbəb', 'Ət qalığı (gün)', 'Ət — son tarix', 'Süd qalığı (gün)', 'Süd — son tarix']];
  for (const t of [...data.treatments].sort((a, b) => a.date.localeCompare(b.date))) {
    const a = data.animals.find((x) => x.id === t.animalId);
    rows.push([fmt(t.date), a ? a.tag : '', t.medicine, t.dose, t.reason, t.meatWd, t.meatWd ? fmt(addDays(t.date, t.meatWd)) : '', t.milkWd, t.milkWd ? fmt(addDays(t.date, t.milkWd)) : '']);
  }
  return csv(rows);
}

/* ---------- Yem, alışlar, süd ---------- */
export const feedLow = (f: Feed) => f.minQty > 0 && f.qty <= f.minQty;

export interface ExpenseSummary {
  meds: number;
  feeds: number;
  /** Süd satışı (litr × qiymət, qiyməti yazılanlar üzrə). */
  milkRevenue: number;
  milkLiters: number;
}
export function expenseSummary(data: FarmData, from?: string): ExpenseSummary {
  const ok = (d: string) => !from || d >= from;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const sum = (k: 'med' | 'feed') => r2(data.purchases.filter((p) => p.kind === k && ok(p.date)).reduce((s, p) => s + (p.price || 0), 0));
  const milk = data.milkRecords.filter((m) => ok(m.date));
  return {
    meds: sum('med'),
    feeds: sum('feed'),
    milkRevenue: r2(milk.reduce((s, m) => s + (m.price ? m.price * m.liters : 0), 0)),
    milkLiters: Math.round(milk.reduce((s, m) => s + m.liters, 0) * 10) / 10,
  };
}

export interface MilkStats {
  days: number;
  liters: number;
  perDay: number | null;
  fat: number | null;
  protein: number | null;
  scc: number | null;
}
/** Son N gündə süd: cəm, gündəlik orta, keyfiyyət göstəricilərinin litrə görə çəkili ortası. */
export function milkStats(data: FarmData, days = 30): MilkStats {
  const from = addDays(todayISO(), -days + 1);
  const rs = data.milkRecords.filter((m) => m.date >= from);
  const liters = rs.reduce((s, m) => s + m.liters, 0);
  const wavg = (k: 'fat' | 'protein' | 'scc') => {
    const xs = rs.filter((m) => m[k] > 0);
    const w = xs.reduce((s, m) => s + m.liters, 0);
    return w ? xs.reduce((s, m) => s + m[k] * m.liters, 0) / w : null;
  };
  const dayCount = new Set(rs.map((m) => m.date)).size;
  const r = (x: number | null, d: number) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);
  return { days, liters: Math.round(liters * 10) / 10, perDay: dayCount ? r(liters / dayCount, 1) : null, fat: r(wavg('fat'), 2), protein: r(wavg('protein'), 2), scc: r(wavg('scc'), 0) };
}

export function purchasesCsv(data: FarmData): string {
  const rows: (string | number)[][] = [['Tarix', 'Növ', 'Ad', 'Miqdar', 'Vahid', 'Məbləğ (AZN)', 'Təchizatçı', 'Partiya', 'Son istifadə', 'Qeyd']];
  for (const p of [...data.purchases].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([fmt(p.date), p.kind === 'med' ? 'Dərman' : 'Yem', p.itemName, p.qty, p.unit, p.price || '', p.supplier, p.batch, p.expiry ? fmt(p.expiry) : '', p.notes]);
  }
  return csv(rows);
}

export function milkCsv(data: FarmData): string {
  const rows: (string | number)[][] = [['Tarix', 'Litr', 'Yağ (%)', 'Zülal (%)', 'SHS (hüceyrə/ml)', 'Alıcı', 'Qiymət (AZN/l)', 'Məbləğ (AZN)', 'Qeyd']];
  for (const m of [...data.milkRecords].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([fmt(m.date), m.liters, m.fat || '', m.protein || '', m.scc || '', m.buyer, m.price || '', m.price ? Math.round(m.price * m.liters * 100) / 100 : '', m.notes]);
  }
  return csv(rows);
}

export function movementsCsv(data: FarmData): string {
  const rows: (string | number)[][] = [['Tarix', 'Bırka', 'Növ', 'Əməliyyat', 'Qarşı tərəf', 'Qiymət (AZN)', 'Çəki (kq)', 'Qeyd']];
  for (const m of [...data.movements].sort((a, b) => a.date.localeCompare(b.date))) {
    const a = data.animals.find((x) => x.id === m.animalId);
    rows.push([fmt(m.date), a ? a.tag : '', a ? speciesOf(a).label : '', MOVEMENT[m.type].label, m.counterparty, m.price || '', m.weight || '', m.notes]);
  }
  return csv(rows);
}

/* ---------- Ferma xülasəsi (e-poçt hesabatı) ---------- */
/** Qısa mətn hesabatı — mailto gövdəsi üçün (uzunluğu bir neçə min simvoldan çox olmur). */
export function farmReport(data: FarmData, from: string): string {
  const t = todayISO();
  const n = (x: number) => x.toLocaleString('az-AZ', { maximumFractionDigits: 2 });
  const active = data.animals.filter((a) => a.status === 'aktiv');
  const lines: string[] = [];
  lines.push(`${data.farm.name || 'Ferma'} — xülasə (${fmt(from)} – ${fmt(t)})`);
  if (data.farm.owner || data.farm.region) lines.push([data.farm.owner, data.farm.region].filter(Boolean).join(', '));
  lines.push('');
  lines.push(`HEYVANLAR: ${active.length} aktiv`);
  for (const [k, s] of Object.entries(SPECIES)) {
    const xs = active.filter((a) => a.species === k);
    if (xs.length) lines.push(`  ${s.label}: ${xs.length} (${xs.filter((a) => a.sex === 'd').length} dişi, ${xs.filter((a) => a.sex !== 'd').length} erkək)`);
  }
  const preg = active.filter((a) => a.sex === 'd' && pregnancy(data, a.id).state === 'pregnant').length;
  const births = pendingBirths(data).filter((b) => daysBetween(t, b.expected) <= 30);
  lines.push(`  Boğaz: ${preg} · 30 gün ərzində gözlənilən doğum: ${births.length}`);
  const born = data.animals.filter((a) => a.dob && a.dob >= from && a.damTag).length;
  if (born) lines.push(`  Dövrdə doğulan: ${born}`);
  lines.push('');
  const tr = tradeSummary(data, from);
  lines.push('ALQI-SATQI');
  lines.push(`  Satış: ${tr.sold} heyvan, ${n(tr.revenue)} ₼ · Alış: ${tr.bought} heyvan, ${n(tr.spend)} ₼`);
  const exits = data.movements.filter((m) => m.date >= from && (m.type === 'death' || m.type === 'slaughter'));
  if (exits.length) lines.push(`  Ölüm: ${exits.filter((m) => m.type === 'death').length} · Kəsim: ${exits.filter((m) => m.type === 'slaughter').length}`);
  lines.push('');
  const ex = expenseSummary(data, from);
  lines.push('XƏRC VƏ GƏLİR');
  lines.push(`  Dərman alışı: ${n(ex.meds)} ₼ · Yem alışı: ${n(ex.feeds)} ₼`);
  lines.push(`  Süd: ${n(ex.milkLiters)} l, satış ${n(ex.milkRevenue)} ₼`);
  const trs = data.treatments.filter((x) => x.date >= from);
  lines.push(`  Müalicə qeydi: ${trs.length} (${new Set(trs.map((x) => x.animalId)).size} heyvan)`);
  const alerts = homeAlerts(data).filter((a) => a.level !== 'info');
  if (alerts.length) {
    lines.push('');
    lines.push('DİQQƏT');
    for (const a of alerts.slice(0, 12)) lines.push(`  • ${a.title}: ${a.subtitle}`);
    if (alerts.length > 12) lines.push(`  … və daha ${alerts.length - 12}`);
  }
  lines.push('');
  lines.push('— Sürü ferma tətbiqi');
  return lines.join('\n');
}
