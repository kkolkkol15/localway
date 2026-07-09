create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (
    old.role is distinct from new.role
    or old.status is distinct from new.status
    or old.is_guide is distinct from new.is_guide
  ) and not private.is_admin() then
    raise exception 'Only admins can change profile role, status, or guide capability';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_profile_privilege_escalation() from public;
