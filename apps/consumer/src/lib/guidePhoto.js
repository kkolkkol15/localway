export const GUIDE_PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function validateGuideProfilePhoto(file) {
  if (!file) return { ok: false, error: 'Profile photo is required.' };
  if (!file.type?.startsWith('image/')) return { ok: false, error: 'Please upload an image file.' };
  if (file.size > GUIDE_PROFILE_PHOTO_MAX_BYTES) return { ok: false, error: 'Profile photo must be 5MB or smaller.' };
  return { ok: true, error: '' };
}
