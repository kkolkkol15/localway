import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_PROFILE_PHOTO_MAX_BYTES, validateGuideProfilePhoto } from '../lib/guidePhoto.js';

test('validateGuideProfilePhoto accepts image files under the size limit', () => {
  const result = validateGuideProfilePhoto({ type: 'image/jpeg', size: 1024 });
  assert.deepEqual(result, { ok: true, error: '' });
});

test('validateGuideProfilePhoto rejects missing files', () => {
  const result = validateGuideProfilePhoto(null);
  assert.equal(result.ok, false);
  assert.match(result.error, /required/i);
});

test('validateGuideProfilePhoto rejects non-image files', () => {
  const result = validateGuideProfilePhoto({ type: 'application/pdf', size: 1024 });
  assert.equal(result.ok, false);
  assert.match(result.error, /image/i);
});

test('validateGuideProfilePhoto rejects image files over 5MB', () => {
  const result = validateGuideProfilePhoto({ type: 'image/png', size: GUIDE_PROFILE_PHOTO_MAX_BYTES + 1 });
  assert.equal(result.ok, false);
  assert.match(result.error, /5MB/i);
});
