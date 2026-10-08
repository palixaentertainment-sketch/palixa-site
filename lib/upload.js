import { supabase } from '@/lib/supabase';
import { cleanFileName } from '@/lib/format';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Returns an error message, or an empty string when the file is fine.
export function checkImage(file, maxMB) {
  if (!file) return 'Choose an image first.';
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > maxMB * 1024 * 1024) {
    return 'That image is larger than ' + maxMB + ' MB. Compress it and try again.';
  }
  return '';
}

// Uploads into the signed-in user's own folder and returns the public URL.
export async function uploadImage(bucket, userId, file, subfolder) {
  const folder = subfolder ? userId + '/' + subfolder : userId;
  const path = folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '-' + cleanFileName(file.name);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
