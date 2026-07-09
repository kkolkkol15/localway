create table if not exists public.guide_tour_drafts (
  id text primary key,
  guide_id uuid not null references public.guide_profiles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled tour draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guide_tour_drafts enable row level security;

drop policy if exists "Guides can select own tour drafts" on public.guide_tour_drafts;
create policy "Guides can select own tour drafts"
on public.guide_tour_drafts
for select
to authenticated
using ((select auth.uid()) = created_by);

drop policy if exists "Guides can insert own tour drafts" on public.guide_tour_drafts;
create policy "Guides can insert own tour drafts"
on public.guide_tour_drafts
for insert
to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists "Guides can update own tour drafts" on public.guide_tour_drafts;
create policy "Guides can update own tour drafts"
on public.guide_tour_drafts
for update
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);
