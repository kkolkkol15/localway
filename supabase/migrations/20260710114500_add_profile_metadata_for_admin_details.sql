alter table public.profiles
  add column if not exists metadata jsonb not null default '{}'::jsonb;
