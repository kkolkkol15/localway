alter table public.profiles
add column if not exists is_guide boolean not null default false;

create index if not exists profiles_is_guide_idx on public.profiles(is_guide);

update public.profiles as profiles
set is_guide = true
where exists (
  select 1
  from public.guide_profiles
  where guide_profiles.user_id = profiles.id
)
and profiles.is_guide is distinct from true;

alter table public.profiles disable trigger profiles_prevent_privilege_escalation;

update public.profiles
set role = 'traveler'
where role = 'guide';

alter table public.profiles enable trigger profiles_prevent_privilege_escalation;

with ranked_applications as (
  select
    id,
    user_id,
    first_value(id) over (
      partition by user_id
      order by submitted_at asc, created_at asc, id asc
    ) as kept_application_id,
    row_number() over (
      partition by user_id
      order by submitted_at asc, created_at asc, id asc
    ) as row_number_for_user
  from public.guide_applications
  where status in ('pending', 'approved')
),
duplicate_applications as (
  select guide_applications.*, ranked_applications.kept_application_id
  from ranked_applications
  join public.guide_applications on guide_applications.id = ranked_applications.id
  where ranked_applications.row_number_for_user > 1
),
audit_insert as (
  insert into public.admin_audit_logs (actor_id, action, target_table, target_id, metadata)
  select
    null,
    'dedupe_duplicate_guide_application',
    'guide_applications',
    id,
    jsonb_build_object(
      'kept_application_id', kept_application_id,
      'deleted_application', to_jsonb(duplicate_applications)
    )
  from duplicate_applications
  returning target_id
)
delete from public.guide_applications
where id in (select target_id from audit_insert);

create unique index if not exists guide_applications_one_active_per_user_idx
on public.guide_applications(user_id)
where status in ('pending', 'approved');
