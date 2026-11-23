/**
 * Ferma məlumatının mərkəzi store-u.
 *
 * - Məlumat yaddaşda saxlanılır və AsyncStorage-də keşlənir → tətbiq internetsiz açılır.
 * - Hər dəyişiklik dərhal ekranda görünür (optimistik yeniləmə) və "outbox" növbəsinə düşür.
 * - Növbə ardıcıl olaraq backend-ə göndərilir; şəbəkə xətasında saxlanılır və sonra təkrarlanır.
 * - Bütün yazılar id üzrə upsert/delete olduğu üçün təkrar göndərmək təhlükəsizdir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { isTransient, repo } from '../data';
import { isLocalPhoto } from '../data/mapping';
import { stockAfterUse } from '../domain/logic';
import { emptyFarmData, type Animal, type Breeding, type Farm, type FarmData, type Med, type TableName, type Task, type Treatment, type Weight } from '../domain/types';
import type { EventKind } from '../domain/logic';
import { dataUrlToFile, deleteLocal } from '../lib/files';

type Op =
  | { kind: 'upsert'; table: TableName; rows: unknown[] }
  | { kind: 'remove'; table: TableName; ids: string[] }
  | { kind: 'farm'; farm: Farm }
  | { kind: 'photo'; animalId: string; uri: string; oldRef: string | null }
  | { kind: 'deletePhoto'; ref: string };

export interface SyncStatus {
  /** İlk yükləmə gedir və keşdə məlumat yoxdur. */
  loading: boolean;
  syncing: boolean;
  /** Serverə göndərilməmiş dəyişikliklərin sayı. */
  pending: number;
  /** Son cəhddə server əlçatan idimi. */
  online: boolean;
  lastSync: number | null;
}

export interface Snapshot {
  data: FarmData;
  status: SyncStatus;
}

const RETRY_MS = 30_000;

class FarmStore {
  private snap: Snapshot = { data: emptyFarmData(), status: { loading: true, syncing: false, pending: 0, online: true, lastSync: null } };
  private outbox: Op[] = [];
  private userId: string | null = null;
  private listeners = new Set<() => void>();
  private errorListeners = new Set<(msg: string) => void>();
  private flushing: Promise<void> | null = null;
  /** Hər lokal dəyişiklikdə artır — yolda olan köhnə server cavabının yeni dəyişiklikləri əzməsinin qarşısını alır. */
  private version = 0;
  private resyncTimer: ReturnType<typeof setTimeout> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private appStateSub: { remove(): void } | null = null;

  /* ---------- abunəlik ---------- */
  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = () => this.snap;
  onError(cb: (msg: string) => void) {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }
  private emit(patch: { data?: FarmData; status?: Partial<SyncStatus> } = {}) {
    this.snap = {
      data: patch.data ?? this.snap.data,
      status: { ...this.snap.status, ...patch.status, pending: this.outbox.length },
    };
    this.listeners.forEach((l) => l());
  }
  private fail(msg: string) {
    this.errorListeners.forEach((l) => l(msg));
  }

  get data() {
    return this.snap.data;
  }

  /* ---------- həyat dövrü ---------- */
  private cacheKey = (user = this.userId) => `suru-cache:${repo.kind}:${user}`;
  private outboxKey = (user = this.userId) => `suru-outbox:${repo.kind}:${user}`;

  async start(userId: string) {
    if (this.userId === userId) return;
    this.stop();
    this.userId = userId;
    const [cache, outbox] = await Promise.all([AsyncStorage.getItem(this.cacheKey()), AsyncStorage.getItem(this.outboxKey())]);
    if (this.userId !== userId) return;
    this.outbox = outbox ? JSON.parse(outbox) : [];
    this.emit({ data: cache ? { ...emptyFarmData(), ...JSON.parse(cache) } : emptyFarmData(), status: { loading: !cache } });
    this.timer = setInterval(() => {
      if (this.outbox.length || !this.snap.status.online) void this.sync();
    }, RETRY_MS);
    this.appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void this.sync();
    });
    await this.sync();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.resyncTimer) clearTimeout(this.resyncTimer);
    this.resyncTimer = null;
    this.appStateSub?.remove();
    this.timer = null;
    this.appStateSub = null;
    this.userId = null;
    this.outbox = [];
    this.emit({ data: emptyFarmData(), status: { loading: true, syncing: false, online: true, lastSync: null } });
  }

  /** Növbəni göndərir, sonra serverdən təzə məlumatı çəkir. */
  async sync() {
    if (!this.userId) return;
    const user = this.userId;
    await this.flush();
    if (this.outbox.length || this.userId !== user) return;
    this.emit({ status: { syncing: true } });
    const startedAt = this.version;
    try {
      const data = await repo.loadAll();
      if (this.userId !== user) return;
      // Yükləmə gedərkən lokal dəyişiklik olubsa (yeni qeyd, bərpa, nümunə məlumat), bu cavab köhnədir —
      // onu atırıq və dəyişikliklər serverə çatandan sonra yenidən yükləyirik.
      if (this.outbox.length || this.version !== startedAt) {
        this.scheduleResync();
        return;
      }
      this.emit({ data, status: { loading: false, online: true, lastSync: Date.now() } });
      await this.persistCache();
    } catch (e) {
      if (!isTransient(e)) this.fail((e as Error).message);
      this.emit({ status: { online: false, loading: false } });
    } finally {
      this.emit({ status: { syncing: false } });
    }
  }

  private scheduleResync() {
    if (this.resyncTimer) clearTimeout(this.resyncTimer);
    this.resyncTimer = setTimeout(() => {
      this.resyncTimer = null;
      void this.sync();
    }, 1500);
  }

  private flush(): Promise<void> {
    if (!this.flushing) {
      this.flushing = this.doFlush().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async doFlush() {
    const user = this.userId;
    if (!this.outbox.length) return;
    this.emit({ status: { syncing: true } });
    try {
      while (this.outbox.length && this.userId === user) {
        const op = this.outbox[0];
        try {
          await this.exec(op);
        } catch (e) {
          if (isTransient(e)) {
            this.emit({ status: { online: false } });
            return;
          }
          // Qalıcı xəta (məs. icazə yoxdur) — əməliyyatı atıb istifadəçiyə bildiririk.
          this.fail(`Serverə yazılmadı: ${(e as Error).message}`);
        }
        this.outbox.shift();
        await this.persistOutbox();
        this.emit({ status: { online: true } });
      }
    } finally {
      this.emit({ status: { syncing: false } });
    }
  }

  private async exec(op: Op) {
    switch (op.kind) {
      case 'upsert':
        return repo.upsert(op.table, op.rows as never[]);
      case 'remove':
        return repo.remove(op.table, op.ids);
      case 'farm':
        return repo.updateFarm(op.farm);
      case 'deletePhoto':
        return repo.deletePhoto(op.ref);
      case 'photo': {
        const ref = await repo.uploadPhoto(op.animalId, op.uri);
        const a = this.data.animals.find((x) => x.id === op.animalId);
        if (a && a.photo === op.uri) {
          const updated = { ...a, photo: ref };
          await repo.upsert('animals', [updated]);
          this.emit({ data: { ...this.data, animals: this.data.animals.map((x) => (x.id === a.id ? updated : x)) } });
          await this.persistCache();
        } else if (ref !== op.uri) {
          // Heyvan silinib və ya şəkil yenidən dəyişib — yüklənən fayl lazım deyil.
          await repo.deletePhoto(ref);
        }
        if (op.oldRef && !isLocalPhoto(op.oldRef) && op.oldRef !== ref) await repo.deletePhoto(op.oldRef).catch(() => {});
        if (ref !== op.uri) deleteLocal(op.uri);
        return;
      }
    }
  }

  private persistCache() {
    if (!this.userId) return Promise.resolve();
    return AsyncStorage.setItem(this.cacheKey(), JSON.stringify(this.data)).catch(() => {});
  }
  private persistOutbox() {
    if (!this.userId) return Promise.resolve();
    return AsyncStorage.setItem(this.outboxKey(), JSON.stringify(this.outbox)).catch(() => {});
  }

  /** Lokal dəyişikliyi tətbiq edir və əməliyyatları növbəyə qoyur. */
  private commit(data: FarmData, ops: Op[]) {
    this.version++;
    this.outbox.push(...ops);
    this.emit({ data });
    void this.persistCache();
    void this.persistOutbox().then(() => this.flush());
  }

  /**
   * Hesabı serverdə silir, sonra cihazdakı keşi, göndərilməmiş növbəni və gözləyən şəkilləri təmizləyir.
   */
  async deleteAccount() {
    const user = this.userId;
    const pendingPhotos = this.outbox.flatMap((op) => (op.kind === 'photo' ? [op.uri] : []));
    const localPhotos = this.data.animals.map((a) => a.photo).filter((p): p is string => isLocalPhoto(p));
    await repo.deleteAccount();
    await AsyncStorage.multiRemove([this.cacheKey(user), this.outboxKey(user)]).catch(() => {});
    for (const uri of new Set([...pendingPhotos, ...localPhotos])) deleteLocal(uri);
    this.stop();
  }

  /* ---------- əməliyyatlar ---------- */
  saveFarm(farm: Farm) {
    this.commit({ ...this.data, farm }, [{ kind: 'farm', farm }]);
  }

  /**
   * @param photo undefined — dəyişməyib; string — yeni lokal şəkil; null — şəkil silinir.
   */
  saveAnimal(animal: Animal, photo?: string | null) {
    const prev = this.data.animals.find((a) => a.id === animal.id);
    const oldRef = prev?.photo ?? null;
    const ops: Op[] = [];
    let next = animal;
    if (photo === null) {
      next = { ...animal, photo: null };
      if (oldRef && !isLocalPhoto(oldRef)) ops.push({ kind: 'deletePhoto', ref: oldRef });
    } else if (typeof photo === 'string') {
      next = { ...animal, photo };
    }
    // Şəkil silinəndə photo=null serverə yazılır; yeni lokal fayl yolu isə göndərilmir (mapping.ts) —
    // istinad şəkil yüklənəndən sonra "photo" əməliyyatında yazılır.
    ops.unshift({ kind: 'upsert', table: 'animals', rows: [next] });
    if (typeof photo === 'string') ops.push({ kind: 'photo', animalId: animal.id, uri: photo, oldRef });
    const animals = prev ? this.data.animals.map((a) => (a.id === animal.id ? next : a)) : [...this.data.animals, next];
    this.commit({ ...this.data, animals }, ops);
  }

  deleteAnimal(id: string) {
    const d = this.data;
    const a = d.animals.find((x) => x.id === id);
    if (a?.photo && isLocalPhoto(a.photo)) deleteLocal(a.photo);
    this.commit(
      {
        ...d,
        animals: d.animals.filter((x) => x.id !== id),
        treatments: d.treatments.filter((x) => x.animalId !== id),
        weights: d.weights.filter((x) => x.animalId !== id),
        breedings: d.breedings.filter((x) => x.animalId !== id),
      },
      [{ kind: 'remove', table: 'animals', ids: [id] }],
    );
  }

  /** Müalicə(lər)i yazır və istəyə görə dərmanı şkafdan çıxır. Xəbərdarlıq mətnini qaytarır. */
  addTreatments(rows: Treatment[], stock?: { med: Med; amount: number }): string {
    const ops: Op[] = [{ kind: 'upsert', table: 'treatments', rows }];
    let meds = this.data.meds;
    let note = '';
    if (stock && stock.amount > 0) {
      const r = stockAfterUse(stock.med, stock.amount);
      note = r.note;
      const updated = { ...stock.med, qty: r.qty };
      meds = meds.map((m) => (m.id === updated.id ? updated : m));
      ops.push({ kind: 'upsert', table: 'meds', rows: [updated] });
    }
    this.commit({ ...this.data, treatments: [...this.data.treatments, ...rows], meds }, ops);
    return note;
  }

  addWeight(w: Weight) {
    this.commit({ ...this.data, weights: [...this.data.weights, w] }, [{ kind: 'upsert', table: 'weights', rows: [w] }]);
  }

  saveBreeding(b: Breeding) {
    const exists = this.data.breedings.some((x) => x.id === b.id);
    const breedings = exists ? this.data.breedings.map((x) => (x.id === b.id ? b : x)) : [...this.data.breedings, b];
    this.commit({ ...this.data, breedings }, [{ kind: 'upsert', table: 'breedings', rows: [b] }]);
  }

  deleteEvent(kind: EventKind, id: string) {
    const table = ({ tr: 'treatments', w: 'weights', b: 'breedings' } as const)[kind];
    this.commit({ ...this.data, [table]: (this.data[table] as { id: string }[]).filter((x) => x.id !== id) }, [{ kind: 'remove', table, ids: [id] }]);
  }

  saveMed(m: Med) {
    const exists = this.data.meds.some((x) => x.id === m.id);
    const meds = exists ? this.data.meds.map((x) => (x.id === m.id ? m : x)) : [...this.data.meds, m];
    this.commit({ ...this.data, meds }, [{ kind: 'upsert', table: 'meds', rows: [m] }]);
  }

  deleteMed(id: string) {
    this.commit({ ...this.data, meds: this.data.meds.filter((x) => x.id !== id) }, [{ kind: 'remove', table: 'meds', ids: [id] }]);
  }

  saveTask(t: Task) {
    const exists = this.data.tasks.some((x) => x.id === t.id);
    const tasks = exists ? this.data.tasks.map((x) => (x.id === t.id ? t : x)) : [...this.data.tasks, t];
    this.commit({ ...this.data, tasks }, [{ kind: 'upsert', table: 'tasks', rows: [t] }]);
  }

  deleteTask(id: string) {
    this.commit({ ...this.data, tasks: this.data.tasks.filter((x) => x.id !== id) }, [{ kind: 'remove', table: 'tasks', ids: [id] }]);
  }

  /**
   * Bütün məlumatı əvəz edir (bərpa, köçürmə, nümunə məlumat, silmə). İnternet tələb edir.
   * @param photos heyvan id-si → data:image URL (köhnə PWA ehtiyat nüsxəsindən)
   */
  async replaceAll(data: FarmData, photos: Record<string, string> = {}) {
    await this.flush();
    if (this.outbox.length) throw new Error('Göndərilməmiş dəyişikliklər var — internetə qoşulub yenidən cəhd edin');
    for (const a of this.data.animals) if (a.photo && isLocalPhoto(a.photo)) deleteLocal(a.photo);
    this.version++;
    await repo.replaceAll(data);
    const ops: Op[] = [];
    const animals = [...data.animals];
    for (const [animalId, dataUrl] of Object.entries(photos)) {
      const i = animals.findIndex((a) => a.id === animalId);
      if (i < 0) continue;
      try {
        const uri = await dataUrlToFile(dataUrl);
        animals[i] = { ...animals[i], photo: uri };
        ops.push({ kind: 'photo', animalId, uri, oldRef: null });
      } catch {
        /* şəkil oxunmadı — ötürülür */
      }
    }
    this.commit({ ...data, animals }, ops);
  }
}

export const farmStore = new FarmStore();

export function useFarm(): Snapshot {
  return useSyncExternalStore(farmStore.subscribe, farmStore.getSnapshot, farmStore.getSnapshot);
}
