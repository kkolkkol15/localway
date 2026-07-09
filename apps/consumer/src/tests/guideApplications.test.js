import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuideApplicationRow } from '../lib/guideApplications.js';

test('buildGuideApplicationRow maps the consumer guide form to the existing DB schema', () => {
  const row = buildGuideApplicationRow(
    {
      nationality: 'Korea',
      birthYear: '1990',
      birthMonth: '04',
      birthDay: '12',
      gender: 'Female',
      city: 'Seoul',
      years: '5',
      nativeLanguage: 'Korean',
      additionalLanguages: ['English', 'Japanese'],
      intro: 'Local guide introduction'
    },
    {
      userId: '10000000-0000-4000-8000-000000000001',
      realName: 'Mina Kim',
      profileImagePath: '10000000-0000-4000-8000-000000000001/profile.jpg',
      idDocumentImagePath: '10000000-0000-4000-8000-000000000001/id.jpg'
    }
  );

  assert.deepEqual(row, {
    user_id: '10000000-0000-4000-8000-000000000001',
    real_name: 'Mina Kim',
    nationality: 'Korea',
    birth_date: '1990-04-12',
    gender: 'Female',
    city: 'Seoul',
    residence_years: 5,
    native_language: 'Korean',
    additional_languages: ['English', 'Japanese'],
    intro: 'Local guide introduction',
    profile_image_path: '10000000-0000-4000-8000-000000000001/profile.jpg',
    id_document_image_path: '10000000-0000-4000-8000-000000000001/id.jpg',
    status: 'pending'
  });
});
