import { supabase } from '@/lib/supabase';
import { cleanFileName } from '@/lib/format';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Returns an error message, or an empty string when the file is fine.
export function checkImage(file, maxMB) {
  if (!file) return 'Choose an image first.';
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > maxMB * 1024 * 1024) {
    return 'That image is larger than ' + maxMB + ' MB. Choose a smaller image and try again.';
  }
  return '';
}

// Convert uploads to appropriately-sized WebP before they reach Storage.
// This keeps the artwork looking sharp while reducing mobile data and transfer time.
async function prepareImage(file, bucket) {
  if (typeof createImageBitmap !== 'function') return file;
  const isCover = bucket === 'covers';
  const maxEdge = isCover ? 1200 : 1800;
  const quality = isCover ? 0.78 : 0.82;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'palixia-image';
    return new File([blob], baseName + '.webp', {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close?.();
  }
}

// Uploads into the signed-in user's own folder and returns its public URL.
// Every upload gets a unique path, so a one-year immutable cache is safe.
export async function uploadImage(bucket, userId, file, subfolder) {
  const optimizedFile = await prepareImage(file, bucket);
  const folder = subfolder ? userId + '/' + subfolder : userId;
  const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '-' + cleanFileName(optimizedFile.name);
  const { error } = await supabase.storage.from(bucket).upload(path, optimizedFile, {
    contentType: optimizedFile.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
