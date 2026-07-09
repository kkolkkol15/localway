alter table public.guide_profiles
  add column if not exists nationality text,
  add column if not exists gender text,
  add column if not exists birth_year integer,
  add column if not exists residence_years integer not null default 0 check (residence_years >= 0),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.tours
  add column if not exists content_html text,
  add column if not exists options jsonb not null default '{}'::jsonb;

alter table public.support_tickets
  add column if not exists admin_replied_by uuid references public.profiles(id);

alter table public.notices
  add column if not exists category text not null default 'notice';

create table if not exists public.account_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  privacy jsonb not null default '{}'::jsonb,
  security jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tour_id uuid not null references public.tours(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, tour_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'travel',
  traveler_id uuid references public.profiles(id) on delete cascade,
  guide_id uuid references public.guide_profiles(id) on delete cascade,
  participant_id uuid references public.profiles(id) on delete cascade,
  support_ticket_id uuid references public.support_tickets(id) on delete set null,
  last_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (traveler_id is not null or participant_id is not null)
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_key, name)
);

create index if not exists bookmarks_tour_id_idx on public.bookmarks(tour_id);
create index if not exists conversations_traveler_id_idx on public.conversations(traveler_id);
create index if not exists conversations_guide_id_idx on public.conversations(guide_id);
create index if not exists conversations_participant_id_idx on public.conversations(participant_id);
create index if not exists conversation_messages_conversation_id_created_at_idx on public.conversation_messages(conversation_id, created_at);
create index if not exists platform_settings_group_key_idx on public.platform_settings(group_key);

drop trigger if exists account_settings_set_updated_at on public.account_settings;
create trigger account_settings_set_updated_at before update on public.account_settings for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations for each row execute function public.set_updated_at();

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at before update on public.platform_settings for each row execute function public.set_updated_at();

alter table public.account_settings enable row level security;
alter table public.bookmarks enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.platform_settings enable row level security;

drop policy if exists "account_settings_owner_all" on public.account_settings;
create policy "account_settings_owner_all"
on public.account_settings
for all
to authenticated
using (profile_id = (select auth.uid()) or private.is_admin())
with check (profile_id = (select auth.uid()) or private.is_admin());

drop policy if exists "bookmarks_owner_all" on public.bookmarks;
create policy "bookmarks_owner_all"
on public.bookmarks
for all
to authenticated
using (profile_id = (select auth.uid()) or private.is_admin())
with check (profile_id = (select auth.uid()) or private.is_admin());

drop policy if exists "conversations_participant_select" on public.conversations;
create policy "conversations_participant_select"
on public.conversations
for select
to authenticated
using (
  traveler_id = (select auth.uid())
  or participant_id = (select auth.uid())
  or private.is_guide_for_profile(guide_id)
  or private.is_admin()
);

drop policy if exists "conversations_participant_insert" on public.conversations;
create policy "conversations_participant_insert"
on public.conversations
for insert
to authenticated
with check (
  traveler_id = (select auth.uid())
  or participant_id = (select auth.uid())
  or private.is_guide_for_profile(guide_id)
  or private.is_admin()
);

drop policy if exists "conversations_participant_update" on public.conversations;
create policy "conversations_participant_update"
on public.conversations
for update
to authenticated
using (
  traveler_id = (select auth.uid())
  or participant_id = (select auth.uid())
  or private.is_guide_for_profile(guide_id)
  or private.is_admin()
)
with check (
  traveler_id = (select auth.uid())
  or participant_id = (select auth.uid())
  or private.is_guide_for_profile(guide_id)
  or private.is_admin()
);

drop policy if exists "conversation_messages_participant_select" on public.conversation_messages;
create policy "conversation_messages_participant_select"
on public.conversation_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = conversation_messages.conversation_id
      and (
        conversations.traveler_id = (select auth.uid())
        or conversations.participant_id = (select auth.uid())
        or private.is_guide_for_profile(conversations.guide_id)
        or private.is_admin()
      )
  )
);

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
        conversations.traveler_id = (select auth.uid())
        or conversations.participant_id = (select auth.uid())
        or private.is_guide_for_profile(conversations.guide_id)
        or private.is_admin()
      )
  )
);

drop policy if exists "platform_settings_active_select" on public.platform_settings;
create policy "platform_settings_active_select"
on public.platform_settings
for select
to anon, authenticated
using (active or private.is_admin());

drop policy if exists "platform_settings_admin_all" on public.platform_settings;
create policy "platform_settings_admin_all"
on public.platform_settings
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());
