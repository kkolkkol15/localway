drop policy if exists "guide_profiles_owner_select" on public.guide_profiles;
create policy "guide_profiles_owner_select"
on public.guide_profiles
for select
to authenticated
using (user_id = (select auth.uid()));
