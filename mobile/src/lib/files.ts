/** Fayl köməkçiləri: şəkil hazırlama, paylaşma, oxuma. Veb və mobil üçün ayrı yollar. */
import { File, Paths, Directory } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Şəkli kiçildib (uzun tərəf ≤ max) JPEG kimi saxlayır və davamlı yerə köçürür. */
export async function preparePhoto(uri: string, width: number, height: number, max = 640): Promise<string> {
  const k = Math.min(1, max / Math.max(width || max, height || max));
  const ctx = ImageManipulator.manipulate(uri);
  if (k < 1) ctx.resize(width >= height ? { width: Math.round(width * k) } : { height: Math.round(height * k) });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  if (Platform.OS === 'web') return out.uri;
  // Keş qovluğu sistem tərəfindən təmizlənə bilər — yüklənənədək şəkil sənədlər qovluğunda saxlanılır.
  const dir = new Directory(Paths.document, 'pending-photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${Date.now()}.jpg`);
  await new File(out.uri).copy(dest);
  return dest.uri;
}

export async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web' || uri.startsWith('data:') || uri.startsWith('blob:')) {
    return (await fetch(uri)).arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

export function deleteLocal(uri: string) {
  if (Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* fayl artıq yoxdur */
  }
}

/** data:image/...;base64 → lokal fayl (köhnə PWA şəkillərini köçürmək üçün). */
export async function dataUrlToFile(dataUrl: string): Promise<string> {
  if (Platform.OS === 'web') return dataUrl;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const dir = new Directory(Paths.document, 'pending-photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const f = new File(dir, `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`);
  await f.write(base64, { encoding: 'base64' });
  return f.uri;
}

/** Mətn faylını yaradıb paylaşma pəncərəsini açır (WhatsApp, Drive, e-poçt…). Vebdə yükləyir. */
export async function shareTextFile(name: string, content: string, mimeType: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(content);
  await Sharing.shareAsync(f.uri, { mimeType, dialogTitle: name });
}

export async function readTextFile(uri: string): Promise<string> {
  if (Platform.OS === 'web') return (await fetch(uri)).text();
  return new File(uri).text();
}
