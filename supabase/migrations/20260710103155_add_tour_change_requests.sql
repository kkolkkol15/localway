create table if not exists public.tour_change_requests (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  guide_id uuid not null references public.guide_profiles(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tour_change_requests_one_pending_per_tour_idx
on public.tour_change_requests(tour_id)
where status = 'pending';

create index if not exists tour_change_requests_guide_id_idx on public.tour_change_requests(guide_id);
create index if not exists tour_change_requests_status_idx on public.tour_change_requests(status);

drop trigger if exists tour_change_requests_set_updated_at on public.tour_change_requests;
create trigger tour_change_requests_set_updated_at
before update on public.tour_change_requests
for each row execute function public.set_updated_at();

alter table public.tour_change_requests enable row level security;

grant select, insert, update on public.tour_change_requests to authenticated;

drop policy if exists "tour_change_requests_guide_select_own" on public.tour_change_requests;
create policy "tour_change_requests_guide_select_own"
on public.tour_change_requests
for select
to authenticated
using (
  private.is_guide_for_profile(guide_id)
  or private.is_admin()
);

drop policy if exists "tour_change_requests_admin_all" on public.tour_change_requests;
create policy "tour_change_requests_admin_all"
on public.tour_change_requests
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "tours_guide_update_own" on public.tours;

drop policy if exists "tours_guide_insert_own" on public.tours;
create policy "tours_guide_insert_own"
on public.tours
for insert
to authenticated
with check (
  private.is_guide_for_profile(guide_id)
  and status = 'pending'
);

create or replace function public.submit_tour_change_request(
  p_tour_id uuid,
  p_payload jsonb
)
returns public.tour_change_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tour public.tours%rowtype;
  v_request public.tour_change_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select t.*
  into v_tour
  from public.tours t
  join public.guide_profiles gp on gp.id = t.guide_id
  where t.id = p_tour_id
    and gp.user_id = v_user_id;

  if not found then
    raise exception 'Tour not found or not owned by this guide';
  end if;

  select *
  into v_request
  from public.tour_change_requests
  where tour_id = p_tour_id
    and status = 'pending'
  limit 1;

  if found then
    update public.tour_change_requests
    set payload = p_payload,
        submitted_by = v_user_id,
        rejection_reason = null,
        reviewed_by = null,
        reviewed_at = null
    where id = v_request.id
    returning * into v_request;
  else
    insert into public.tour_change_requests (tour_id, guide_id, submitted_by, payload)
    values (p_tour_id, v_tour.guide_id, v_user_id, p_payload)
    returning * into v_request;
  end if;

  update public.tours
  set status = 'pending'
  where id = p_tour_id;

  return v_request;
end;
$$;

create or replace function public.review_tour_change_request(
  p_request_id uuid,
  p_decision text,
  p_reason text default ''
)
returns public.tour_change_requests
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request public.tour_change_requests%rowtype;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Admin privileges are required';
  end if;

  select *
  into v_request
  from public.tour_change_requests
  where id = p_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Pending tour change request not found';
  end if;

  if p_decision = 'approved' then
    update public.tours
    set title = coalesce(v_request.payload->>'title', title),
        city = coalesce(v_request.payload->>'city', city),
        type = coalesce(v_request.payload->>'type', type),
        description = coalesce(v_request.payload->>'description', description),
        content_html = coalesce(v_request.payload->>'content_html', content_html),
        price_amount = coalesce((v_request.payload->>'price_amount')::integer, price_amount),
        currency = coalesce(v_request.payload->>'currency', currency),
        payment_type = coalesce(v_request.payload->>'payment_type', payment_type),
        duration_minutes = coalesce((v_request.payload->>'duration_minutes')::integer, duration_minutes),
        max_people = coalesce((v_request.payload->>'max_people')::integer, max_people),
        options = coalesce(v_request.payload->'options', options),
        status = 'active'
    where id = v_request.tour_id;

    update public.tour_change_requests
    set status = 'approved',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = null
    where id = p_request_id
    returning * into v_request;
  elsif p_decision = 'rejected' then
    update public.tours
    set status = 'rejected'
    where id = v_request.tour_id;

    update public.tour_change_requests
    set status = 'rejected',
        reviewed_by = v_user_id,
        reviewed_at = now(),
        rejection_reason = nullif(p_reason, '')
    where id = p_request_id
    returning * into v_request;
  else
    raise exception 'Decision must be approved or rejected';
  end if;

  return v_request;
end;
$$;

revoke all on function public.submit_tour_change_request(uuid, jsonb) from public;
revoke all on function public.review_tour_change_request(uuid, text, text) from public;
grant execute on function public.submit_tour_change_request(uuid, jsonb) to authenticated;
grant execute on function public.review_tour_change_request(uuid, text, text) to authenticated;
