/** Tarix köməkçiləri. Bütün tarixlər YYYY-MM-DD formatında, saat qurşağından asılı olmadan hesablanır. */

export function todayISO(): string {
  return toISO(new Date());
}

/** Cihazın yerli tarixini YYYY-MM-DD-yə çevirir. */
export function toISO(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD → yerli gün ortası (tarix seçicisi üçün). */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function parseISO(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  return new Date(parseISO(iso) + n * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export function isISODate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function age(dob: string | null): string {
  if (!dob) return '';
  const days = daysBetween(dob, todayISO());
  if (days < 0) return '';
  if (days < 60) return `${days} gün`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} ay`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} il ${m} ay` : `${y} il`;
}

export function inDays(n: number): string {
  if (n === 0) return 'bu gün';
  if (n === 1) return 'sabah';
  if (n > 0) return `${n} gün sonra`;
  if (n === -1) return 'dünən';
  return `${-n} gün əvvəl`;
}
