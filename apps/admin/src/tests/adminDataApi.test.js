import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminConversationRow,
  buildConversationMessageRow,
  buildNoticeRow,
  buildPlatformSettingRow,
  buildSupportReplyPatch,
  buildMemberIntegrityWarnings,
  buildMemberMessagePayload,
  fetchAdminConversations,
  fetchAdminMembers,
  findOrCreateAdminConversation,
  mapConversationToAdminThread,
  sendAdminMemberMessage,
  updateTourStatus
} from '../lib/adminDataApi.js';
import { createSupabaseRestClient } from '../lib/guideApplicationsApi.js';

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
  assert.deepEqual(result.stats, { travelers: 12, guides: 4 });
  assert.deepEqual(calls.map(([table]) => table), ['profiles', 'guide_profiles', 'count:profiles', 'count:guide_profiles']);
  assert.deepEqual(calls.slice(2), [['count:profiles', '?role=neq.admin'], ['count:guide_profiles', '?status=eq.active']]);
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
