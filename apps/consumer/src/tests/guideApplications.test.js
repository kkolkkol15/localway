import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCanSubmitGuideApplication,
  buildGuideApplicationRow,
  getGuideApplicationBlockMessage,
  submitGuideApplication
} from '../lib/guideApplications.js';

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

test('getGuideApplicationBlockMessage explains active duplicate application states', () => {
  assert.equal(getGuideApplicationBlockMessage({ status: 'pending' }), 'A guide application is already pending review.');
  assert.equal(getGuideApplicationBlockMessage({ status: 'approved' }), 'This account is already approved as a guide.');
});

test('submitGuideApplication rejects duplicate active guide applications before uploading files', async () => {
  const calls = [];
  const client = {
    from: (table) => {
      calls.push(['from', table]);
      if (table === 'guide_applications') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          limit: () => builder,
          maybeSingle: async () => ({ data: { id: 'application-1', status: 'pending' }, error: null })
        };
        return builder;
      }
      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from: () => ({
        upload: async () => {
          calls.push(['upload']);
          return { data: null, error: null };
        }
      })
    }
  };

  await assert.rejects(
    () => submitGuideApplication(client, {
      payload: {},
      formElement: new FormData(),
      user: { id: 'user-1', name: 'Mina' }
    }),
    /already pending/i
  );
  assert.deepEqual(calls, [['from', 'guide_applications']]);
});

test('assertCanSubmitGuideApplication rejects already approved guide profiles', async () => {
  const client = {
    from: (table) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({
          data: table === 'guide_profiles' ? { id: 'guide-profile-1', status: 'active' } : null,
          error: null
        })
      };
      return builder;
    }
  };

  await assert.rejects(
    () => assertCanSubmitGuideApplication(client, 'user-1'),
    /already approved/i
  );
});
