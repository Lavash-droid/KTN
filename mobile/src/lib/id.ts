import * as Crypto from 'expo-crypto';

/** Qeydlər üçün UUID. İdentifikatoru cihazda yaratmaq internetsiz yazmağa imkan verir. */
export const uid = (): string => Crypto.randomUUID();

export const isUUID = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
