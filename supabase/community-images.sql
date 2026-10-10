-- Palixia Community image posts: additive migration.
-- Run this once in Supabase SQL Editor after the existing Community setup.
-- Existing text-only posts remain unchanged.

alter table public.community_posts
  add column if not exists image_url text;

grant insert (user_id, category, body, image_url, book_id)
  on public.community_posts to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Palixia community images are public" on storage.objects;
create policy "Palixia community images are public"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'community-images');

drop policy if exists "Users upload their own community images" on storage.objects;
create policy "Users upload their own community images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own community images" on storage.objects;
create policy "Users delete their own community images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
