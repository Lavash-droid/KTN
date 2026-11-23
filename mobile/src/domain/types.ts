/**
 * Sürü domen modelləri.
 *
 * Bu tiplər backend-dən asılı deyil: Supabase, daxili server (REST) və lokal rejim
 * eyni modellərlə işləyir. Mətn sahələri boş ola bilər (''), tarix sahələri isə
 * boş olanda `null` olur (format: YYYY-MM-DD).
 */

export type SpeciesKey = 'inek' | 'camis' | 'qoyun' | 'keci';
export type Sex = 'd' | 'e';
export type AnimalStatus = 'aktiv' | 'satilib' | 'olub' | 'kesilib' | 'kocurulub';
export type ScanResult = 'positive' | 'negative' | 'uncertain';
export type MovementType = 'purchase' | 'sale' | 'move_out' | 'slaughter' | 'death';
export type BreedingMethod = 'suni' | 'tebii';

export interface Farm {
  name: string;
  owner: string;
  region: string;
}

export interface Animal {
  id: string;
  tag: string;
  name: string;
  species: SpeciesKey;
  breed: string;
  sex: Sex;
  dob: string | null;
  damTag: string;
  group: string;
  status: AnimalStatus;
  notes: string;
  /** Şəkil: backend-də saxlanılan istinad (məs. Storage yolu) və ya hələ yüklənməmiş lokal fayl (file://…). */
  photo: string | null;
  createdAt: string;
}

export interface Treatment {
  id: string;
  animalId: string;
  /** Qrup müalicəsində eyni partiyanın qeydlərini birləşdirir. */
  batchId: string | null;
  date: string;
  medicine: string;
  dose: string;
  reason: string;
  meatWd: number;
  milkWd: number;
}

export interface Weight {
  id: string;
  animalId: string;
  date: string;
  kg: number;
}

export interface Breeding {
  id: string;
  animalId: string;
  date: string;
  method: BreedingMethod;
  sire: string;
  expected: string;
  outcome: string;
}

export interface Task {
  id: string;
  title: string;
  due: string | null;
  done: boolean;
}

export interface Med {
  id: string;
  name: string;
  qty: number;
  unit: string;
  minQty: number;
  expiry: string | null;
  meatWd: number;
  milkWd: number;
  notes: string;
}

/** Boğazlıq yoxlaması (USM və ya əl ilə). */
export interface PregCheck {
  id: string;
  animalId: string;
  /** Yoxlanılan mayalanma (varsa). */
  breedingId: string | null;
  date: string;
  result: ScanResult;
  /** Döl sayı (qoyun/keçidə əkiz-üçəm üçün vacibdir); bilinmirsə 0. */
  fetuses: number;
  method: 'scan' | 'manual';
  notes: string;
}

/** Qızğınlıq müşahidəsi. */
export interface Heat {
  id: string;
  animalId: string;
  date: string;
  notes: string;
}

/** Heyvanın fermaya girişi (alış) və ya çıxışı (satış, köçürmə, kəsim, ölüm). */
export interface Movement {
  id: string;
  animalId: string;
  date: string;
  type: MovementType;
  /** Alıcı, satıcı və ya köçürüldüyü yer. */
  counterparty: string;
  /** AZN; bilinmirsə 0. */
  price: number;
  /** kq; bilinmirsə 0. */
  weight: number;
  notes: string;
}

export interface FarmData {
  farm: Farm;
  animals: Animal[];
  treatments: Treatment[];
  weights: Weight[];
  breedings: Breeding[];
  tasks: Task[];
  meds: Med[];
  pregChecks: PregCheck[];
  heats: Heat[];
  movements: Movement[];
}

/** Backend-də ayrıca cədvəl/kolleksiya kimi saxlanılan qeydlər. */
export interface Tables {
  animals: Animal;
  treatments: Treatment;
  weights: Weight;
  breedings: Breeding;
  tasks: Task;
  meds: Med;
  pregChecks: PregCheck;
  heats: Heat;
  movements: Movement;
}
export type TableName = keyof Tables;
/** Sıra vacibdir: əvvəl heyvanlar və mayalanmalar, sonra onlara istinad edən qeydlər. */
export const TABLES: TableName[] = ['animals', 'meds', 'treatments', 'weights', 'breedings', 'tasks', 'pregChecks', 'heats', 'movements'];

export const emptyFarmData = (): FarmData => ({
  farm: { name: 'Mənim fermam', owner: '', region: '' },
  animals: [],
  treatments: [],
  weights: [],
  breedings: [],
  tasks: [],
  meds: [],
  pregChecks: [],
  heats: [],
  movements: [],
});
