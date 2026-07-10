alter table public.conversations
  add column if not exists title text not null default '',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists reply_enabled boolean not null default true;

create index if not exists conversations_type_participant_idx
on public.conversations(type, participant_id);

create index if not exists conversations_created_by_idx
on public.conversations(created_by);

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
