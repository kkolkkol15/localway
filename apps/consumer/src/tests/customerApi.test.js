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
  buildTourDetailPath,
  DEFAULT_SEARCH_FILTERS,
  fetchActiveTours,
  fetchBookmarkIds,
  fetchTourById,
  filterSearchTours,
  getSearchFilterOptions,
  getPaginatedSearchResults,
  mapConversationRecord,
  resolvePublicStorageImageUrl,
  mapTourRecord,
  sortSearchTours,
  updateGuideProfile,
  updateMemberProfile,
  upsertAccountSettings,
  toggleBookmark
} from '../lib/customerApi.js';

const searchToursFixture = [
  {
    id: 'tour-a',
    title: 'Budget food walk',
    city: 'Seoul',
    type: 'Food Tour',
    price: 20,
    paymentType: 'pay_as_you_go',
    durationMinutes: 90,
    maxPeople: 2,
    rating: 4.8,
    options: { pickup: true, petFriendly: false },
    transport: ['Walk'],
    guide: { years: 5, languages: ['Korean', 'English'] }
  },
  {
    id: 'tour-b',
    title: 'Private night route',
    city: 'Seoul',
    type: 'Outdoor',
    price: 80,
    paymentType: 'package',
    durationMinutes: 180,
    maxPeople: 6,
    rating: 4.2,
    options: { pickup: false, petFriendly: true },
    transport: ['Car'],
    guide: { years: 12, languages: ['English', 'Japanese'] }
  },
  {
    id: 'tour-c',
    title: 'Busan market',
    city: 'Busan',
    type: 'Food Tour',
    price: 45,
    paymentType: 'package',
    durationMinutes: 120,
    maxPeople: 4,
    rating: 5,
    options: { pickup: true, petFriendly: true },
    transport: ['Walk', 'Public transport'],
    guide: { years: 8, languages: ['Korean'] }
  }
];

test('sortSearchTours sorts by low price, high price, and high rating', () => {
  assert.deepEqual(sortSearchTours(searchToursFixture, 'price_asc').map((tour) => tour.id), ['tour-a', 'tour-c', 'tour-b']);
  assert.deepEqual(sortSearchTours(searchToursFixture, 'price_desc').map((tour) => tour.id), ['tour-b', 'tour-c', 'tour-a']);
  assert.deepEqual(sortSearchTours(searchToursFixture, 'rating_desc').map((tour) => tour.id), ['tour-c', 'tour-a', 'tour-b']);
});

test('filterSearchTours applies city, adults, price, rating, payment, type, language, option, transport, duration, and guide years', () => {
  const filters = {
    ...DEFAULT_SEARCH_FILTERS,
    priceMin: 10,
    priceMax: 50,
    ratingMin: 4.5,
    paymentTypes: ['pay_as_you_go'],
    types: ['Food Tour'],
    languages: ['English'],
    options: ['pickup'],
    transport: ['Walk'],
    durationMax: 120,
    guideYearsMin: 3
  };

  const results = filterSearchTours(searchToursFixture, { city: 'Seoul', adults: 2, filters });

  assert.deepEqual(results.map((tour) => tour.id), ['tour-a']);
});

test('filterSearchTours excludes tours below requested traveler count', () => {
  const results = filterSearchTours(searchToursFixture, { adults: 5, filters: DEFAULT_SEARCH_FILTERS });

  assert.deepEqual(results.map((tour) => tour.id), ['tour-b']);
});

test('getSearchFilterOptions derives distinct options from real tour data', () => {
  const options = getSearchFilterOptions(searchToursFixture);

  assert.deepEqual(options.types, ['Food Tour', 'Outdoor']);
  assert.deepEqual(options.paymentTypes, ['package', 'pay_as_you_go']);
  assert.deepEqual(options.languages, ['English', 'Japanese', 'Korean']);
  assert.deepEqual(options.options, ['petFriendly', 'pickup']);
  assert.deepEqual(options.transport, ['Car', 'Public transport', 'Walk']);
  assert.deepEqual(options.priceRange, { min: 20, max: 80 });
});

test('getPaginatedSearchResults exposes the first page and detects more results', () => {
  const results = Array.from({ length: 13 }, (_, index) => ({ id: `tour-${index + 1}` }));

  const page = getPaginatedSearchResults(results, 12);

  assert.equal(page.visibleResults.length, 12);
  assert.equal(page.visibleResults.at(0).id, 'tour-1');
  assert.equal(page.visibleResults.at(-1).id, 'tour-12');
  assert.equal(page.hasMore, true);
});

test('getPaginatedSearchResults grows by the requested visible count and clamps at total', () => {
  const results = Array.from({ length: 18 }, (_, index) => ({ id: `tour-${index + 1}` }));

  const page = getPaginatedSearchResults(results, 24);

  assert.equal(page.visibleResults.length, 18);
  assert.equal(page.hasMore, false);
});

test('getPaginatedSearchResults hides more state when results fit the first page', () => {
  const results = Array.from({ length: 12 }, (_, index) => ({ id: `tour-${index + 1}` }));

  const page = getPaginatedSearchResults(results, 12);

  assert.equal(page.visibleResults.length, 12);
  assert.equal(page.hasMore, false);
});

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
      profile_image_path: 'profile.png',
      profiles: { avatar_path: 'user-1/avatar.png' }
    },
    tour_images: [{ image_path: 'one.png', sort_order: 0 }, { image_path: 'two.png', sort_order: 1 }]
  });

  const expectedTourImage = 'https://qrabzkcibqaslealvdar.supabase.co/storage/v1/object/public/tour-images/one.png';
  assert.equal(tour.id, 'tour-1');
  assert.equal(tour.price, 25);
  assert.equal(tour.image, expectedTourImage);
  assert.equal(tour.guide.name, 'Mina');
  assert.equal(tour.guide.avatar, 'https://qrabzkcibqaslealvdar.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png');
  assert.deepEqual(tour.gallery, [
    expectedTourImage,
    'https://qrabzkcibqaslealvdar.supabase.co/storage/v1/object/public/tour-images/two.png'
  ]);
  assert.deepEqual(tour.options, { pickup: true });
});

test('mapTourRecord keeps guide avatars out of tour card main images', () => {
  const tour = mapTourRecord({
    id: 'tour-without-images',
    title: 'No cover tour',
    city: 'Seoul',
    guide_profiles: {
      display_name: 'kyeong kim',
      profiles: { avatar_path: 'user-1/avatar.png' }
    },
    tour_images: []
  });

  assert.equal(tour.image, '');
  assert.equal(tour.thumbnail, '');
  assert.deepEqual(tour.gallery, []);
  assert.equal(tour.guide.avatar, 'https://qrabzkcibqaslealvdar.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png');
});

test('mapTourRecord prepares real tour detail fields for the detail page', () => {
  const tour = mapTourRecord({
    id: 'tour-detail-1',
    title: 'Hidden Seoul food walk',
    city: 'Seoul',
    type: 'Food',
    description: 'Eat through local markets.',
    content_html: '<p>Start at Mangwon Market.</p><p>Finish with tea.</p>',
    price_amount: 60000,
    currency: 'KRW',
    duration_minutes: 150,
    max_people: 6,
    options: { pickup: true, localMeal: true, interpretation: false },
    transport: ['Walking', 'Subway'],
    guide_profiles: {
      id: 'guide-1',
      display_name: 'Mina',
      city: 'Seoul',
      languages: ['Korean', 'English'],
      intro: 'I host small food walks.',
      residence_years: 7,
      profiles: { avatar_path: 'user-1/avatar.png' }
    },
    tour_images: []
  });

  assert.equal(tour.priceLabel, 'KRW 60,000');
  assert.equal(tour.durationLabel, '2시간 30분');
  assert.equal(tour.maxPeopleLabel, '최대 6명');
  assert.equal(tour.detailText, 'Start at Mangwon Market. Finish with tea.');
  assert.deepEqual(tour.optionLabels, ['Pickup', 'Local Meal']);
  assert.deepEqual(tour.transportLabels, ['Walking', 'Subway']);
  assert.equal(tour.guide.intro, 'I host small food walks.');
});

test('mapTourRecord preserves short description line breaks for the tour page', () => {
  const tour = mapTourRecord({
    id: 'tour-multiline-description',
    title: 'Welcome route',
    city: 'Seoul',
    description: '1. Arrival & Warm Welcome\nMeet at the station.\n\n2. Market Walk\nExplore local shops.',
    guide_profiles: { display_name: 'Guide' },
    tour_images: []
  });

  assert.equal(tour.descriptionText, '1. Arrival & Warm Welcome\nMeet at the station.\n\n2. Market Walk\nExplore local shops.');
  assert.equal(tour.description, '1. Arrival & Warm Welcome Meet at the station. 2. Market Walk Explore local shops.');
});

test('mapTourRecord computes tour ratings from visible review rows', () => {
  const tour = mapTourRecord({
    id: 'tour-review-1',
    title: 'Review tour',
    city: 'Seoul',
    guide_profiles: {
      display_name: 'Guide',
      rating_avg: 5,
      review_count: 99
    },
    reviews: [
      {
        id: 'review-1',
        rating: 5,
        content: 'Great local route.',
        status: 'visible',
        created_at: '2026-07-10T10:00:00Z',
        profiles: { display_name: 'Taehyo Kim', avatar_path: 'user-1/avatar.png' }
      },
      {
        id: 'review-2',
        rating: 3,
        content: 'Good guide.',
        status: 'visible',
        created_at: '2026-07-09T10:00:00Z',
        profiles: { display_name: 'Mina Park' }
      },
      {
        id: 'review-hidden',
        rating: 1,
        content: 'Hidden',
        status: 'hidden',
        created_at: '2026-07-08T10:00:00Z'
      }
    ]
  });

  assert.equal(tour.rating, 4);
  assert.equal(tour.reviews, 2);
  assert.deepEqual(tour.reviewsList.map((review) => review.id), ['review-1', 'review-2']);
  assert.deepEqual(tour.reviewsList[0], {
    id: 'review-1',
    author: 'Taehyo Kim',
    authorAvatar: 'https://qrabzkcibqaslealvdar.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png',
    rating: 5,
    createdAt: '2026-07-10T10:00:00Z',
    dateLabel: '2026. 7. 10.',
    content: 'Great local route.'
  });
});

test('mapTourRecord falls back cleanly when a tour has no reviews', () => {
  const tour = mapTourRecord({
    id: 'tour-empty-reviews',
    title: 'No reviews',
    city: 'Busan',
    guide_profiles: {
      display_name: 'Guide',
      rating_avg: 4.9,
      review_count: 12
    },
    reviews: []
  });

  assert.equal(tour.rating, 0);
  assert.equal(tour.reviews, 0);
  assert.deepEqual(tour.reviewsList, []);
});

test('fetchTourById requests active tour detail data without mock fallback', async () => {
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
    single: async () => ({ data: { id: 'tour-1', title: 'Tour', guide_profiles: {}, tour_images: [] }, error: null })
  };
  const fakeClient = {
    from: (table) => {
      calls.push(['from', table]);
      return query;
    }
  };

  const tour = await fetchTourById(fakeClient, 'tour-1');

  assert.equal(tour.id, 'tour-1');
  assert.deepEqual(calls, [
    ['from', 'tours'],
    ['select', '*, guide_profiles(*, profiles(avatar_path)), tour_images(*), reviews(id, rating, content, created_at, status, profiles(display_name, avatar_path))'],
    ['eq', 'id', 'tour-1'],
    ['eq', 'status', 'active']
  ]);
});

test('resolvePublicStorageImageUrl preserves URLs and converts storage paths', () => {
  assert.equal(resolvePublicStorageImageUrl('avatars', 'https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
  assert.equal(
    resolvePublicStorageImageUrl('avatars', 'avatars/user 1/photo.png', 'https://project.supabase.co'),
    'https://project.supabase.co/storage/v1/object/public/avatars/user%201/photo.png'
  );
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

test('buildTourDetailPath links only real tours with stable ids', () => {
  assert.equal(buildTourDetailPath({ id: 'tour-1' }), '/tour/tour-1');
  assert.equal(buildTourDetailPath('tour-2'), '/tour/tour-2');
  assert.equal(buildTourDetailPath({ id: '' }), '');
  assert.equal(buildTourDetailPath({ title: 'Missing id' }), '');
  assert.equal(buildTourDetailPath(null), '');
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
    ['select', '*, guide_profiles!inner(*, profiles(avatar_path)), tour_images(*), reviews(id, rating, content, created_at, status, profiles(display_name, avatar_path))'],
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

test('fetchBookmarkIds loads saved tour ids for the current profile', async () => {
  const calls = [];
  const query = {
    select: (columns) => {
      calls.push(['select', columns]);
      return query;
    },
    eq: async (column, value) => {
      calls.push(['eq', column, value]);
      return { data: [{ tour_id: 'tour-2' }, { tour_id: 'tour-1' }, { tour_id: '' }], error: null };
    }
  };
  const fakeClient = {
    from: (table) => {
      calls.push(['from', table]);
      return query;
    }
  };

  const ids = await fetchBookmarkIds(fakeClient, 'user-1');

  assert.deepEqual(ids, ['tour-2', 'tour-1']);
  assert.deepEqual(calls, [
    ['from', 'bookmarks'],
    ['select', 'tour_id'],
    ['eq', 'profile_id', 'user-1']
  ]);
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
    currentProfile: { profilePhotoUrl: 'avatars/user-1/profile.jpg' }
  });

  assert.equal(result.city, 'Seoul');
  assert.deepEqual(calls, [
    ['update', 'guide_profiles', {
      display_name: 'Mina Kim',
      city: 'Seoul',
      languages: ['Korean', 'English'],
      intro: 'Markets',
      profile_image_path: 'avatars/user-1/profile.jpg',
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

test('updateGuideProfile uploads new public guide photos to avatars bucket', async () => {
  const calls = [];
  const photoFile = { name: 'guide profile.png', size: 1000, type: 'image/png' };
  const fakeClient = {
    storage: {
      from: (bucket) => ({
        upload: async (path, file, options) => {
          calls.push(['upload', bucket, path, file, options]);
          return { error: null };
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
    payload: { city: 'Seoul', nativeLanguage: 'Korean', intro: 'Markets' },
    profilePhotoFile: photoFile,
    currentProfile: { profilePhotoUrl: 'guide-verification/user-1/private-profile.png' }
  });

  const uploadCall = calls.find(([type]) => type === 'upload');
  const updateCall = calls.find(([type]) => type === 'update');
  assert.equal(uploadCall[1], 'avatars');
  assert.match(uploadCall[2], /^user-1\/guide-avatar-\d+-guide-profile\.png$/);
  assert.equal(uploadCall[3], photoFile);
  assert.match(updateCall[2].profile_image_path, /^avatars\/user-1\/guide-avatar-\d+-guide-profile\.png$/);
  assert.equal(result.profile_image_path, updateCall[2].profile_image_path);
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
