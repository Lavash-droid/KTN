/**
 * Yalnız cihazda işləyən backend (server yoxdur). Supabase açarları təyin olunmayanda
 * istifadə olunur — tətbiqi sınamaq və inkişaf üçün.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyFarmData, normalizeFarmData, type Farm, type FarmData, type TableName, type Tables } from '../../domain/types';
import { GOV_OFFLINE, RepoError, type AuthApi, type FarmRepository, type GovApi, type Session } from '../repository';

const DATA_KEY = 'suru-local-db';
const SESSION: Session = { userId: 'local', email: null };

export class LocalRepository implements FarmRepository {
  readonly kind = 'local' as const;
  readonly auth: AuthApi = {
    getSession: async () => SESSION,
    onChange: () => () => {},
    signIn: async () => {},
    signUp: async () => ({ needsConfirmation: false }),
    signOut: async () => {},
    mygovStartUrl: () => null,
    completeMygov: async () => {},
    mygovAvailable: async () => false,
  };
  /** Serversiz rejimdə birbaşa göndəriş yoxdur — hesabat fayl kimi ixrac olunur. */
  readonly gov: GovApi = {
    status: async () => GOV_OFFLINE,
    submit: async () => {
      throw new RepoError('Birbaşa göndəriş üçün hesabla daxil olun', false);
    },
  };

  private async read(): Promise<FarmData> {
    const raw = await AsyncStorage.getItem(DATA_KEY);
    return raw ? normalizeFarmData(JSON.parse(raw)) : emptyFarmData();
  }
  private write(d: FarmData) {
    return AsyncStorage.setItem(DATA_KEY, JSON.stringify(d));
  }

  loadAll() {
    return this.read();
  }

  async updateFarm(farm: Farm) {
    const d = await this.read();
    d.farm = farm;
    await this.write(d);
  }

  async upsert<T extends TableName>(table: T, rows: Tables[T][]) {
    const d = await this.read();
    const list = d[table] as Tables[T][];
    for (const r of rows) {
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = r;
      else list.push(r);
    }
    await this.write(d);
  }

  async remove(table: TableName, ids: string[]) {
    const d = await this.read();
    const set = new Set(ids);
    (d[table] as { id: string }[]) = (d[table] as { id: string }[]).filter((x) => !set.has(x.id));
    if (table === 'animals') {
      d.treatments = d.treatments.filter((x) => !set.has(x.animalId));
      d.weights = d.weights.filter((x) => !set.has(x.animalId));
      d.breedings = d.breedings.filter((x) => !set.has(x.animalId));
      d.pregChecks = d.pregChecks.filter((x) => !set.has(x.animalId));
      d.heats = d.heats.filter((x) => !set.has(x.animalId));
      d.movements = d.movements.filter((x) => !set.has(x.animalId));
    }
    await this.write(d);
  }

  /** Lokal rejimdə şəkil cihazda qalır — istinad faylın özüdür. */
  async uploadPhoto(_animalId: string, localUri: string) {
    return localUri;
  }
  async photoUrl(ref: string) {
    return ref;
  }
  async deletePhoto() {}

  async replaceAll(data: FarmData) {
    await this.write(data);
  }

  /** Lokal rejimdə hesab yoxdur — cihazdakı məlumat silinir. */
  async deleteAccount() {
    await AsyncStorage.removeItem(DATA_KEY);
  }
}
