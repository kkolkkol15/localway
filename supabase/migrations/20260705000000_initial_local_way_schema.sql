create extension if not exists pgcrypto;
create schema if not exists private;
grant usage on schema private to anon;
grant usage on schema private to authenticated;

create type public.user_role as enum ('traveler', 'guide', 'admin');
create type public.account_status as enum ('active', 'suspended', 'banned');
create type public.application_status as enum ('pending', 'approved', 'rejected');
create type public.tour_status as enum ('draft', 'pending', 'active', 'paused', 'rejected');
create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type public.review_status as enum ('visible', 'hidden', 'deleted');
create type public.refund_status as enum ('pending', 'processing', 'approved', 'rejected');
create type public.settlement_status as enum ('pending', 'processing', 'paid', 'held');
create type public.ticket_status as enum ('open', 'processing', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_path text,
  role public.user_role not null default 'traveler',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guide_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  real_name text not null,
  nationality text not null,
  birth_date date not null,
  gender text not null,
  city text not null,
  residence_years integer not null default 0 check (residence_years >= 0),
  native_language text not null,
  additional_languages text[] not null default '{}',
  intro text not null,
  profile_image_path text not null,
  id_document_image_path text not null,
  status public.application_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guide_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  city text not null,
  languages text[] not null default '{}',
  intro text not null,
  profile_image_path text,
  rating_avg numeric(3, 2) not null default 0 check (rating_avg >= 0 and rating_avg <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guide_profiles(id) on delete cascade,
  city text not null,
  title text not null,
  type text not null,
  description text not null,
  price_amount integer not null check (price_amount >= 0),
  currency text not null default 'USD',
  payment_type text not null check (payment_type in ('pay_as_you_go', 'package')),
  duration_minutes integer not null check (duration_minutes > 0),
  max_people integer not null check (max_people > 0),
  status public.tour_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tour_images (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id),
  traveler_id uuid not null references public.profiles(id),
  guide_id uuid not null references public.guide_profiles(id),
  reserved_date date not null,
  people_count integer not null check (people_count > 0),
  amount integer not null check (amount >= 0),
  currency text not null default 'USD',
  status public.reservation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete cascade,
  tour_id uuid not null references public.tours(id),
  author_id uuid not null references public.profiles(id),
  guide_id uuid not null references public.guide_profiles(id),
  rating integer not null check (rating between 1 and 5),
  content text not null,
  status public.review_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  requester_id uuid not null references public.profiles(id),
  reason text not null,
  status public.refund_status not null default 'pending',
  decision_reason text,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guide_profiles(id),
  amount integer not null check (amount >= 0),
  currency text not null default 'USD',
  cycle text not null,
  status public.settlement_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  subject text not null,
  description text not null,
  status public.ticket_status not null default 'open',
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_public boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_status_idx on public.profiles(status);
create index guide_applications_user_id_idx on public.guide_applications(user_id);
create index guide_applications_status_idx on public.guide_applications(status);
create index guide_profiles_user_id_idx on public.guide_profiles(user_id);
create index guide_profiles_city_idx on public.guide_profiles(city);
create index tours_guide_id_idx on public.tours(guide_id);
create index tours_active_city_idx on public.tours(city) where status = 'active';
create index tour_images_tour_id_sort_idx on public.tour_images(tour_id, sort_order);
create index reservations_traveler_id_idx on public.reservations(traveler_id);
create index reservations_guide_id_idx on public.reservations(guide_id);
create index reviews_tour_id_idx on public.reviews(tour_id) where status = 'visible';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger guide_applications_set_updated_at before update on public.guide_applications for each row execute function public.set_updated_at();
create trigger guide_profiles_set_updated_at before update on public.guide_profiles for each row execute function public.set_updated_at();
create trigger tours_set_updated_at before update on public.tours for each row execute function public.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews for each row execute function public.set_updated_at();
create trigger refunds_set_updated_at before update on public.refunds for each row execute function public.set_updated_at();
create trigger settlements_set_updated_at before update on public.settlements for each row execute function public.set_updated_at();
create trigger support_tickets_set_updated_at before update on public.support_tickets for each row execute function public.set_updated_at();
create trigger notices_set_updated_at before update on public.notices for each row execute function public.set_updated_at();

create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (old.role is distinct from new.role or old.status is distinct from new.status) and not private.is_admin() then
    raise exception 'Only admins can change profile role or status';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_profile_privilege_escalation() from public;

create trigger profiles_prevent_privilege_escalation
before update on public.profiles
for each row
execute function private.prevent_profile_privilege_escalation();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'active'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon;
grant execute on function private.is_admin() to authenticated;

create or replace function private.is_guide_for_profile(guide_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.guide_profiles
    where id = guide_profile_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke all on function private.is_guide_for_profile(uuid) from public;
grant execute on function private.is_guide_for_profile(uuid) to authenticated;

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'Traveler'), '@', 1), 'Traveler'),
    'traveler'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user() from public;

create trigger auth_users_create_profile
after insert on auth.users
for each row
execute function private.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.guide_applications enable row level security;
alter table public.guide_profiles enable row level security;
alter table public.tours enable row level security;
alter table public.tour_images enable row level security;
alter table public.reservations enable row level security;
alter table public.reviews enable row level security;
alter table public.refunds enable row level security;
alter table public.settlements enable row level security;
alter table public.support_tickets enable row level security;
alter table public.notices enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated using ((select auth.uid()) = id or private.is_admin());
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id and role = 'traveler');
create policy "profiles_update_own_basic" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_admin_update" on public.profiles for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "guide_applications_select_own_or_admin" on public.guide_applications for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy "guide_applications_insert_own_pending" on public.guide_applications for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy "guide_applications_update_own_pending" on public.guide_applications for update to authenticated using (user_id = (select auth.uid()) and status = 'pending') with check (user_id = (select auth.uid()) and status = 'pending');
create policy "guide_applications_admin_update" on public.guide_applications for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "guide_profiles_public_active_select" on public.guide_profiles for select to anon, authenticated using (status = 'active');
create policy "guide_profiles_admin_select" on public.guide_profiles for select to authenticated using (private.is_admin());
create policy "guide_profiles_owner_update" on public.guide_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "guide_profiles_admin_all" on public.guide_profiles for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "tours_public_active_select" on public.tours for select to anon, authenticated using (status = 'active');
create policy "tours_guide_select_own" on public.tours for select to authenticated using (private.is_guide_for_profile(guide_id));
create policy "tours_guide_insert_own" on public.tours for insert to authenticated with check (private.is_guide_for_profile(guide_id));
create policy "tours_guide_update_own" on public.tours for update to authenticated using (private.is_guide_for_profile(guide_id)) with check (private.is_guide_for_profile(guide_id));
create policy "tours_admin_all" on public.tours for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "tour_images_public_active_select" on public.tour_images for select to anon, authenticated using (exists (select 1 from public.tours where tours.id = tour_images.tour_id and tours.status = 'active'));
create policy "tour_images_guide_all_own" on public.tour_images for all to authenticated using (exists (select 1 from public.tours where tours.id = tour_images.tour_id and private.is_guide_for_profile(tours.guide_id))) with check (exists (select 1 from public.tours where tours.id = tour_images.tour_id and private.is_guide_for_profile(tours.guide_id)));
create policy "tour_images_admin_all" on public.tour_images for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "reservations_select_participants_or_admin" on public.reservations for select to authenticated using (traveler_id = (select auth.uid()) or private.is_guide_for_profile(guide_id) or private.is_admin());
create policy "reservations_insert_traveler" on public.reservations for insert to authenticated with check (traveler_id = (select auth.uid()));
create policy "reservations_update_participants_or_admin" on public.reservations for update to authenticated using (traveler_id = (select auth.uid()) or private.is_guide_for_profile(guide_id) or private.is_admin()) with check (traveler_id = (select auth.uid()) or private.is_guide_for_profile(guide_id) or private.is_admin());

create policy "reviews_public_visible_select" on public.reviews for select to anon, authenticated using (status = 'visible');
create policy "reviews_author_insert" on public.reviews for insert to authenticated with check (author_id = (select auth.uid()));
create policy "reviews_author_update" on public.reviews for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "reviews_admin_all" on public.reviews for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "refunds_select_participant_or_admin" on public.refunds for select to authenticated using (requester_id = (select auth.uid()) or private.is_admin());
create policy "refunds_insert_requester" on public.refunds for insert to authenticated with check (requester_id = (select auth.uid()));
create policy "refunds_admin_update" on public.refunds for update to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "settlements_select_guide_or_admin" on public.settlements for select to authenticated using (private.is_guide_for_profile(guide_id) or private.is_admin());
create policy "settlements_admin_all" on public.settlements for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "support_tickets_select_author_or_admin" on public.support_tickets for select to authenticated using (author_id = (select auth.uid()) or private.is_admin());
create policy "support_tickets_insert_author" on public.support_tickets for insert to authenticated with check (author_id = (select auth.uid()));
create policy "support_tickets_update_author_or_admin" on public.support_tickets for update to authenticated using (author_id = (select auth.uid()) or private.is_admin()) with check (author_id = (select auth.uid()) or private.is_admin());

create policy "notices_public_select" on public.notices for select to anon, authenticated using (is_public or private.is_admin());
create policy "notices_admin_all" on public.notices for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "admin_audit_logs_admin_select" on public.admin_audit_logs for select to authenticated using (private.is_admin());
create policy "admin_audit_logs_admin_insert" on public.admin_audit_logs for insert to authenticated with check (private.is_admin());

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('tour-images', 'tour-images', true),
  ('guide-verification', 'guide-verification', false)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars_owner_insert" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_owner_update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text) with check (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);

create policy "tour_images_public_read" on storage.objects for select to anon, authenticated using (bucket_id = 'tour-images');
create policy "tour_images_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = 'tour-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "tour_images_owner_update" on storage.objects for update to authenticated using (bucket_id = 'tour-images' and owner_id = (select auth.uid())::text) with check (bucket_id = 'tour-images' and owner_id = (select auth.uid())::text);

create policy "guide_verification_owner_insert" on storage.objects for insert to authenticated with check (bucket_id = 'guide-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "guide_verification_owner_or_admin_read" on storage.objects for select to authenticated using (bucket_id = 'guide-verification' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin()));
create policy "guide_verification_owner_update" on storage.objects for update to authenticated using (bucket_id = 'guide-verification' and owner_id = (select auth.uid())::text) with check (bucket_id = 'guide-verification' and owner_id = (select auth.uid())::text);
