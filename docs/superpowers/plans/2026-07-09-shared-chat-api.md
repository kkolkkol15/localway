# Shared Chat API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build real admin-to-member 1:1 operational messaging on top of a shared conversation API that can later support notice and travel chat.

**Architecture:** Use `public.conversations` and `public.conversation_messages` as the single source of truth. Add small metadata fields to conversations, then wire admin member messaging, admin message management, and customer `/messages` to the same row shape.

**Tech Stack:** Supabase Postgres/RLS, Supabase REST from the admin app, Supabase JS from the consumer app, React, Node test runner, Vite, pnpm.

## Global Constraints

- Do not expose Supabase service-role credentials in either frontend app.
- Use `conversation_messages.sender_id = auth.uid()` for every message insert.
- First pass implements individual `type='admin'` operational conversations only; bulk notices are out of scope.
- Keep existing traveler-guide chat compatibility by preserving `traveler_id` and `guide_id`.
- Use TDD: add a failing test, verify RED, implement, verify GREEN.
- Do not insert dummy production data unless the user explicitly approves it.

---

## File Structure

- `supabase/migrations/20260709020000_extend_conversations_for_shared_chat.sql`: Adds reusable conversation metadata, indexes, and RLS updates.
- `apps/admin/src/lib/adminDataApi.js`: Adds admin chat row builders, mappers, fetch/create/reuse/send functions.
- `apps/admin/src/tests/adminDataApi.test.js`: Tests admin chat builders and REST call sequences.
- `apps/admin/src/pages/AdminPages.jsx`: Replaces local-only message actions with modal-driven real sends and real conversation management.
- `apps/admin/src/tests/adminStore.test.js`: Updates legacy local message assertion if it becomes obsolete.
- `apps/consumer/src/lib/customerApi.js`: Adds shared conversation mapper, updates fetch and send behavior for `reply_enabled`.
- `apps/consumer/src/tests/customerApi.test.js`: Tests customer conversation mapping and reply-enabled behavior.
- `apps/consumer/src/pages/Pages.jsx`: Removes mock conversations from the default real message list and respects `replyEnabled`.

---

### Task 1: Database Conversation Metadata And RLS

**Files:**
- Create: `supabase/migrations/20260709020000_extend_conversations_for_shared_chat.sql`

**Interfaces:**
- Produces: `conversations.title`, `conversations.created_by`, `conversations.reply_enabled`
- Produces: RLS rule that blocks non-admin replies when `reply_enabled = false`

- [ ] **Step 1: Create migration with metadata columns**

Use `apply_patch` to create:

```sql
alter table public.conversations
  add column if not exists title text not null default '',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists reply_enabled boolean not null default true;

create index if not exists conversations_type_participant_idx
on public.conversations(type, participant_id);

create index if not exists conversations_created_by_idx
on public.conversations(created_by);
```

- [ ] **Step 2: Replace message insert policy with reply-enabled check**

Add to the same migration:

```sql
drop policy if exists "conversation_messages_participant_insert" on public.conversation_messages;

create policy "conversation_messages_participant_insert"
on public.conversation_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.conversations
    where conversations.id = conversation_messages.conversation_id
      and (
        private.is_admin()
        or (
          conversations.reply_enabled
          and (
            conversations.traveler_id = (select auth.uid())
            or conversations.participant_id = (select auth.uid())
            or private.is_guide_for_profile(conversations.guide_id)
          )
        )
      )
  )
);
```

- [ ] **Step 3: Apply migration to Supabase**

Run via MCP Supabase `apply_migration` against project `qrabzkcibqaslealvdar` with migration name `extend_conversations_for_shared_chat`.

Expected: migration applies successfully.

- [ ] **Step 4: Verify schema**

Run read-only SQL:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'conversations'
  and column_name in ('title', 'created_by', 'reply_enabled')
order by column_name;
```

Expected: three rows for `created_by`, `reply_enabled`, `title`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260709020000_extend_conversations_for_shared_chat.sql
git commit -m "Add shared chat conversation metadata"
```

---

### Task 2: Admin Chat API

**Files:**
- Modify: `apps/admin/src/lib/adminDataApi.js`
- Modify: `apps/admin/src/tests/adminDataApi.test.js`

**Interfaces:**
- Produces: `buildAdminConversationRow({ adminId, memberId, title })`
- Produces: `buildConversationMessageRow({ conversationId, senderId, body })`
- Produces: `mapConversationToAdminThread(conversation)`
- Produces: `findOrCreateAdminConversation(client, { adminId, memberId, title })`
- Produces: `sendAdminConversationMessage(client, { conversationId, senderId, body })`
- Produces: `sendAdminMemberMessage(client, { adminId, memberId, title, body })`
- Produces: `fetchAdminConversations(client)`

- [ ] **Step 1: Add failing admin row builder tests**

Add to `apps/admin/src/tests/adminDataApi.test.js`:

```js
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
```

Also add both imports from `../lib/adminDataApi.js`.

- [ ] **Step 2: Run admin API test to verify RED**

Run:

```bash
node apps/admin/src/tests/adminDataApi.test.js
```

Expected: FAIL because `buildAdminConversationRow` is not exported.

- [ ] **Step 3: Implement row builders**

Add to `apps/admin/src/lib/adminDataApi.js`:

```js
export function buildAdminConversationRow({ adminId, memberId, title = '운영팀 메시지' }) {
  return {
    type: 'admin',
    participant_id: requireText(memberId, 'A member id is required.'),
    created_by: requireText(adminId, 'An admin id is required.'),
    title: requireText(title || '운영팀 메시지', 'A conversation title is required.'),
    reply_enabled: true,
    last_message: ''
  };
}

export function buildConversationMessageRow({ conversationId, senderId, body }) {
  return {
    conversation_id: requireText(conversationId, 'A conversation id is required.'),
    sender_id: requireText(senderId, 'A sender id is required.'),
    body: requireText(body, 'A message body is required.')
  };
}
```

- [ ] **Step 4: Run admin API test to verify GREEN**

Run:

```bash
node apps/admin/src/tests/adminDataApi.test.js
```

Expected: PASS for the new builder tests.

- [ ] **Step 5: Add failing test for create/reuse/send sequence**

Add:

```js
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
```

Import `sendAdminMemberMessage`.

- [ ] **Step 6: Run admin API test to verify RED**

Run:

```bash
node apps/admin/src/tests/adminDataApi.test.js
```

Expected: FAIL because `sendAdminMemberMessage` is not exported.

- [ ] **Step 7: Implement create/reuse/send/fetch functions**

Add:

```js
export function mapConversationToAdminThread(conversation = {}) {
  const messages = [...(conversation.conversation_messages ?? [])]
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      text: message.body,
      createdAt: message.created_at || ''
    }));
  return {
    id: conversation.id,
    type: conversation.type || 'admin',
    title: conversation.title || '운영팀 메시지',
    memberId: conversation.participant_id || '',
    memberName: conversation.profiles?.display_name || conversation.profiles?.email || '회원',
    memberEmail: conversation.profiles?.email || '',
    lastMessage: conversation.last_message || '',
    replyEnabled: conversation.reply_enabled !== false,
    updatedAt: conversation.updated_at || conversation.created_at || '',
    messages
  };
}

export async function findOrCreateAdminConversation(client, { adminId, memberId, title = '운영팀 메시지' }) {
  const query = `?select=*&type=eq.admin&participant_id=eq.${encodeURIComponent(requireText(memberId, 'A member id is required.'))}&limit=1`;
  const existing = await client.request('conversations', { query });
  if (existing[0]) return existing[0];

  const created = await client.request('conversations', {
    method: 'POST',
    body: buildAdminConversationRow({ adminId, memberId, title })
  });
  return created[0] ?? null;
}

export async function sendAdminConversationMessage(client, { conversationId, senderId, body }) {
  const message = buildConversationMessageRow({ conversationId, senderId, body });
  const created = await client.request('conversation_messages', {
    method: 'POST',
    body: message
  });
  await client.request('conversations', {
    method: 'PATCH',
    query: `?id=eq.${encodeURIComponent(message.conversation_id)}`,
    body: { last_message: message.body, updated_at: new Date().toISOString() }
  });
  return created[0] ?? null;
}

export async function sendAdminMemberMessage(client, { adminId, memberId, title = '운영팀 메시지', body }) {
  const conversation = await findOrCreateAdminConversation(client, { adminId, memberId, title });
  const message = await sendAdminConversationMessage(client, {
    conversationId: conversation.id,
    senderId: adminId,
    body
  });
  return { conversation, message };
}

export async function fetchAdminConversations(client) {
  const rows = await client.request('conversations', {
    query: '?select=*,profiles!conversations_participant_id_fkey(display_name,email),conversation_messages(*)&type=eq.admin&order=updated_at.desc'
  });
  return rows.map(mapConversationToAdminThread);
}
```

- [ ] **Step 8: Run admin API test to verify GREEN**

Run:

```bash
node apps/admin/src/tests/adminDataApi.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/lib/adminDataApi.js apps/admin/src/tests/adminDataApi.test.js
git commit -m "Add admin chat API helpers"
```

---

### Task 3: Admin Member Message Modal

**Files:**
- Modify: `apps/admin/src/pages/AdminPages.jsx`
- Modify: `apps/admin/src/tests/adminDataApi.test.js`

**Interfaces:**
- Consumes: `sendAdminMemberMessage(client, { adminId, memberId, title, body })`
- Produces: Member management `메시지` button opens modal and sends real DB message.

- [ ] **Step 1: Add failing test that member rows expose profile id**

In `apps/admin/src/tests/adminDataApi.test.js`, extend or add:

```js
test('mapProfileToAdminMember preserves member id for direct messages', () => {
  assert.equal(mapProfileToAdminMember({
    id: 'member-1',
    display_name: 'Mina',
    email: 'mina@example.com',
    role: 'traveler'
  }).id, 'member-1');
});
```

Import `mapProfileToAdminMember`.

- [ ] **Step 2: Run test to verify RED or existing GREEN**

Run:

```bash
node apps/admin/src/tests/adminDataApi.test.js
```

Expected: If already GREEN, document that `id` was already preserved and continue; this is a characterization test.

- [ ] **Step 3: Wire modal state and API import**

In `apps/admin/src/pages/AdminPages.jsx`, extend import from `adminDataApi.js`:

```js
sendAdminMemberMessage
```

Inside `MemberManagement`, add state:

```js
const [messageTarget, setMessageTarget] = useState(null);
const [messageError, setMessageError] = useState('');
```

- [ ] **Step 4: Replace message button dispatch**

Change both traveler and guide action buttons from:

```jsx
<ActionButton icon={Send} tone="primary" onClick={() => dispatch({ type: 'SEND_MESSAGE', payload: buildMemberMessagePayload(row) })}>메시지</ActionButton>
```

to:

```jsx
<ActionButton icon={Send} tone="primary" onClick={() => { setMessageTarget(row); setMessageError(''); }}>메시지</ActionButton>
```

- [ ] **Step 5: Add modal submit handler**

Inside `MemberManagement`:

```js
const sendMemberMessage = async ({ title, body }) => {
  if (!messageTarget) return;
  try {
    await sendAdminMemberMessage(client, {
      adminId: state.auth.admin?.id,
      memberId: messageTarget.userId || messageTarget.id,
      title,
      body
    });
    dispatch({ type: 'SEND_MESSAGE', payload: { target: messageTarget.name, title, body } });
    setMessageTarget(null);
    setMessageError('');
  } catch (error) {
    setMessageError(error.message || '메시지 전송에 실패했습니다.');
  }
};
```

- [ ] **Step 6: Add modal UI**

Before closing fragment in `MemberManagement`:

```jsx
{messageTarget && (
  <MessageModal
    target={messageTarget}
    error={messageError}
    onClose={() => setMessageTarget(null)}
    onSubmit={sendMemberMessage}
  />
)}
```

Add component near other modal helpers:

```jsx
function MessageModal({ target, error, onClose, onSubmit }) {
  return (
    <Modal title="회원에게 메시지 보내기" onClose={onClose}>
      <form className="stack" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({ title: form.get('title'), body: form.get('body') });
      }}>
        <p className="muted">수신자: {target.name || target.email}</p>
        <label>제목<input name="title" defaultValue="운영팀 메시지" required /></label>
        <label>내용<textarea name="body" required /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit"><Send size={17} />전송</button>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 7: Run admin tests**

Run:

```bash
pnpm --dir apps/admin test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/pages/AdminPages.jsx apps/admin/src/tests/adminDataApi.test.js
git commit -m "Wire member message button to real chat"
```

---

### Task 4: Admin Messages Page Uses Real Conversations

**Files:**
- Modify: `apps/admin/src/pages/AdminPages.jsx`
- Modify: `apps/admin/src/tests/adminDataApi.test.js`
- Modify: `apps/admin/src/tests/adminStore.test.js`

**Interfaces:**
- Consumes: `fetchAdminConversations(client)`
- Consumes: `sendAdminConversationMessage(client, { conversationId, senderId, body })`
- Produces: `/admin/messages` displays real admin conversations and thread replies.

- [ ] **Step 1: Add failing mapper test**

Add:

```js
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
```

Import `mapConversationToAdminThread`.

- [ ] **Step 2: Run admin API test**

Run:

```bash
node apps/admin/src/tests/adminDataApi.test.js
```

Expected: PASS if mapper already exists from Task 2; otherwise FAIL and implement mapper as in Task 2.

- [ ] **Step 3: Replace `GuideMessages` local log UI**

In `apps/admin/src/pages/AdminPages.jsx`, import:

```js
fetchAdminConversations,
sendAdminConversationMessage
```

Replace `GuideMessages` body with real state:

```jsx
export function GuideMessages() {
  const { state } = useAdmin();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const config = getSupabaseAdminConfig();
  const client = useMemo(() => createSupabaseRestClient({ ...config, accessToken: state.auth.accessToken }), [config.url, config.publishableKey, state.auth.accessToken]);

  useEffect(() => {
    let active = true;
    fetchAdminConversations(client)
      .then((items) => {
        if (!active) return;
        setConversations(items);
        setSelected((current) => current ?? items[0] ?? null);
      })
      .catch((loadError) => { if (active) setError(loadError.message || '메시지를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [client]);

  const sendReply = async () => {
    const text = body.trim();
    if (!selected || !text) return;
    try {
      const message = await sendAdminConversationMessage(client, {
        conversationId: selected.id,
        senderId: state.auth.admin?.id,
        body: text
      });
      const nextMessage = { id: message?.id || `local-${Date.now()}`, senderId: state.auth.admin?.id, text, createdAt: message?.created_at || new Date().toISOString() };
      setConversations((items) => items.map((item) => item.id === selected.id ? { ...item, lastMessage: text, messages: [...item.messages, nextMessage] } : item));
      setSelected((item) => item ? { ...item, lastMessage: text, messages: [...item.messages, nextMessage] } : item);
      setBody('');
      setError('');
    } catch (sendError) {
      setError(sendError.message || '메시지 전송에 실패했습니다.');
    }
  };

  return (
    <div className="split-view">
      <DataTable
        rows={conversations}
        searchPlaceholder="메시지 검색"
        onRowClick={setSelected}
        columns={[
          { key: 'updatedAt', label: '최근일', sortable: true },
          { key: 'memberName', label: '회원', sortable: true },
          { key: 'title', label: '제목', sortable: true },
          { key: 'lastMessage', label: '최근 메시지' }
        ]}
      />
      <aside className="conversation panel">
        {selected ? (
          <>
            <h2>{selected.memberName}</h2>
            <p>{selected.title}</p>
            {selected.messages.map((message) => <p key={message.id}>{message.text}</p>)}
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="답변 입력" />
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" onClick={sendReply}>전송</button>
          </>
        ) : <p>대화를 선택하세요.</p>}
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Update admin store test wording if needed**

If `adminStore.test.js` still tests local `SEND_MESSAGE`, keep it as a legacy toast/log reducer test or rename it:

```js
test('stores legacy local message logs for fallback UI actions', () => {
  let state = createInitialState();
  state = adminReducer(state, {
    type: 'SEND_MESSAGE',
    payload: { target: '전체 가이드', title: '성수기 안내', body: '예약 가능 시간을 확인해주세요.' }
  });
  assert.equal(state.messageLogs[0].target, '전체 가이드');
});
```

- [ ] **Step 5: Run admin tests and build**

Run:

```bash
pnpm --dir apps/admin test
pnpm --dir apps/admin build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/pages/AdminPages.jsx apps/admin/src/tests/adminDataApi.test.js apps/admin/src/tests/adminStore.test.js
git commit -m "Show real admin message conversations"
```

---

### Task 5: Customer Conversation Mapping And Reply Controls

**Files:**
- Modify: `apps/consumer/src/lib/customerApi.js`
- Modify: `apps/consumer/src/tests/customerApi.test.js`

**Interfaces:**
- Produces: `mapConversationRecord(record, currentUserId)`
- Updates: `fetchConversations(client, profileId)` returns mapped UI rows
- Updates: `sendConversationMessage(client, { conversationId, senderId, body })` returns inserted message

- [ ] **Step 1: Add failing mapper test**

In `apps/consumer/src/tests/customerApi.test.js`, add imports and test:

```js
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
```

- [ ] **Step 2: Run customer API test to verify RED**

Run:

```bash
node apps/consumer/src/tests/customerApi.test.js
```

Expected: FAIL because `mapConversationRecord` is not exported.

- [ ] **Step 3: Implement mapper**

In `apps/consumer/src/lib/customerApi.js`:

```js
export function mapConversationRecord(record = {}, currentUserId = '') {
  const title = record.title || (record.type === 'admin' ? '운영팀' : 'Conversation');
  const messages = [...(record.conversation_messages ?? [])]
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      from: message.sender_id === currentUserId ? 'me' : 'them',
      text: message.body,
      createdAt: message.created_at || ''
    }));
  return {
    id: record.id,
    type: record.type ?? 'travel',
    title,
    displayName: title,
    guideName: title,
    avatar: '',
    lastMessage: record.last_message || messages.at(-1)?.text || '',
    replyEnabled: record.reply_enabled !== false,
    messages
  };
}
```

- [ ] **Step 4: Update `fetchConversations`**

Replace return line:

```js
return data ?? [];
```

with:

```js
return (data ?? []).map((conversation) => mapConversationRecord(conversation, profileId));
```

- [ ] **Step 5: Run customer API test**

Run:

```bash
node apps/consumer/src/tests/customerApi.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/consumer/src/lib/customerApi.js apps/consumer/src/tests/customerApi.test.js
git commit -m "Map customer conversations from shared chat rows"
```

---

### Task 6: Customer Messages Page Real Rows Only

**Files:**
- Modify: `apps/consumer/src/pages/Pages.jsx`
- Modify: `apps/consumer/src/tests/customerApi.test.js`

**Interfaces:**
- Consumes: `fetchConversations(client, profileId)` mapped rows
- Consumes: `replyEnabled` from mapped conversation rows
- Produces: `/messages` shows real conversations and disables composer when needed.

- [ ] **Step 1: Remove extra mapping in `MessagesPage`**

In `apps/consumer/src/pages/Pages.jsx`, replace remote load mapping:

```js
const rows = await fetchConversations(client, state.auth.user.id);
if (active) setRemoteConversations(rows);
```

Delete the local `rows.map((conversation) => ({ ... }))` block because `fetchConversations` now returns UI-ready rows.

- [ ] **Step 2: Remove mock conversations from default list**

Change:

```js
const allConversations = useMemo(
  () => [
    ...remoteConversations,
    ...state.conversations.map((conversation) => ({ ...conversation, type: conversation.type ?? 'travel' })),
    ...mockConversations
  ],
  [remoteConversations, state.conversations]
);
```

to:

```js
const allConversations = useMemo(
  () => [
    ...remoteConversations,
    ...state.conversations.map((conversation) => ({
      ...conversation,
      type: conversation.type ?? 'travel',
      displayName: conversation.guideName,
      replyEnabled: true
    }))
  ],
  [remoteConversations, state.conversations]
);
```

- [ ] **Step 3: Respect `replyEnabled` when sending**

At the top of `sendMessage`:

```js
if (!selected.replyEnabled) return;
```

- [ ] **Step 4: Disable composer for one-way rows**

Replace composer block with:

```jsx
{selected.replyEnabled ? (
  <div className="message-composer">
    <input
      className="message-composer-input"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }}
      placeholder="메시지를 입력하세요"
    />
    <button className="message-send-button" onClick={sendMessage} disabled={!text.trim()} aria-label="Send message">
      <Send size={21} />
    </button>
  </div>
) : (
  <div className="message-composer">
    <p className="text-sm font-semibold text-zinc-500">답장할 수 없는 안내 메시지입니다.</p>
  </div>
)}
```

- [ ] **Step 5: Fix list avatar fallback**

Change:

```jsx
<img className="h-12 w-12 rounded-full object-cover" src={conversation.avatar} alt="" />
```

to:

```jsx
{conversation.avatar ? (
  <img className="h-12 w-12 rounded-full object-cover" src={conversation.avatar} alt="" />
) : (
  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange-100 text-sm font-black text-primary">LW</span>
)}
```

- [ ] **Step 6: Run consumer tests and build**

Run:

```bash
pnpm --dir apps/consumer test
pnpm --dir apps/consumer build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/consumer/src/pages/Pages.jsx apps/consumer/src/lib/customerApi.js apps/consumer/src/tests/customerApi.test.js
git commit -m "Use real conversations on customer messages"
```

---

### Task 7: Full Verification And Push

**Files:**
- No source edits expected unless verification exposes a defect.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: pushed branch/main with working shared chat implementation.

- [ ] **Step 1: Run complete checks**

Run:

```bash
pnpm --dir apps/admin test
pnpm --dir apps/admin build
pnpm --dir apps/consumer test
pnpm --dir apps/consumer build
```

Expected: all pass. Existing Vite chunk size warnings are acceptable if builds succeed.

- [ ] **Step 2: Verify Supabase production schema**

Run read-only SQL:

```sql
select
  count(*) filter (where column_name = 'title') as has_title,
  count(*) filter (where column_name = 'created_by') as has_created_by,
  count(*) filter (where column_name = 'reply_enabled') as has_reply_enabled
from information_schema.columns
where table_schema = 'public'
  and table_name = 'conversations';
```

Expected: `1, 1, 1`.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short --branch
git log --oneline -6
```

Expected: no uncommitted source changes, recent task commits present.

- [ ] **Step 4: Push**

Run:

```bash
git push origin main
```

Expected: `main -> main`.

---

## Self-Review

Spec coverage:

- Database metadata and RLS: Task 1.
- Admin create/reuse/send/fetch API: Task 2.
- Member management message modal: Task 3.
- Admin message page real conversations: Task 4.
- Customer conversation mapping and reply controls: Tasks 5 and 6.
- Verification without dummy data: Task 7.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified implementation steps remain.

Type consistency:

- `reply_enabled` maps to UI `replyEnabled`.
- `participant_id` maps to admin `memberId`.
- Message objects use `{ id, senderId, text, createdAt }` in admin and add `from` in customer.
