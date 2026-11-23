/**
 * Ehtiyat nüsxə, köhnə PWA-dan köçürmə və nümunə məlumat.
 */
import { isUUID, uid } from '../lib/id';
import { SPECIES } from './constants';
import { addDays, isISODate, todayISO } from './dates';
import { emptyFarmData, type Animal, type AnimalStatus, type FarmData, type SpeciesKey } from './types';

export const BACKUP_FORMAT = 'suru-backup';
export const BACKUP_VERSION = 2;

export function makeBackup(data: FarmData) {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export interface ImportResult {
  data: FarmData;
  /** Köhnə PWA ehtiyat nüsxəsindəki şəkillər: yeni heyvan id-si → data:image/... URL */
  photos: Record<string, string>;
}

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const date = (v: unknown) => (isISODate(v) ? v : null);

/**
 * Həm yeni (v2) ehtiyat nüsxəni, həm də köhnə PWA-nın JSON faylını qəbul edir.
 * UUID olmayan köhnə id-lər yeni UUID-lərlə əvəz olunur, əlaqələr qorunur.
 */
export function parseBackup(raw: unknown): ImportResult {
  if (!raw || typeof raw !== 'object') throw new Error('format');
  const obj = raw as Record<string, any>;
  const src: Record<string, any> = obj.format === BACKUP_FORMAT ? obj.data : obj;
  if (!src || !Array.isArray(src.animals)) throw new Error('format');

  const idMap = new Map<string, string>();
  const mapId = (old: unknown) => {
    const k = str(old);
    if (!k) return uid();
    if (!idMap.has(k)) idMap.set(k, isUUID(k) ? k : uid());
    return idMap.get(k)!;
  };
  const arr = (k: string): any[] => (Array.isArray(src[k]) ? src[k] : []);

  const out = emptyFarmData();
  const f = src.farm ?? {};
  out.farm = { name: str(f.name) || out.farm.name, owner: str(f.owner), region: str(f.region) };

  const legacyPhotos: Record<string, string> = obj.photos && typeof obj.photos === 'object' ? obj.photos : {};
  const photos: Record<string, string> = {};

  for (const a of arr('animals')) {
    const id = mapId(a.id);
    const species: SpeciesKey = a.species in SPECIES ? a.species : 'inek';
    const status: AnimalStatus = ['aktiv', 'satilib', 'olub', 'kesilib', 'kocurulub'].includes(a.status) ? a.status : 'aktiv';
    const legacy = legacyPhotos[str(a.id)];
    if (typeof legacy === 'string' && legacy.startsWith('data:image/')) photos[id] = legacy;
    out.animals.push({
      id,
      tag: str(a.tag).trim() || '—',
      name: str(a.name),
      species,
      breed: str(a.breed),
      sex: a.sex === 'e' ? 'e' : 'd',
      dob: date(a.dob),
      damTag: str(a.damTag),
      group: str(a.group),
      status,
      notes: str(a.notes),
      // Köhnə lokal istinadlar etibarsızdır; şəkil varsa ayrıca yüklənəcək.
      photo: typeof a.photo === 'string' && !a.photo.startsWith('file:') && !a.photo.startsWith('data:') ? a.photo : null,
      createdAt: date(a.createdAt) ?? todayISO(),
    });
  }
  const known = new Set(out.animals.map((a) => a.id));
  const animalRef = (v: unknown) => {
    const id = idMap.get(str(v));
    return id && known.has(id) ? id : null;
  };

  for (const t of arr('treatments')) {
    const animalId = animalRef(t.animalId);
    if (!animalId || !isISODate(t.date)) continue;
    out.treatments.push({
      id: mapId(t.id), animalId, batchId: t.batchId ? mapId(t.batchId) : null, date: t.date,
      medicine: str(t.medicine), dose: str(t.dose), reason: str(t.reason), meatWd: num(t.meatWd), milkWd: num(t.milkWd),
    });
  }
  for (const w of arr('weights')) {
    const animalId = animalRef(w.animalId);
    if (!animalId || !isISODate(w.date) || !(num(w.kg) > 0)) continue;
    out.weights.push({ id: mapId(w.id), animalId, date: w.date, kg: num(w.kg) });
  }
  for (const b of arr('breedings')) {
    const animalId = animalRef(b.animalId);
    if (!animalId || !isISODate(b.date)) continue;
    const a = out.animals.find((x) => x.id === animalId)!;
    out.breedings.push({
      id: mapId(b.id), animalId, date: b.date, method: b.method === 'tebii' ? 'tebii' : 'suni', sire: str(b.sire),
      expected: date(b.expected) ?? addDays(b.date, SPECIES[a.species].gest), outcome: str(b.outcome),
    });
  }
  for (const k of arr('tasks')) {
    if (!str(k.title).trim()) continue;
    out.tasks.push({ id: mapId(k.id), title: str(k.title).trim(), due: date(k.due), done: !!k.done });
  }
  for (const m of arr('meds')) {
    if (!str(m.name).trim()) continue;
    out.meds.push({
      id: mapId(m.id), name: str(m.name).trim(), qty: num(m.qty), unit: str(m.unit) || 'ml', minQty: num(m.minQty),
      expiry: date(m.expiry), meatWd: num(m.meatWd), milkWd: num(m.milkWd), notes: str(m.notes),
    });
  }
  const breedingIds = new Set(out.breedings.map((b) => b.id));
  for (const p of arr('pregChecks')) {
    const animalId = animalRef(p.animalId);
    if (!animalId || !isISODate(p.date)) continue;
    const bid = p.breedingId ? idMap.get(str(p.breedingId)) : undefined;
    out.pregChecks.push({
      id: mapId(p.id), animalId, breedingId: bid && breedingIds.has(bid) ? bid : null, date: p.date,
      result: ['positive', 'negative', 'uncertain'].includes(p.result) ? p.result : 'uncertain',
      fetuses: Math.max(0, Math.min(6, Math.round(num(p.fetuses)))), method: p.method === 'manual' ? 'manual' : 'scan', notes: str(p.notes),
    });
  }
  for (const h of arr('heats')) {
    const animalId = animalRef(h.animalId);
    if (!animalId || !isISODate(h.date)) continue;
    out.heats.push({ id: mapId(h.id), animalId, date: h.date, notes: str(h.notes) });
  }
  for (const m of arr('movements')) {
    const animalId = animalRef(m.animalId);
    if (!animalId || !isISODate(m.date) || !['purchase', 'sale', 'move_out', 'slaughter', 'death'].includes(m.type)) continue;
    out.movements.push({
      id: mapId(m.id), animalId, date: m.date, type: m.type, counterparty: str(m.counterparty),
      price: Math.max(0, num(m.price)), weight: Math.max(0, num(m.weight)), notes: str(m.notes),
    });
  }
  return { data: out, photos };
}

/** Tətbiqi sınamaq üçün nümunə ferma. */
export function demoData(): FarmData {
  const t = todayISO();
  const d = (n: number) => addDays(t, n);
  const s = emptyFarmData();
  s.farm = { name: 'Qarabağ Ailə Ferması', owner: 'Nümunə fermer', region: 'Ağcabədi' };
  const mk = (o: Partial<Animal> & Pick<Animal, 'tag' | 'species' | 'breed' | 'sex'>) => {
    const a: Animal = { id: uid(), createdAt: t, status: 'aktiv', name: '', dob: null, damTag: '', group: '', notes: '', photo: null, ...o };
    s.animals.push(a);
    return a;
  };
  const maral = mk({ tag: 'AZ 1001', name: 'Maral', species: 'inek', breed: 'Qafqaz qonuru', sex: 'd', dob: d(-365 * 5), group: 'Sağmal' });
  const ceyran = mk({ tag: 'AZ 1002', name: 'Ceyran', species: 'inek', breed: 'Simmental', sex: 'd', dob: d(-365 * 4 - 40), group: 'Sağmal' });
  const qaraca = mk({ tag: 'AZ 1003', name: 'Qaraca', species: 'inek', breed: 'Holşteyn', sex: 'd', dob: d(-365 * 3), group: 'Sağmal' });
  const buzov = mk({ tag: 'AZ 1004', species: 'inek', breed: 'Qafqaz qonuru', sex: 'e', dob: d(-150), damTag: 'AZ 1001', group: 'Buzovlar' });
  mk({ tag: 'AZ 1005', name: 'Polad', species: 'inek', breed: 'Simmental', sex: 'e', dob: d(-365 * 2), group: 'Kökəltmə' });
  mk({ tag: 'AZ 2001', species: 'camis', breed: 'Azərbaycan camışı', sex: 'd', dob: d(-365 * 6), group: 'Sağmal' });
  for (let i = 1; i <= 6; i++) {
    mk({ tag: `Q-${300 + i}`, species: 'qoyun', breed: i % 2 ? 'Qarabağ' : 'Balbas', sex: i === 6 ? 'e' : 'd', dob: d(-365 * 2 - i * 20), group: 'Sürü 1' });
  }
  const keci = mk({ tag: 'K-501', species: 'keci', breed: 'Yerli', sex: 'd', dob: d(-700) });
  const satilan = mk({ tag: 'AZ 1006', species: 'inek', breed: 'Simmental', sex: 'e', dob: d(-365 * 2 - 90), group: 'Kökəltmə', status: 'satilib' });

  const tr = (o: Omit<FarmData['treatments'][number], 'id' | 'batchId'>) => s.treatments.push({ id: uid(), batchId: null, ...o });
  tr({ animalId: ceyran.id, date: d(-2), medicine: 'Penisilin', dose: '20 ml', reason: 'Mastit', meatWd: 10, milkWd: 4 });
  tr({ animalId: maral.id, date: d(-40), medicine: 'Şap peyvəndi', dose: '2 ml', reason: 'Peyvənd', meatWd: 0, milkWd: 0 });
  s.weights.push({ id: uid(), animalId: buzov.id, date: d(-150), kg: 32 });
  s.weights.push({ id: uid(), animalId: buzov.id, date: d(-90), kg: 78 });
  s.weights.push({ id: uid(), animalId: buzov.id, date: d(-5), kg: 141 });
  s.breedings.push({ id: uid(), animalId: maral.id, date: d(-270), method: 'suni', sire: 'SIM-2231', expected: d(13), outcome: '' });
  const qb = { id: uid(), animalId: qaraca.id, date: d(-60), method: 'tebii' as const, sire: 'AZ 1005', expected: d(223), outcome: '' };
  s.breedings.push(qb);
  s.pregChecks.push({ id: uid(), animalId: qaraca.id, breedingId: qb.id, date: d(-20), result: 'positive', fetuses: 1, method: 'scan', notes: '' });
  // Ceyran: 40 gün əvvəl mayalanıb, hələ yoxlanmayıb → paneldə "yoxlama vaxtıdır"
  s.breedings.push({ id: uid(), animalId: ceyran.id, date: d(-40), method: 'suni', sire: 'HOL-1180', expected: d(243), outcome: '' });
  // Keçi: 19 gün əvvəl qızğınlıq → 2 gün sonra növbəti gözlənilir
  s.heats.push({ id: uid(), animalId: keci.id, date: d(-19), notes: '' });
  s.movements.push({ id: uid(), animalId: maral.id, date: d(-365 * 3), type: 'purchase', counterparty: 'Ağcabədi heyvan bazarı', price: 2400, weight: 0, notes: '' });
  s.movements.push({ id: uid(), animalId: satilan.id, date: d(-12), type: 'sale', counterparty: 'Yerli qəssab', price: 3100, weight: 465, notes: '' });
  s.tasks.push({ id: uid(), title: 'Qoyunlara parazit dərmanı', due: d(1), done: false });
  s.tasks.push({ id: uid(), title: 'Baytar çağır — Ceyranın yoxlanışı', due: d(3), done: false });
  s.tasks.push({ id: uid(), title: 'Yem sifarişi (qarğıdalı silosu)', due: d(-1), done: false });
  s.meds.push({ id: uid(), name: 'Penisilin', qty: 80, unit: 'ml', minQty: 50, expiry: d(240), meatWd: 10, milkWd: 4, notes: '' });
  s.meds.push({ id: uid(), name: 'İvermektin 1%', qty: 30, unit: 'ml', minQty: 50, expiry: d(20), meatWd: 28, milkWd: 0, notes: 'Sağmal heyvanlara vurulmur' });
  s.meds.push({ id: uid(), name: 'Şap peyvəndi', qty: 18, unit: 'doza', minQty: 5, expiry: d(150), meatWd: 0, milkWd: 0, notes: 'Soyuducuda saxla' });
  return s;
}
