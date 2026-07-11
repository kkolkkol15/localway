import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAccountSettingsRow,
  buildBookmarkRow,
  buildGuideProfilePatch,
  buildConversationMessageRow,
  buildMemberProfilePatch,
  buildSupportTicketRow,
  buildHomepageTourSections,
  fetchActiveTours,
  mapConversationRecord,
  mapTourRecord,
  updateGuideProfile,
  updateMemberProfile,
  upsertAccountSettings,
  toggleBookmark
} from '../lib/customerApi.js';

test('mapTourRecord normalizes Supabase tour rows for customer cards', () => {
  const tour = mapTourRecord({
    id: 'tour-1',
    title: 'Market walk',
    city: 'Seoul',
    type: 'Food',
    description: 'Local food',
    price_amount: 25,
    currency: 'USD',
    payment_type: 'pay_as_you_go',
    duration_minutes: 120,
    max_people: 4,
    status: 'active',
    content_html: '<p>Hello</p>',
    options: { pickup: true },
    guide_profiles: {
      id: 'guide-1',
      display_name: 'Mina',
      city: 'Seoul',
      languages: ['Korean', 'English'],
      rating_avg: 4.8,
      review_count: 12,
      profile_image_path: 'profile.png'
    },
    tour_images: [{ image_path: 'one.png', sort_order: 0 }, { image_path: 'two.png', sort_order: 1 }]
  });

  assert.equal(tour.id, 'tour-1');
  assert.equal(tour.price, 25);
  assert.equal(tour.image, 'one.png');
  assert.equal(tour.guide.name, 'Mina');
  assert.deepEqual(tour.gallery, ['one.png', 'two.png']);
  assert.deepEqual(tour.options, { pickup: true });
});

test('buildHomepageTourSections distributes shuffled tours without duplicates when there are enough tours', () => {
  const sourceTours = Array.from({ length: 6 }, (_, index) => ({ id: `tour-${index + 1}` }));
  const sections = buildHomepageTourSections(sourceTours, {
    sectionDefinitions: [
      { key: 'popular', size: 2 },
      { key: 'recommended', size: 2 },
      { key: 'nearby', size: 2 }
    ],
    random: () => 0.5
  });

  const selectedIds = Object.values(sections).flat().map((tour) => tour.id);

  assert.equal(selectedIds.length, 6);
  assert.equal(new Set(selectedIds).size, 6);
});

test('buildHomepageTourSections reuses tours only when the approved pool is too small', () => {
  const sourceTours = [{ id: 'tour-1' }, { id: 'tour-2' }];
  const sections = buildHomepageTourSections(sourceTours, {
    sectionDefinitions: [
      { key: 'popular', size: 4 },
      { key: 'recommended', size: 4 }
    ],
    random: () => 0.5
  });

  assert.deepEqual(Object.keys(sections), ['popular', 'recommended']);
  assert.equal(sections.popular.length, 2);
  assert.equal(sections.recommended.length, 2);
  assert.equal(new Set(sections.popular.map((tour) => tour.id)).size, 2);
  assert.equal(new Set(sections.recommended.map((tour) => tour.id)).size, 2);
  assert.equal(new Set([...sections.popular, ...sections.recommended].map((tour) => tour.id)).size, 2);
});

test('buildHomepageTourSections keeps every section empty when there are no approved tours', () => {
  const sections = buildHomepageTourSections([], {
    sectionDefinitions: [
      { key: 'popular', size: 4 },
      { key: 'recommended', size: 4 }
    ]
  });

  assert.deepEqual(sections, { popular: [], recommended: [] });
});

test('fetchActiveTours selects active tours from active guide profiles only', async () => {
  const calls = [];
  const query = {
    select: (columns) => {
      calls.push(['select', columns]);
      return query;
    },
    eq: (column, value) => {
      calls.push(['eq', column, value]);
      return query;
    },
    order: async (column, options) => {
      calls.push(['order', column, options]);
      return { data: [], error: null };
    }
  };
  const fakeClient = {
    from: (table) => {
      calls.push(['from', table]);
      return query;
    }
  };

  await fetchActiveTours(fakeClient);

  assert.deepEqual(calls, [
    ['from', 'tours'],
    ['select', '*, guide_profiles!inner(*), tour_images(*)'],
    ['eq', 'status', 'active'],
    ['eq', 'guide_profiles.status', 'active'],
    ['order', 'created_at', { ascending: false }]
  ]);
});

test('buildAccountSettingsRow stores account preferences as json fields', () => {
  assert.deepEqual(buildAccountSettingsRow({
    profileId: 'user-1',
    settings: {
      preferences: { language: 'ko' },
      notifications: { messageEmail: true },
      privacy: { profileVisibility: 'public' },
      security: { loginAlerts: true }
    }
  }), {
    profile_id: 'user-1',
    preferences: { language: 'ko' },
    notifications: { messageEmail: true },
    privacy: { profileVisibility: 'public' },
    security: { loginAlerts: true }
  });
});

test('buildMemberProfilePatch maps editable member profile fields', () => {
  assert.deepEqual(buildMemberProfilePatch({
    email: 'mina@example.com',
    displayName: 'Mina Kim',
    avatarPath: 'avatars/mina.png'
  }), {
    email: 'mina@example.com',
    display_name: 'Mina Kim',
    avatar_path: 'avatars/mina.png'
  });
});

test('buildGuideProfilePatch maps editable guide profile fields', () => {
  assert.deepEqual(buildGuideProfilePatch({
    nationality: '대한민국',
    birthYear: '1990',
    birthMonth: '07',
    birthDay: '05',
    city: 'Seoul',
    years: '5',
    gender: 'Female',
    nativeLanguage: 'Korean',
    additionalLanguages: ['English', 'Japanese'],
    intro: 'Local markets',
    profilePhotoName: 'profile.jpg',
    languageLevels: { English: 'Fluent' }
  }, {
    displayName: 'Mina Kim',
    profileImagePath: 'user-1/profile.jpg'
  }), {
    display_name: 'Mina Kim',
    city: 'Seoul',
    languages: ['Korean', 'English', 'Japanese'],
    intro: 'Local markets',
    profile_image_path: 'user-1/profile.jpg',
    nationality: '대한민국',
    gender: 'Female',
    birth_year: 1990,
    residence_years: 5,
    metadata: {
      birthMonth: '07',
      birthDay: '05',
      languageLevels: { English: 'Fluent' },
      profilePhotoName: 'profile.jpg'
    }
  });
});

test('buildBookmarkRow maps a saved tour to the join table', () => {
  assert.deepEqual(buildBookmarkRow({ profileId: 'user-1', tourId: 'tour-1' }), {
    profile_id: 'user-1',
    tour_id: 'tour-1'
  });
});

test('buildSupportTicketRow validates required ticket input', () => {
  assert.deepEqual(buildSupportTicketRow({
    profileId: 'user-1',
    payload: { subject: 'Need help', description: 'Question' }
  }), {
    author_id: 'user-1',
    subject: 'Need help',
    description: 'Question',
    status: 'open'
  });

  assert.throws(() => buildSupportTicketRow({ profileId: 'user-1', payload: { subject: '', description: '' } }), /subject and description/i);
});

test('buildConversationMessageRow maps message composer input', () => {
  assert.deepEqual(buildConversationMessageRow({
    conversationId: 'conv-1',
    senderId: 'user-1',
    body: 'Hello'
  }), {
    conversation_id: 'conv-1',
    sender_id: 'user-1',
    body: 'Hello'
  });
});

test('mapConversationRecord displays admin conversations as operating team threads', () => {
  const mapped = mapConversationRecord({
    id: 'conversation-1',
    type: 'admin',
    title: '계정 안내',
    participant_id: 'member-1',
    last_message: '확인해주세요.',
    reply_enabled: true,
    conversation_messages: [
      { id: 'm1', sender_id: 'admin-1', body: '확인해주세요.', created_at: '2026-07-09T01:00:00Z' }
    ]
  }, 'member-1');

  assert.equal(mapped.displayName, '계정 안내');
  assert.equal(mapped.guideName, '계정 안내');
  assert.equal(mapped.type, 'admin');
  assert.equal(mapped.replyEnabled, true);
  assert.deepEqual(mapped.messages, [{
    id: 'm1',
    senderId: 'admin-1',
    from: 'them',
    text: '확인해주세요.',
    createdAt: '2026-07-09T01:00:00Z'
  }]);
});

test('mapConversationRecord disables replies when reply_enabled is false', () => {
  const mapped = mapConversationRecord({
    id: 'notice-1',
    type: 'notice',
    title: '공지',
    reply_enabled: false,
    conversation_messages: []
  }, 'member-1');

  assert.equal(mapped.replyEnabled, false);
});

test('upsertAccountSettings writes one row per profile', async () => {
  const calls = [];
  const fakeClient = {
    from: (table) => ({
      upsert: (row, options) => {
        calls.push([table, row, options]);
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
      }
    })
  };

  const result = await upsertAccountSettings(fakeClient, {
    profileId: 'user-1',
    settings: { preferences: { language: 'en' } }
  });

  assert.equal(result.profile_id, 'user-1');
  assert.equal(calls[0][0], 'account_settings');
  assert.deepEqual(calls[0][2], { onConflict: 'profile_id' });
});

test('updateMemberProfile patches the current profile row', async () => {
  const calls = [];
  const fakeClient = {
    from: (table) => ({
      update: (row) => {
        calls.push(['update', table, row]);
        return {
          eq: (column, value) => {
            calls.push(['eq', column, value]);
            return { select: () => ({ single: async () => ({ data: { id: value, ...row }, error: null }) }) };
          }
        };
      }
    })
  };

  const result = await updateMemberProfile(fakeClient, {
    profileId: 'user-1',
    email: 'mina@example.com',
    displayName: 'Mina Kim'
  });

  assert.equal(result.display_name, 'Mina Kim');
  assert.deepEqual(calls, [
    ['update', 'profiles', { email: 'mina@example.com', display_name: 'Mina Kim' }],
    ['eq', 'id', 'user-1']
  ]);
});

test('updateGuideProfile patches guide profile fields without a new photo upload', async () => {
  const calls = [];
  const fakeClient = {
    storage: {
      from: () => ({
        upload: async () => {
          throw new Error('upload should not be called');
        }
      })
    },
    from: (table) => ({
      update: (row) => {
        calls.push(['update', table, row]);
        return {
          eq: (column, value) => {
            calls.push(['eq', column, value]);
            return { select: () => ({ single: async () => ({ data: { id: value, ...row }, error: null }) }) };
          }
        };
      }
    })
  };

  const result = await updateGuideProfile(fakeClient, {
    guideProfileId: 'guide-1',
    userId: 'user-1',
    displayName: 'Mina Kim',
    payload: {
      city: 'Seoul',
      nativeLanguage: 'Korean',
      additionalLanguages: ['English'],
      intro: 'Markets',
      years: '3',
      birthYear: '1992'
    },
    currentProfile: { profilePhotoUrl: 'user-1/profile.jpg' }
  });

  assert.equal(result.city, 'Seoul');
  assert.deepEqual(calls, [
    ['update', 'guide_profiles', {
      display_name: 'Mina Kim',
      city: 'Seoul',
      languages: ['Korean', 'English'],
      intro: 'Markets',
      profile_image_path: 'user-1/profile.jpg',
      nationality: null,
      gender: null,
      birth_year: 1992,
      residence_years: 3,
      metadata: {
        birthMonth: '',
        birthDay: '',
        languageLevels: {},
        profilePhotoName: ''
      }
    }],
    ['eq', 'id', 'guide-1']
  ]);
});

test('toggleBookmark deletes existing saved tour or inserts a new one', async () => {
  const calls = [];
  const fakeClient = {
    from: (table) => ({
      delete: () => ({
        eq: (column, value) => {
          calls.push(['delete-eq', table, column, value]);
          return { eq: async (secondColumn, secondValue) => {
            calls.push(['delete-eq', table, secondColumn, secondValue]);
            return { error: null };
          } };
        }
      }),
      insert: async (row) => {
        calls.push(['insert', table, row]);
        return { error: null };
      }
    })
  };

  await toggleBookmark(fakeClient, { profileId: 'user-1', tourId: 'tour-1', currentlySaved: true });
  await toggleBookmark(fakeClient, { profileId: 'user-1', tourId: 'tour-2', currentlySaved: false });

  assert.deepEqual(calls.at(-1), ['insert', 'bookmarks', { profile_id: 'user-1', tour_id: 'tour-2' }]);
});
