import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildAdminConversationRow,
  buildAdminMemberMessageRequest,
  buildConversationMessageRow,
  buildNoticeRow,
  buildPlatformSettingRow,
  buildSupportReplyPatch,
  buildMemberIntegrityWarnings,
  buildMemberMessagePayload,
  fetchAdminConversations,
  fetchAdminMemberDetail,
  fetchAdminMembers,
  fetchAdminTours,
  findOrCreateAdminConversation,
  mapProfileToAdminMember,
  mapConversationToAdminThread,
  mapTourToAdminRow,
  mapTourChangeRequestToAdminRow,
  reviewTourChangeRequest,
  sendAdminMemberMessage,
  updateTourStatus
} from '../lib/adminDataApi.js';
import { createSupabaseRestClient } from '../lib/guideApplicationsApi.js';

function readMigrationByName(name) {
  const migrationsDir = resolve(process.cwd(), '../../supabase/migrations');
  const fileName = readdirSync(migrationsDir).find((file) => file.endsWith(`${name}.sql`));
  assert.ok(fileName, `Expected migration ${name} to exist`);
  return readFileSync(resolve(migrationsDir, fileName), 'utf8');
}

test('buildAdminConversationRow creates a reusable admin member conversation', () => {
  assert.deepEqual(buildAdminConversationRow({
    adminId: 'admin-1',
    memberId: 'member-1',
    title: '계정 안내'
  }), {
    type: 'admin',
    participant_id: 'member-1',
    created_by: 'admin-1',
    title: '계정 안내',
    reply_enabled: true,
    last_message: ''
  });
});

test('buildConversationMessageRow maps sender and body for admin messages', () => {
  assert.deepEqual(buildConversationMessageRow({
    conversationId: 'conversation-1',
    senderId: 'admin-1',
    body: '확인 부탁드립니다.'
  }), {
    conversation_id: 'conversation-1',
    sender_id: 'admin-1',
    body: '확인 부탁드립니다.'
  });
});

test('sendAdminMemberMessage reuses an existing admin conversation and inserts a message', async () => {
  const calls = [];
  const client = {
    request: async (table, options = {}) => {
      calls.push([table, options]);
      if (table === 'conversations' && options.method !== 'PATCH') {
        return [{ id: 'conversation-1', participant_id: 'member-1', title: '운영팀 메시지' }];
      }
      if (table === 'conversation_messages') {
        return [{ id: 'message-1', body: options.body.body }];
      }
      return [{ id: 'conversation-1', last_message: options.body.last_message }];
    }
  };

  const result = await sendAdminMemberMessage(client, {
    adminId: 'admin-1',
    memberId: 'member-1',
    title: '운영팀 메시지',
    body: '안녕하세요.'
  });

  assert.equal(result.conversation.id, 'conversation-1');
  assert.equal(result.message.body, '안녕하세요.');
  assert.deepEqual(calls.map(([table]) => table), ['conversations', 'conversation_messages', 'conversations']);
  assert.match(calls[0][1].query, /type=eq\.admin/);
  assert.match(calls[0][1].query, /participant_id=eq\.member-1/);
  assert.deepEqual(calls[1][1].body, {
    conversation_id: 'conversation-1',
    sender_id: 'admin-1',
    body: '안녕하세요.'
  });
});

test('findOrCreateAdminConversation creates an admin conversation when no prior thread exists', async () => {
  const calls = [];
  const client = {
    request: async (table, options = {}) => {
      calls.push([table, options]);
      if (calls.length === 1) return [];
      return [{ id: 'conversation-2', ...options.body }];
    }
  };

  const result = await findOrCreateAdminConversation(client, {
    adminId: 'admin-9',
    memberId: 'member-9',
    title: '첫 안내'
  });

  assert.equal(result.id, 'conversation-2');
  assert.deepEqual(calls.map(([table, options]) => [table, options.method || 'GET']), [
    ['conversations', 'GET'],
    ['conversations', 'POST']
  ]);
  assert.match(calls[0][1].query, /^\?select=\*&type=eq\.admin&participant_id=eq\.member-9&limit=1$/);
  assert.deepEqual(calls[1][1].body, {
    type: 'admin',
    participant_id: 'member-9',
    created_by: 'admin-9',
    title: '첫 안내',
    reply_enabled: true,
    last_message: ''
  });
});

test('sendAdminMemberMessage creates a first-time admin conversation before sending the message', async () => {
  const calls = [];
  const client = {
    request: async (table, options = {}) => {
      calls.push([table, options]);
      if (table === 'conversations' && !options.method) return [];
      if (table === 'conversations' && options.method === 'POST') {
        return [{ id: 'conversation-created', ...options.body }];
      }
      if (table === 'conversation_messages') {
        return [{ id: 'message-created', body: options.body.body, sender_id: options.body.sender_id }];
      }
      return [{ id: 'conversation-created', last_message: options.body.last_message }];
    }
  };

  const result = await sendAdminMemberMessage(client, {
    adminId: 'admin-2',
    memberId: 'member-2',
    title: '운영팀 첫 메시지',
    body: '처음 안내드립니다.'
  });

  assert.equal(result.conversation.id, 'conversation-created');
  assert.equal(result.message.id, 'message-created');
  assert.deepEqual(calls.map(([table, options]) => [table, options.method || 'GET']), [
    ['conversations', 'GET'],
    ['conversations', 'POST'],
    ['conversation_messages', 'POST'],
    ['conversations', 'PATCH']
  ]);
  assert.deepEqual(calls[1][1].body, {
    type: 'admin',
    participant_id: 'member-2',
    created_by: 'admin-2',
    title: '운영팀 첫 메시지',
    reply_enabled: true,
    last_message: ''
  });
  assert.deepEqual(calls[2][1].body, {
    conversation_id: 'conversation-created',
    sender_id: 'admin-2',
    body: '처음 안내드립니다.'
  });
});

test('mapConversationToAdminThread sorts messages and applies member/profile fallbacks', () => {
  assert.deepEqual(mapConversationToAdminThread({
    id: 'conversation-3',
    participant_id: 'member-3',
    title: '',
    last_message: '',
    reply_enabled: null,
    created_at: '2026-07-08T01:00:00.000Z',
    profiles: { email: 'member3@example.com' },
    conversation_messages: [
      { id: 'message-2', sender_id: 'member-3', body: '두번째', created_at: '2026-07-08T02:00:00.000Z' },
      { id: 'message-1', sender_id: 'admin-3', body: '첫번째', created_at: '2026-07-08T01:30:00.000Z' }
    ]
  }), {
    id: 'conversation-3',
    type: 'admin',
    title: '운영팀 메시지',
    memberId: 'member-3',
    memberName: 'member3@example.com',
    memberEmail: 'member3@example.com',
    lastMessage: '',
    replyEnabled: true,
    updatedAt: '2026-07-08T01:00:00.000Z',
    messages: [
      { id: 'message-1', senderId: 'admin-3', text: '첫번째', createdAt: '2026-07-08T01:30:00.000Z' },
      { id: 'message-2', senderId: 'member-3', text: '두번째', createdAt: '2026-07-08T02:00:00.000Z' }
    ]
  });

  assert.equal(mapConversationToAdminThread({ reply_enabled: false }).replyEnabled, false);
  assert.equal(mapConversationToAdminThread({ profiles: {} }).memberName, '회원');
});

test('mapConversationToAdminThread maps admin conversation rows for the admin UI', () => {
  const row = mapConversationToAdminThread({
    id: 'conversation-1',
    type: 'admin',
    title: '운영팀 메시지',
    participant_id: 'member-1',
    last_message: '최근 메시지',
    reply_enabled: true,
    profiles: { display_name: 'Mina', email: 'mina@example.com' },
    conversation_messages: [
      { id: 'm2', sender_id: 'member-1', body: '답장', created_at: '2026-07-09T02:00:00Z' },
      { id: 'm1', sender_id: 'admin-1', body: '안내', created_at: '2026-07-09T01:00:00Z' }
    ]
  });

  assert.equal(row.memberName, 'Mina');
  assert.equal(row.messages[0].text, '안내');
  assert.equal(row.messages[1].text, '답장');
});

test('fetchAdminConversations requests admin threads and maps sorted messages', async () => {
  const calls = [];
  const client = {
    request: async (table, options = {}) => {
      calls.push([table, options]);
      return [{
        id: 'conversation-4',
        type: 'admin',
        participant_id: 'member-4',
        title: '안내 스레드',
        last_message: '최신 메시지',
        reply_enabled: false,
        updated_at: '2026-07-10T09:00:00.000Z',
        profiles: { display_name: 'Mina', email: 'mina@example.com' },
        conversation_messages: [
          { id: 'message-b', sender_id: 'member-4', body: '답장', created_at: '2026-07-10T08:30:00.000Z' },
          { id: 'message-a', sender_id: 'admin-4', body: '안내', created_at: '2026-07-10T08:00:00.000Z' }
        ]
      }];
    }
  };

  const result = await fetchAdminConversations(client);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'conversations');
  assert.equal(
    calls[0][1].query,
    '?select=*,profiles!conversations_participant_id_fkey(display_name,email),conversation_messages(*)&type=eq.admin&order=updated_at.desc'
  );
  assert.deepEqual(result, [{
    id: 'conversation-4',
    type: 'admin',
    title: '안내 스레드',
    memberId: 'member-4',
    memberName: 'Mina',
    memberEmail: 'mina@example.com',
    lastMessage: '최신 메시지',
    replyEnabled: false,
    updatedAt: '2026-07-10T09:00:00.000Z',
    messages: [
      { id: 'message-a', senderId: 'admin-4', text: '안내', createdAt: '2026-07-10T08:00:00.000Z' },
      { id: 'message-b', senderId: 'member-4', text: '답장', createdAt: '2026-07-10T08:30:00.000Z' }
    ]
  }]);
});

test('buildNoticeRow validates and maps notice form input', () => {
  assert.deepEqual(buildNoticeRow({
    adminId: 'admin-1',
    payload: { title: 'Hello', content: 'Body', isPublic: true }
  }), {
    title: 'Hello',
    content: 'Body',
    is_public: true,
    created_by: 'admin-1'
  });

  assert.throws(() => buildNoticeRow({ adminId: 'admin-1', payload: { title: '', content: '' } }), /title and content/i);
});

test('buildSupportReplyPatch stores admin reply and closes the ticket', () => {
  assert.deepEqual(buildSupportReplyPatch('Done'), {
    admin_reply: 'Done',
    status: 'closed'
  });
});

test('buildPlatformSettingRow maps admin settings groups', () => {
  assert.deepEqual(buildPlatformSettingRow({ group: 'languages', name: 'Korean' }), {
    group_key: 'languages',
    name: 'Korean',
    active: true,
    sort_order: 0
  });
});

test('fetchAdminMembers loads profiles and guide profiles together', async () => {
  const calls = [];
  const client = {
    request: async (table, options) => {
      calls.push([table, options.query]);
      if (table === 'profiles') return [
        { id: 'user-1', display_name: 'Mina', email: 'm@example.com', role: 'traveler', is_guide: true, status: 'active' },
        { id: 'legacy-guide-1', display_name: 'Legacy', email: 'legacy@example.com', role: 'guide', is_guide: true, status: 'active' },
        { id: 'admin-1', display_name: 'Admin', email: 'admin@example.com', role: 'admin', status: 'active' }
      ];
      if (table === 'guide_profiles') return [{ id: 'guide-1', user_id: 'user-1', display_name: 'Guide', city: 'Seoul', status: 'active' }];
      if (table === 'tours') return [{ id: 'tour-1', guide_id: 'guide-1', status: 'active' }];
      return [];
    },
    count: async (table, options) => {
      calls.push([`count:${table}`, options.query]);
      if (table === 'profiles') return 12;
      if (table === 'guide_profiles') return 4;
      return 0;
    }
  };

  const result = await fetchAdminMembers(client);

  assert.equal(result.travelers[0].name, 'Mina');
  assert.deepEqual(result.travelers.map((row) => row.name), ['Mina', 'Legacy']);
  assert.equal(result.guides[0].city, 'Seoul');
  assert.equal(result.guides[0].tours, 1);
  assert.deepEqual(result.stats, { travelers: 12, guides: 4 });
  assert.deepEqual(calls.map(([table]) => table), ['profiles', 'guide_profiles', 'tours', 'count:profiles', 'count:guide_profiles']);
  assert.deepEqual(calls.slice(3), [['count:profiles', '?role=neq.admin'], ['count:guide_profiles', '?status=eq.active']]);
});

test('fetchAdminMembers falls back when optional member queries are unavailable', async () => {
  const calls = [];
  const client = {
    request: async (table, options) => {
      calls.push([table, options.query]);
      if (table === 'profiles' && options.query.includes('metadata')) {
        throw new Error('column profiles.metadata does not exist');
      }
      if (table === 'profiles') return [
        { id: 'user-1', display_name: 'Mina', email: 'm@example.com', role: 'traveler', is_guide: false, status: 'active' }
      ];
      throw new Error(`${table} unavailable`);
    },
    count: async () => {
      throw new Error('count unavailable');
    }
  };

  const result = await fetchAdminMembers(client);

  assert.equal(result.travelers.length, 1);
  assert.equal(result.guides.length, 0);
  assert.deepEqual(result.stats, { travelers: 1, guides: 0 });
  assert.deepEqual(calls.map(([table]) => table), ['profiles', 'profiles', 'guide_profiles', 'tours']);
});

test('buildMemberIntegrityWarnings reports broken guide membership invariants', () => {
  const warnings = buildMemberIntegrityWarnings({
    profiles: [
      { id: 'traveler-guide-1', role: 'traveler', is_guide: false },
      { id: 'admin-guide-1', role: 'admin', is_guide: true }
    ],
    guideProfiles: [
      { id: 'guide-1', user_id: 'traveler-guide-1', status: 'active' },
      { id: 'guide-2', user_id: 'missing-profile-1', status: 'active' },
      { id: 'guide-3', user_id: 'admin-guide-1', status: 'active' }
    ],
    travelerCount: 0
  });

  assert.deepEqual(warnings, [
    '1개의 가이드 프로필이 회원 프로필과 연결되지 않았습니다.',
    '1명의 가이드 회원에 is_guide가 설정되어 있지 않습니다.',
    '일반 가이드 수가 여행객/회원 수보다 많습니다.'
  ]);
});

test('mapProfileToAdminMember preserves member id for direct messages', () => {
  assert.equal(mapProfileToAdminMember({
    id: 'member-1',
    display_name: 'Mina',
    email: 'mina@example.com',
    role: 'traveler'
  }).id, 'member-1');
});

test('mapProfileToAdminMember keeps expanded member and guide detail fields', () => {
  const mapped = mapProfileToAdminMember({
    id: 'member-1',
    display_name: 'Mina',
    email: 'mina@example.com',
    avatar_path: 'avatar.png',
    role: 'guide',
    is_guide: true,
    updated_at: '2026-07-10T00:00:00Z',
    metadata: { phone: '010' },
    accountSettings: { preferences: { language: 'ko' } },
    reservations: [{ id: 'reservation-1', reserved_date: '2026-07-12', status: 'confirmed', amount: 60000, currency: 'KRW', tours: { title: 'Market tour' } }],
    reviews: [{ id: 'review-1', rating: 5, content: 'Great', created_at: '2026-07-11T00:00:00Z', tours: { title: 'Market tour' } }],
    supportTickets: [{ id: 'ticket-1', subject: 'Help', status: 'open', created_at: '2026-07-10T00:00:00Z' }],
    bookmarks: [{ tour_id: 'tour-1', created_at: '2026-07-09T00:00:00Z', tours: { title: 'Saved tour' } }],
    conversations: [{ id: 'conversation-1', title: '운영팀', last_message: '확인해주세요.', updated_at: '2026-07-08T00:00:00Z' }],
    guideProfile: {
      id: 'guide-1',
      user_id: 'member-1',
      display_name: 'Guide Mina',
      city: 'Seoul',
      languages: ['Korean', 'English'],
      nationality: '대한민국',
      birth_year: 1990,
      residence_years: 5,
      intro: 'Markets',
      profile_image_path: 'profile.jpg',
      tours: [{ id: 'tour-1', status: 'active' }],
      settlements: [{ id: 'settlement-1', amount: 30000, currency: 'KRW', status: 'pending' }]
    }
  });

  assert.equal(mapped.avatar, 'avatar.png');
  assert.equal(mapped.updatedAt, '2026-07-10T00:00:00Z');
  assert.deepEqual(mapped.metadata, { phone: '010' });
  assert.equal(mapped.accountSettings.preferences.language, 'ko');
  assert.equal(mapped.activity.reservations.total, 1);
  assert.equal(mapped.activity.reviews.total, 1);
  assert.equal(mapped.activity.supportTickets.total, 1);
  assert.equal(mapped.activity.bookmarks.total, 1);
  assert.equal(mapped.activity.conversations.total, 1);
  assert.equal(mapped.activity.reservations.latest.title, 'Market tour');
  assert.equal(mapped.activity.supportTickets.latest.subject, 'Help');
  assert.equal(mapped.guideProfile.nativeLanguage, 'Korean');
  assert.deepEqual(mapped.guideProfile.additionalLanguages, ['English']);
  assert.equal(mapped.guideProfile.tours, 1);
  assert.equal(mapped.guideProfile.settlements, 1);
});

test('fetchAdminMemberDetail loads latest profile settings and guide profile', async () => {
  const calls = [];
  const client = {
    request: async (table, options) => {
      calls.push([table, options.query]);
      if (table === 'profiles') return [{
        id: 'member-1',
        display_name: 'Mina',
        email: 'mina@example.com',
        role: 'guide',
        is_guide: true,
        status: 'active',
        reservations: [{ id: 'reservation-1' }]
      }];
      if (table === 'account_settings') return [{ profile_id: 'member-1', preferences: { language: 'ko' } }];
      if (table === 'guide_profiles') return [{
        id: 'guide-1',
        user_id: 'member-1',
        display_name: 'Guide Mina',
        city: 'Seoul',
        languages: ['Korean']
      }];
      if (table === 'tours') return [{ id: 'tour-1', guide_id: 'guide-1', status: 'active' }];
      if (table === 'reservations') return [{ id: 'reservation-1', traveler_id: 'member-1', reserved_date: '2026-07-12', status: 'confirmed', tours: { title: 'Market tour' } }];
      if (table === 'reviews') return [{ id: 'review-1', author_id: 'member-1', rating: 5, content: 'Great', tours: { title: 'Market tour' } }];
      if (table === 'support_tickets') return [{ id: 'ticket-1', author_id: 'member-1', subject: 'Help', status: 'open' }];
      if (table === 'bookmarks') return [{ profile_id: 'member-1', tour_id: 'tour-1', tours: { title: 'Saved tour' } }];
      if (table === 'conversations') return [{ id: 'conversation-1', participant_id: 'member-1', title: '운영팀', last_message: '확인해주세요.' }];
      if (table === 'settlements') return [{ id: 'settlement-1', guide_id: 'guide-1', amount: 30000, currency: 'KRW', status: 'pending' }];
      return [];
    }
  };

  const detail = await fetchAdminMemberDetail(client, 'member-1');

  assert.equal(detail.name, 'Mina');
  assert.equal(detail.bookings, 1);
  assert.equal(detail.accountSettings.preferences.language, 'ko');
  assert.equal(detail.activity.reservations.latest.title, 'Market tour');
  assert.equal(detail.activity.reviews.total, 1);
  assert.equal(detail.activity.supportTickets.total, 1);
  assert.equal(detail.activity.bookmarks.total, 1);
  assert.equal(detail.activity.conversations.total, 1);
  assert.equal(detail.guideProfile.name, 'Guide Mina');
  assert.equal(detail.guideProfile.tours, 1);
  assert.equal(detail.guideProfile.settlements, 1);
  assert.deepEqual(calls.map(([table]) => table), ['profiles', 'account_settings', 'guide_profiles', 'reservations', 'reviews', 'support_tickets', 'bookmarks', 'conversations', 'tours', 'settlements']);
});

test('mapProfileToAdminMember supplies stable empty activity fallbacks', () => {
  const mapped = mapProfileToAdminMember({
    id: 'member-1',
    email: 'member@example.com'
  });

  assert.equal(mapped.activity.reservations.total, 0);
  assert.equal(mapped.activity.reviews.total, 0);
  assert.equal(mapped.activity.supportTickets.total, 0);
  assert.equal(mapped.activity.bookmarks.total, 0);
  assert.equal(mapped.activity.conversations.total, 0);
  assert.equal(mapped.activity.reservations.latest, null);
});

test('buildAdminMemberMessageRequest uses guide user id and preserves admin sender', () => {
  assert.deepEqual(buildAdminMemberMessageRequest({
    adminId: 'admin-7',
    target: {
      id: 'guide-profile-1',
      userId: 'member-7',
      name: 'Guide Mina',
      email: 'guide@example.com'
    },
    title: '운영팀 안내',
    body: '확인 부탁드립니다.'
  }), {
    adminId: 'admin-7',
    memberId: 'member-7',
    title: '운영팀 안내',
    body: '확인 부탁드립니다.',
    logTarget: 'Guide Mina'
  });
});

test('buildAdminMemberMessageRequest falls back to traveler id and email log target', () => {
  assert.deepEqual(buildAdminMemberMessageRequest({
    adminId: 'admin-8',
    target: {
      id: 'member-8',
      name: '',
      email: 'traveler@example.com'
    },
    title: '계정 안내',
    body: '메시지 본문'
  }), {
    adminId: 'admin-8',
    memberId: 'member-8',
    title: '계정 안내',
    body: '메시지 본문',
    logTarget: 'traveler@example.com'
  });
});

test('buildMemberMessagePayload targets an individual member by display name', () => {
  assert.deepEqual(buildMemberMessagePayload({ name: 'Mina Kim' }), {
    target: 'Mina Kim',
    title: '개별 안내',
    body: '관리자 메시지입니다.'
  });
  assert.deepEqual(buildMemberMessagePayload({ email: 'mina@example.com' }), {
    target: 'mina@example.com',
    title: '개별 안내',
    body: '관리자 메시지입니다.'
  });
});

test('createSupabaseRestClient count reads exact total from Content-Range', async () => {
  const requests = [];
  const client = createSupabaseRestClient(
    { url: 'https://example.supabase.co', publishableKey: 'publishable-key', accessToken: 'access-token', isConfigured: true },
    async (url, options) => {
      requests.push([url, options]);
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-range' ? '0-0/42' : null },
        json: async () => []
      };
    }
  );

  const count = await client.count('profiles', { query: '?role=eq.traveler' });

  assert.equal(count, 42);
  assert.equal(requests[0][0], 'https://example.supabase.co/rest/v1/profiles?select=id&role=eq.traveler');
  assert.equal(requests[0][1].headers.Prefer, 'count=exact');
});

test('mapTourToAdminRow preserves detailed tour fields for the admin detail modal', () => {
  const row = mapTourToAdminRow({
    id: 'tour-1',
    title: '반석천 조류 탐방 투어',
    city: '대전',
    type: '자연',
    status: 'active',
    created_at: '2026-07-10T09:00:00Z',
    description: '짧은 소개',
    content_html: '<p>자전거를 타고 <strong>반석천</strong>을 탐방합니다.</p>',
    price_amount: 60000,
    currency: 'KRW',
    payment_type: 'pay_now',
    duration_minutes: 120,
    max_people: 6,
    transport: ['자전거', '도보'],
    options: { bicycle: true, meal: false, cafe: true },
    guide_profiles: { display_name: 'kyeong kim' },
    tour_images: [
      { image_path: 'second.jpg', sort_order: 2 },
      { image_path: 'first.jpg', sort_order: 1 }
    ],
    reservations: [{ id: 'reservation-1' }, { id: 'reservation-2' }]
  });

  assert.equal(row.thumbnail, 'https://qrabzkcibqaslealvdar.supabase.co/storage/v1/object/public/tour-images/first.jpg');
  assert.equal(row.detailText, '자전거를 타고 반석천을 탐방합니다.');
  assert.equal(row.priceLabel, 'KRW 60,000');
  assert.equal(row.durationLabel, '2시간');
  assert.equal(row.maxPeopleLabel, '6명');
  assert.equal(row.paymentTypeLabel, '즉시 결제');
  assert.deepEqual(row.optionLabels, ['bicycle', 'cafe']);
  assert.deepEqual(row.transportLabels, ['자전거', '도보']);
  assert.equal(row.bookings, 2);
});

test('mapTourToAdminRow supplies readable fallbacks for sparse tour detail data', () => {
  const row = mapTourToAdminRow({
    id: 'tour-empty',
    title: '정보 부족 투어',
    guide_profiles: {}
  });

  assert.equal(row.thumbnail, '');
  assert.equal(row.detailText, '상세 설명이 없습니다.');
  assert.equal(row.priceLabel, 'USD 0');
  assert.equal(row.durationLabel, '미입력');
  assert.equal(row.maxPeopleLabel, '미입력');
  assert.equal(row.paymentTypeLabel, '미입력');
  assert.deepEqual(row.optionLabels, []);
  assert.deepEqual(row.transportLabels, []);
  assert.equal(row.hasImage, false);
});

test('mapTourToAdminRow exposes pending change request details for admin review', () => {
  const row = mapTourToAdminRow({
    id: 'tour-1',
    title: 'Original title',
    city: 'Seoul',
    type: 'Food',
    status: 'pending',
    guide_profiles: { display_name: 'Guide Mina' },
    tour_change_requests: [{
      id: 'request-1',
      status: 'pending',
      created_at: '2026-07-10T09:00:00Z',
      payload: {
        title: 'Updated title',
        city: 'Busan',
        type: 'Nature',
        description: 'Updated description',
        price_amount: 70000,
        currency: 'KRW',
        payment_type: 'package',
        duration_minutes: 120,
        max_people: 5,
        main_image_path: 'user-1/main-photo/main-1-updated.jpg',
        options: { pickup: true }
      }
    }]
  });

  assert.equal(row.reviewType, 'edit');
  assert.equal(row.pendingChangeRequest.id, 'request-1');
  assert.equal(row.pendingChangeRequest.requested.title, 'Updated title');
  assert.equal(row.pendingChangeRequest.requested.priceLabel, 'KRW 70,000');
  assert.equal(row.pendingChangeRequest.requested.mainImagePath, 'user-1/main-photo/main-1-updated.jpg');
});

test('fetchAdminTours still returns tours when change request table is unavailable', async () => {
  const calls = [];
  const client = {
    request: async (table, options = {}) => {
      calls.push([table, options]);
      if (table === 'tours') {
        if (options.query?.includes('tour_change_requests')) {
          throw new Error('Could not find a relationship between tours and tour_change_requests in the schema cache');
        }
        return [{
          id: 'tour-1',
          title: 'Market tour',
          status: 'active',
          guide_profiles: { display_name: 'Guide Mina' },
          tour_images: [],
          reservations: []
        }];
      }
      if (table === 'tour_change_requests') {
        throw new Error('Could not find the table tour_change_requests in the schema cache');
      }
      return [];
    }
  };

  const result = await fetchAdminTours(client);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'tour-1');
  assert.equal(result[0].reviewType, 'new');
  assert.deepEqual(calls.map(([table]) => table), ['tours', 'tour_change_requests']);
  assert.doesNotMatch(calls[0][1].query, /tour_change_requests/);
});

test('mapTourChangeRequestToAdminRow normalizes requested tour payload values', () => {
  const row = mapTourChangeRequestToAdminRow({
    id: 'request-2',
    status: 'pending',
    payload: {
      title: 'Updated title',
      city: 'Busan',
      type: 'Nature',
      description: 'Updated description',
      price_amount: 70000,
      currency: 'KRW',
      payment_type: 'package',
      duration_minutes: 120,
      max_people: 5,
      main_image_path: 'user-1/main-photo/main-1-updated.jpg',
      options: { pickup: true }
    }
  });

  assert.equal(row.id, 'request-2');
  assert.equal(row.requested.title, 'Updated title');
  assert.equal(row.requested.durationLabel, '2시간');
  assert.equal(row.requested.mainImagePath, 'user-1/main-photo/main-1-updated.jpg');
  assert.deepEqual(row.requested.optionLabels, ['pickup']);
});

test('reviewTourChangeRequest calls the admin review RPC', async () => {
  const calls = [];
  const client = {
    request: async (path, options) => {
      calls.push([path, options]);
      return [{ id: 'request-1', status: 'approved' }];
    }
  };

  const result = await reviewTourChangeRequest(client, {
    requestId: 'request-1',
    decision: 'approved',
    reason: ''
  });

  assert.deepEqual(result, { id: 'request-1', status: 'approved' });
  assert.deepEqual(calls[0], ['rpc/review_tour_change_request', {
    method: 'POST',
    body: {
      p_request_id: 'request-1',
      p_decision: 'approved',
      p_reason: ''
    }
  }]);
});

test('review_tour_change_request rejection restores the original tour to active', () => {
  const migrationSql = readMigrationByName('restore_tour_on_change_rejection');
  const rejectionBranch = migrationSql.match(/elsif p_decision = 'rejected' then([\s\S]*?)else/);

  assert.ok(rejectionBranch, 'rejected decision branch should exist');
  assert.match(rejectionBranch[1], /update public\.tours[\s\S]*set status = 'active'[\s\S]*where id = v_request\.tour_id;/);
  assert.doesNotMatch(rejectionBranch[1], /update public\.tours[\s\S]*set status = 'rejected'[\s\S]*where id = v_request\.tour_id;/);
});

test('review_tour_change_request approval replaces the stored main tour image only on approval', () => {
  const migrationSql = readMigrationByName('apply_tour_main_photo_changes');
  const approvalBranch = migrationSql.match(/if p_decision = 'approved' then([\s\S]*?)update public\.tour_change_requests/);
  const rejectionBranch = migrationSql.match(/elsif p_decision = 'rejected' then([\s\S]*?)update public\.tour_change_requests/);

  assert.ok(approvalBranch, 'approved decision branch should exist');
  assert.match(approvalBranch[1], /delete from public\.tour_images[\s\S]*where tour_id = v_request\.tour_id;/);
  assert.match(approvalBranch[1], /insert into public\.tour_images \(tour_id, image_path, sort_order\)/);
  assert.ok(rejectionBranch, 'rejected decision branch should exist');
  assert.doesNotMatch(rejectionBranch[1], /tour_images/);
});

test('updateTourStatus patches an existing tour status', async () => {
  const calls = [];
  const client = {
    request: async (table, options) => {
      calls.push([table, options]);
      return [{ id: 'tour-1', status: 'paused' }];
    }
  };

  const result = await updateTourStatus(client, { tourId: 'tour-1', status: 'paused' });

  assert.equal(result.status, 'paused');
  assert.equal(calls[0][0], 'tours');
  assert.equal(calls[0][1].method, 'PATCH');
  assert.deepEqual(calls[0][1].body, { status: 'paused' });
});
