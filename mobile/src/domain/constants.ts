import type { AnimalStatus, MovementType, ScanResult, SpeciesKey } from './types';

/** UI ikon açarları (src/ui/iconPaths.ts). Domen yalnız adı daşıyır, çəkmək UI-nin işidir. */
export type IconKey = 'cow' | 'buffalo' | 'sheep' | 'goat' | 'pill' | 'weight' | 'dna' | 'baby-bottle' | 'calendar-clock' | 'medical-bag'
  | 'scan' | 'heat' | 'cart-in' | 'cart-out' | 'truck' | 'knife' | 'cross' | 'feed' | 'milk';

export interface SpeciesInfo {
  label: string;
  plural: string;
  icon: IconKey;
  /** Boğazlıq müddəti (gün) — gözlənilən doğum tarixi üçün. */
  gest: number;
  /** Qızğınlıq tsikli (gün) — növbəti qızğınlıq xatırlatması üçün. */
  cycle: number;
  /** Mayalanmadan neçə gün sonra boğazlıq yoxlaması tövsiyə olunur. */
  scanAfter: number;
  breeds: string[];
}

export const SPECIES: Record<SpeciesKey, SpeciesInfo> = {
  inek: { label: 'İnək', plural: 'inəklər', icon: 'cow', gest: 283, cycle: 21, scanAfter: 35, breeds: ['Qafqaz qonuru', 'Holşteyn', 'Simmental', 'Şvis', 'Yerli', 'Digər'] },
  camis: { label: 'Camış', plural: 'camışlar', icon: 'buffalo', gest: 310, cycle: 21, scanAfter: 40, breeds: ['Azərbaycan camışı', 'Digər'] },
  qoyun: { label: 'Qoyun', plural: 'qoyunlar', icon: 'sheep', gest: 147, cycle: 17, scanAfter: 45, breeds: ['Qarabağ', 'Balbas', 'Bozah', 'Qala', 'Merinos', 'Digər'] },
  keci: { label: 'Keçi', plural: 'keçilər', icon: 'goat', gest: 150, cycle: 21, scanAfter: 45, breeds: ['Yerli', 'Zaanen', 'Alp', 'Digər'] },
};
export const SPECIES_KEYS = Object.keys(SPECIES) as SpeciesKey[];

export const STATUS: Record<AnimalStatus, string> = {
  aktiv: 'Aktiv',
  satilib: 'Satılıb',
  olub: 'Ölüb',
  kesilib: 'Kəsilib',
  kocurulub: 'Köçürülüb',
};

export const MED_UNITS = ['ml', 'doza', 'ədəd', 'tablet', 'q', 'şüşə'];

export const OUTCOMES = ['Doğdu', 'Boş çıxdı (təkrar mayalanma)', 'Bala saldı (abort)'];

export const SCAN_RESULT: Record<ScanResult, string> = {
  positive: 'Boğazdır',
  negative: 'Boşdur',
  uncertain: 'Dəqiq deyil',
};

export interface MovementInfo {
  label: string;
  /** Fermadan çıxışdırsa heyvanın yeni statusu. */
  status: AnimalStatus | null;
  icon: IconKey;
  /** Qarşı tərəf sahəsinin adı. */
  party: string;
}
export const MOVEMENT: Record<MovementType, MovementInfo> = {
  purchase: { label: 'Alış', status: null, icon: 'cart-in', party: 'Satıcı' },
  sale: { label: 'Satış', status: 'satilib', icon: 'cart-out', party: 'Alıcı' },
  move_out: { label: 'Köçürmə', status: 'kocurulub', icon: 'truck', party: 'Hara (ferma, otlaq…)' },
  slaughter: { label: 'Kəsim', status: 'kesilib', icon: 'knife', party: 'Kəsim yeri' },
  death: { label: 'Ölüm', status: 'olub', icon: 'cross', party: 'Səbəb' },
};
export const EXIT_TYPES: MovementType[] = ['sale', 'move_out', 'slaughter', 'death'];

export const FEED_UNITS = ['kq', 'ton', 'kisə', 'tay', 'bağlama', 'litr'];
