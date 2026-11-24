/** Domen modelləri (camelCase) ↔ verilənlər bazası sətirləri (snake_case). */
import type { TableName, Tables } from '../domain/types';

/** Ümumi qaydadan fərqlənən sahə adları. */
const OVERRIDES: Record<string, string> = { group: 'group_name', photo: 'photo_path' };
const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(OVERRIDES).map(([k, v]) => [v, k]));

const toSnake = (k: string) => OVERRIDES[k] ?? k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const toCamel = (k: string) => REVERSE[k] ?? k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Hər cədvəlin domen sahələri (verilənlər bazasından gələn əlavə sütunlar atılır). */
const FIELDS: { [T in TableName]: (keyof Tables[T])[] } = {
  animals: ['id', 'tag', 'name', 'species', 'breed', 'sex', 'dob', 'damTag', 'group', 'status', 'notes', 'photo', 'createdAt'],
  treatments: ['id', 'animalId', 'batchId', 'date', 'medicine', 'dose', 'reason', 'meatWd', 'milkWd'],
  weights: ['id', 'animalId', 'date', 'kg'],
  breedings: ['id', 'animalId', 'date', 'method', 'sire', 'expected', 'outcome'],
  tasks: ['id', 'title', 'due', 'done'],
  meds: ['id', 'name', 'qty', 'unit', 'minQty', 'expiry', 'meatWd', 'milkWd', 'notes'],
  pregChecks: ['id', 'animalId', 'breedingId', 'date', 'result', 'fetuses', 'method', 'notes'],
  heats: ['id', 'animalId', 'date', 'notes'],
  movements: ['id', 'animalId', 'date', 'type', 'counterparty', 'price', 'weight', 'notes'],
  feeds: ['id', 'name', 'qty', 'unit', 'minQty', 'notes'],
  purchases: ['id', 'kind', 'itemId', 'itemName', 'date', 'qty', 'unit', 'price', 'supplier', 'batch', 'expiry', 'notes'],
  milkRecords: ['id', 'date', 'liters', 'fat', 'protein', 'scc', 'buyer', 'price', 'notes'],
  govReports: ['id', 'agency', 'date', 'status', 'method', 'reference', 'itemKeys', 'notes'],
};

/** Domen cədvəl adı → verilənlər bazası cədvəli. */
const DB_TABLES: Partial<Record<TableName, string>> = { pregChecks: 'preg_checks', milkRecords: 'milk_records', govReports: 'gov_reports' };
export const dbTable = (t: TableName): string => DB_TABLES[t] ?? t;
const NUMERIC = new Set(['meatWd', 'milkWd', 'kg', 'qty', 'minQty', 'price', 'weight', 'fetuses', 'liters', 'fat', 'protein', 'scc']);
/** 0 = bilinmir → bazada NULL (məs. qiymət, çəki, döl sayı). */
const ZERO_AS_NULL = new Set(['price', 'weight', 'fetuses', 'fat', 'protein', 'scc']);
const DATES = new Set(['dob', 'date', 'expected', 'due', 'expiry', 'createdAt']);

/** Lokal (hələ yüklənməmiş) şəkil istinadı. */
export const isLocalPhoto = (ref: string | null | undefined) =>
  !!ref && /^(file|data|blob|content|ph|assets-library):/.test(ref);

export function toRow<T extends TableName>(table: T, item: Tables[T], extra: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = { ...extra };
  for (const k of FIELDS[table] as string[]) {
    let v = (item as unknown as Record<string, unknown>)[k];
    if (DATES.has(k) && v === '') v = null;
    // Lokal şəkil yolu serverə göndərilmir — şəkil yüklənəndən sonra istinad ayrıca yazılır.
    if (k === 'photo' && isLocalPhoto(v as string)) continue;
    if (ZERO_AS_NULL.has(k) && !v) v = null;
    row[toSnake(k)] = v ?? null;
  }
  return row;
}

export function fromRow<T extends TableName>(table: T, row: Record<string, unknown>): Tables[T] {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS[table] as string[]) {
    const v = row[toSnake(k)];
    if (NUMERIC.has(k)) out[k] = Number(v) || 0;
    else if (DATES.has(k)) out[k] = typeof v === 'string' ? v.slice(0, 10) : null;
    else if (k === 'done') out[k] = !!v;
    else if (k === 'itemKeys') out[k] = Array.isArray(v) ? v.map(String) : [];
    else if (k === 'batchId' || k === 'photo' || k === 'breedingId' || k === 'itemId') out[k] = v ?? null;
    else out[k] = v ?? '';
  }
  return out as unknown as Tables[T];
}

export { toCamel, toSnake };
