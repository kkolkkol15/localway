# Shared Chat API Design

## Goal

Build a real message system that works across the admin and customer sites by using one shared conversation model. The first implementation target is admin-to-member 1:1 operational messaging, while keeping the API shape reusable for a subsequent one-way notice implementation and traveler-guide travel chat.

## Current State

The customer app already has a `/messages` page and basic Supabase functions for `conversations` and `conversation_messages`. It can load conversations and insert messages, but it still mixes remote rows, local app state conversations, and mock conversations.

The admin app currently has message buttons in member management and a `/admin/messages` page, but both are local-only. They dispatch `SEND_MESSAGE` into `messageLogs`; no real conversation or message row is created.

The database already has:

- `public.conversations`
- `public.conversation_messages`
- RLS policies that let conversation participants, guide owners, and admins read relevant conversations
- Insert policies that require `conversation_messages.sender_id = auth.uid()`

The existing schema can support the first real feature, but it needs a small extension to support a reusable messaging API cleanly.

## Conversation Model

Use `conversations` as the single source of truth for all chat-like communication.

Conversation types:

- `admin`: admin and one member, reply enabled
- `notice`: admin-created notice or announcement, reply disabled
- `travel`: traveler and guide, reply enabled
- `support`: support ticket related conversation, reply enabled

Add these fields to `public.conversations`:

- `title text not null default ''`
- `created_by uuid references public.profiles(id)`
- `reply_enabled boolean not null default true`

Keep the current participant fields:

- `traveler_id` for traveler-guide chat
- `guide_id` for guide profile participant
- `participant_id` for direct member/admin operational chat
- `support_ticket_id` for support threads

For the first implementation, admin-to-member messages use:

- `type = 'admin'`
- `participant_id = target member profile id`
- `created_by = admin profile id`
- `reply_enabled = true`
- `title = '운영팀 메시지'` or the admin-entered subject

## API Design

Create shared message API functions in each app's existing API layer rather than introducing a separate backend service.

Admin app API responsibilities:

- Find an existing admin conversation for a member, or create one.
- Insert the admin's message into `conversation_messages`.
- Update `conversations.last_message` and `conversations.updated_at`.
- Fetch admin conversations for `/admin/messages`.
- Fetch messages for a selected conversation.
- Send replies from the admin conversation detail screen.

Customer app API responsibilities:

- Fetch authenticated user's conversations without mock fallback for real rows.
- Map admin conversations as `운영팀`.
- Respect `reply_enabled`; disable the composer for one-way notices when notice conversations are implemented.
- Insert customer replies into `conversation_messages`.
- Update local UI after successful sends.

Shared data shape used by UI:

```js
{
  id: string,
  type: 'admin' | 'notice' | 'travel' | 'support',
  title: string,
  displayName: string,
  avatar: string,
  lastMessage: string,
  replyEnabled: boolean,
  messages: [
    {
      id: string,
      senderId: string,
      from: 'me' | 'them',
      text: string,
      createdAt: string
    }
  ]
}
```

## Admin UX

Member management:

- The per-member `메시지` button opens a modal.
- The modal shows recipient name/email, subject, and body fields.
- Submit creates or reuses the admin conversation and sends the message.
- The UI shows a success or error state based on the Supabase result.
- It does not write to local `messageLogs` as the primary behavior.

Admin messages page:

- Replace the local message log table with real conversations.
- Show conversation list, selected thread, and reply composer.
- Keep a simple table/list layout matching the current admin design.
- Scope the first version to individual admin/member conversations; group notices are not implemented in this pass.

## Customer UX

Customer `/messages`:

- Show real conversations first.
- Admin conversations display as `운영팀` or the conversation title.
- Replies are enabled for `admin`, `travel`, and `support` conversations.
- Replies are disabled for `notice` conversations when notice conversations are implemented.
- Remove mock conversations from the default production view after real loading is wired. If Supabase is unavailable, show an empty/error state instead of pretending a real conversation exists.

## Security And RLS

Keep frontend clients on publishable keys only. Do not expose service-role credentials.

The first implementation should preserve these authorization rules:

- Admins can create admin conversations with any target member.
- Target members can read their own admin conversations.
- Target members can reply only in conversations where they are participants and `reply_enabled = true`.
- Admins can read and reply to admin conversations.
- Message inserts must use the authenticated profile id as `sender_id`.

If RLS cannot express the `reply_enabled` write rule safely with the current policies, add or replace policies in a migration rather than relying only on UI checks.

## Testing

Use TDD for each behavior.

Admin tests:

- Build admin conversation rows with `type='admin'`, `participant_id`, `created_by`, and `reply_enabled=true`.
- Reuse an existing admin conversation for the same member instead of creating duplicates.
- Insert admin messages with `sender_id` equal to the admin profile id.
- Member management message action calls the real API and handles failure.

Customer tests:

- Map `admin` conversations to `운영팀` display data.
- Disable composer when `reply_enabled=false`.
- Insert replies into `conversation_messages` with the current user id.
- Do not include mock conversations in the real loaded message list.

Database tests or verification queries:

- Confirm `conversations` has the new fields.
- Confirm a member can see their admin conversation.
- Confirm a non-participant cannot see another member's conversation.

## Rollout

Implement in this order:

1. Database migration for reusable conversation metadata and RLS checks.
2. Admin API functions for create/reuse/send/fetch.
3. Admin member message modal wired to real DB writes.
4. Admin messages page converted to real conversation list/thread.
5. Customer message mapping and reply-enabled UI.
6. End-to-end verification with existing real accounts, without inserting dummy production data unless explicitly approved.

## Out Of Scope For First Pass

- Bulk or segment notices.
- Push notifications, email notifications, and unread badge counts.
- Traveler-guide booking chat improvements beyond preserving compatibility.
- Realtime subscriptions. The first pass can refresh on page load and update optimistically after send.
