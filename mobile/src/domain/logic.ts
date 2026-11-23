/** Biznes məntiqi — PWA versiyasından köçürülüb, UI və backend-dən asılı deyil. */
import { SPECIES, STATUS } from './constants';
import { addDays, daysBetween, fmt, inDays, todayISO } from './dates';
import type { Animal, Breeding, FarmData, Med } from './types';

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

/* ---------- Panel xəbərdarlıqları ---------- */
export type AlertLevel = 'danger' | 'warn' | 'info';
export interface HomeAlert {
  key: string;
  level: AlertLevel;
  icon: string;
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
    out.push({ key: 'wd' + a.id, level: 'danger', icon: '💊', title: `${animalLabel(a)} — dərman qalığı`, subtitle: parts.join(', '), href: `/animal/${a.id}` });
  }
  for (const b of pendingBirths(data)) {
    const n = daysBetween(t, b.expected);
    if (n > 30) continue;
    out.push({ key: 'b' + b.id, level: n < 0 ? 'warn' : 'info', icon: '🍼', title: `${animalLabel(b.animal)} — gözlənilən doğum`, subtitle: `${fmt(b.expected)} (${inDays(n)})`, href: `/animal/${b.animal.id}` });
  }
  const tasks = data.tasks
    .filter((x) => !x.done && x.due && x.due <= addDays(t, 7))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  for (const k of tasks) {
    const n = daysBetween(t, k.due!);
    out.push({ key: 't' + k.id, level: n < 0 ? 'warn' : 'info', icon: '📌', title: k.title, subtitle: `${fmt(k.due)} (${inDays(n)})`, href: '/tasks' });
  }
  for (const m of data.meds) {
    const s = medStatus(m);
    if (!s.expired && !s.soon && !s.low) continue;
    const parts: string[] = [];
    if (s.expired) parts.push(`son istifadə tarixi keçib (${fmt(m.expiry)})`);
    if (s.soon) parts.push(`son istifadə: ${fmt(m.expiry)} (${inDays(daysBetween(t, m.expiry!))})`);
    if (s.low) parts.push(`az qalıb: ${m.qty} ${m.unit}`);
    out.push({ key: 'm' + m.id, level: s.expired ? 'danger' : 'warn', icon: '🧴', title: `${m.name} — dərman şkafı`, subtitle: parts.join(' · '), href: '/meds' });
  }
  return out;
}

/* ---------- Hadisələr (tarixçə) ---------- */
export type EventKind = 'tr' | 'w' | 'b';
export interface AnimalEvent {
  kind: EventKind;
  id: string;
  animalId: string;
  date: string;
  icon: string;
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
    list.push({ kind: 'tr', id: e.id, animalId: e.animalId, date: e.date, icon: '💊', title: `${e.medicine}${e.dose ? ' · ' + e.dose : ''}`, subtitle: p.join(' · '), openBreeding: false });
  }
  for (const e of data.weights.filter(match)) {
    list.push({ kind: 'w', id: e.id, animalId: e.animalId, date: e.date, icon: '⚖️', title: `${e.kg} kq`, subtitle: '', openBreeding: false });
  }
  for (const e of data.breedings.filter(match)) {
    const sub = [e.sire ? `Ata: ${e.sire}` : '', `Gözlənilən doğum: ${fmt(e.expected)}`, e.outcome ? `Nəticə: ${e.outcome}` : ''].filter(Boolean).join(' · ');
    list.push({ kind: 'b', id: e.id, animalId: e.animalId, date: e.date, icon: '🧬', title: e.method === 'suni' ? 'Süni mayalanma' : 'Təbii cütləşmə', subtitle: sub, openBreeding: !e.outcome });
  }
  return list.sort((a, b) => b.date.localeCompare(a.date));
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
