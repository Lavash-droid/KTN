import type { AnimalStatus, SpeciesKey } from './types';

export interface SpeciesInfo {
  label: string;
  plural: string;
  icon: string;
  /** Boğazlıq müddəti (gün) — gözlənilən doğum tarixi üçün. */
  gest: number;
  breeds: string[];
}

export const SPECIES: Record<SpeciesKey, SpeciesInfo> = {
  inek: { label: 'İnək', plural: 'inəklər', icon: '🐄', gest: 283, breeds: ['Qafqaz qonuru', 'Holşteyn', 'Simmental', 'Şvis', 'Yerli', 'Digər'] },
  camis: { label: 'Camış', plural: 'camışlar', icon: '🐃', gest: 310, breeds: ['Azərbaycan camışı', 'Digər'] },
  qoyun: { label: 'Qoyun', plural: 'qoyunlar', icon: '🐑', gest: 147, breeds: ['Qarabağ', 'Balbas', 'Bozah', 'Qala', 'Merinos', 'Digər'] },
  keci: { label: 'Keçi', plural: 'keçilər', icon: '🐐', gest: 150, breeds: ['Yerli', 'Zaanen', 'Alp', 'Digər'] },
};
export const SPECIES_KEYS = Object.keys(SPECIES) as SpeciesKey[];

export const STATUS: Record<AnimalStatus, string> = {
  aktiv: 'Aktiv',
  satilib: 'Satılıb',
  olub: 'Ölüb',
  kesilib: 'Kəsilib',
};

export const MED_UNITS = ['ml', 'doza', 'ədəd', 'tablet', 'q', 'şüşə'];

export const OUTCOMES = ['Doğdu', 'Boş çıxdı (təkrar mayalanma)', 'Bala saldı (abort)'];
