insert into storage.buckets (id, name, public)
values ('tour-videos', 'tour-videos', true)
on conflict (id) do nothing;

create policy "tour_videos_public_read" on storage.objects
for select to anon, authenticated
using (bucket_id = 'tour-videos');

create policy "tour_videos_authenticated_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'tour-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "tour_videos_owner_update" on storage.objects
for update to authenticated
using (bucket_id = 'tour-videos' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'tour-videos' and owner_id = (select auth.uid())::text);
