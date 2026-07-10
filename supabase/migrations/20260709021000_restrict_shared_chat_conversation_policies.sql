drop policy if exists "conversations_participant_insert" on public.conversations;

create policy "conversations_participant_insert"
on public.conversations
for insert
to authenticated
with check (
  (
    private.is_admin()
    and type = 'admin'
  )
  or (
    type <> 'admin'
    and reply_enabled = true
    and created_by is null
    and (
      traveler_id = (select auth.uid())
      or participant_id = (select auth.uid())
      or private.is_guide_for_profile(guide_id)
    )
  )
);

drop policy if exists "conversations_participant_update" on public.conversations;

create policy "conversations_participant_update"
on public.conversations
for update
to authenticated
using (
  private.is_admin()
  or (
    type <> 'admin'
    and (
      traveler_id = (select auth.uid())
      or participant_id = (select auth.uid())
      or private.is_guide_for_profile(guide_id)
    )
  )
)
with check (
  private.is_admin()
  or (
    type <> 'admin'
    and created_by is null
    and reply_enabled = true
    and (
      traveler_id = (select auth.uid())
      or participant_id = (select auth.uid())
      or private.is_guide_for_profile(guide_id)
    )
  )
);
