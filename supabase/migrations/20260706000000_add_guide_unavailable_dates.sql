create table public.guide_unavailable_dates (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guide_profiles(id) on delete cascade,
  unavailable_date date not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (guide_id, unavailable_date)
);

create index guide_unavailable_dates_guide_date_idx on public.guide_unavailable_dates(guide_id, unavailable_date);

alter table public.guide_unavailable_dates enable row level security;

create policy "guide_unavailable_dates_select_own_or_admin"
on public.guide_unavailable_dates
for select
to authenticated
using (private.is_guide_for_profile(guide_id) or private.is_admin());

create policy "guide_unavailable_dates_insert_own"
on public.guide_unavailable_dates
for insert
to authenticated
with check (private.is_guide_for_profile(guide_id) and created_by = (select auth.uid()));

create policy "guide_unavailable_dates_delete_own_or_admin"
on public.guide_unavailable_dates
for delete
to authenticated
using (private.is_guide_for_profile(guide_id) or private.is_admin());
