create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_id_idx on public.conversation_participants(user_id);
create index if not exists conversation_participants_user_read_idx on public.conversation_participants(user_id, last_read_at);

drop trigger if exists conversation_participants_set_updated_at on public.conversation_participants;
create trigger conversation_participants_set_updated_at
before update on public.conversation_participants
for each row execute function public.set_updated_at();

insert into public.conversation_participants (conversation_id, user_id)
select distinct conversation_id, user_id
from (
  select id as conversation_id, participant_id as user_id from public.conversations where participant_id is not null
  union
  select id as conversation_id, traveler_id as user_id from public.conversations where traveler_id is not null
  union
  select id as conversation_id, created_by as user_id from public.conversations where created_by is not null
  union
  select conversations.id as conversation_id, guide_profiles.user_id
  from public.conversations
  join public.guide_profiles on guide_profiles.id = conversations.guide_id
  where conversations.guide_id is not null
) participants
where user_id is not null
on conflict (conversation_id, user_id) do nothing;

create or replace function private.sync_conversation_participants()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  with participant_ids as (
    select new.participant_id as user_id where new.participant_id is not null
    union
    select new.traveler_id where new.traveler_id is not null
    union
    select new.created_by where new.created_by is not null
    union
    select guide_profiles.user_id
    from public.guide_profiles
    where guide_profiles.id = new.guide_id
      and guide_profiles.user_id is not null
  )
  insert into public.conversation_participants (conversation_id, user_id)
  select new.id, user_id
  from participant_ids
  on conflict (conversation_id, user_id) do nothing;

  with participant_ids as (
    select new.participant_id as user_id where new.participant_id is not null
    union
    select new.traveler_id where new.traveler_id is not null
    union
    select new.created_by where new.created_by is not null
    union
    select guide_profiles.user_id
    from public.guide_profiles
    where guide_profiles.id = new.guide_id
      and guide_profiles.user_id is not null
  )
  delete from public.conversation_participants
  where conversation_id = new.id
    and user_id not in (select user_id from participant_ids);

  return new;
end;
$$;

revoke all on function private.sync_conversation_participants() from public;
revoke all on function private.sync_conversation_participants() from anon;
revoke all on function private.sync_conversation_participants() from authenticated;

drop trigger if exists conversations_sync_participants on public.conversations;
create trigger conversations_sync_participants
after insert or update of participant_id, traveler_id, guide_id, created_by
on public.conversations
for each row execute function private.sync_conversation_participants();

alter table public.conversation_participants enable row level security;

drop policy if exists "conversation_participants_owner_select" on public.conversation_participants;
create policy "conversation_participants_owner_select"
on public.conversation_participants
for select
to authenticated
using (user_id = (select auth.uid()) or private.is_admin());

drop policy if exists "conversation_participants_owner_update" on public.conversation_participants;
create policy "conversation_participants_owner_update"
on public.conversation_participants
for update
to authenticated
using (user_id = (select auth.uid()) or private.is_admin())
with check (user_id = (select auth.uid()) or private.is_admin());

create or replace function public.get_unread_message_count()
returns integer
language sql
stable
as $$
  select coalesce(count(cm.id), 0)::integer
  from public.conversation_participants cp
  join public.conversation_messages cm on cm.conversation_id = cp.conversation_id
  where cp.user_id = (select auth.uid())
    and cm.sender_id <> (select auth.uid())
    and cm.created_at > coalesce(cp.last_read_at, '1970-01-01'::timestamptz);
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
as $$
declare
  unread_count integer := 0;
begin
  select count(cm.id)::integer
  into unread_count
  from public.conversation_participants cp
  join public.conversation_messages cm on cm.conversation_id = cp.conversation_id
  where cp.conversation_id = p_conversation_id
    and cp.user_id = (select auth.uid())
    and cm.sender_id <> (select auth.uid())
    and cm.created_at > coalesce(cp.last_read_at, '1970-01-01'::timestamptz);

  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id
    and user_id = (select auth.uid());

  return coalesce(unread_count, 0);
end;
$$;

revoke all on function public.get_unread_message_count() from public;
revoke all on function public.get_unread_message_count() from anon;
grant execute on function public.get_unread_message_count() to authenticated;

revoke all on function public.mark_conversation_read(uuid) from public;
revoke all on function public.mark_conversation_read(uuid) from anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversation_messages'
    ) then
      alter publication supabase_realtime add table public.conversation_messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversation_participants'
    ) then
      alter publication supabase_realtime add table public.conversation_participants;
    end if;
  end if;
end;
$$;
