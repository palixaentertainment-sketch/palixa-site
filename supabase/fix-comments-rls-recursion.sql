-- Fix chapter-comment insert policy recursion.
-- The old policy queried public.comments to validate replies. Because RLS is enabled
-- on comments, that self-query recursively invoked the same policy (42P17).
-- This SECURITY DEFINER helper performs only the parent-reply validation and avoids
-- re-entering comments RLS. It does not expose comment content.

create or replace function public.palixia_parent_comment_is_valid(
  p_parent_id uuid,
  p_chapter_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.comments p
    where p.id = p_parent_id
      and p.chapter_id = p_chapter_id
      and p.parent_id is null
  );
$$;

revoke all on function public.palixia_parent_comment_is_valid(uuid, uuid) from public, anon;
grant execute on function public.palixia_parent_comment_is_valid(uuid, uuid) to authenticated;

drop policy if exists "palixia post comments" on public.comments;
create policy "palixia post comments"
on public.comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
  )
  and exists (
    select 1
    from public.chapters c
    join public.books b on b.id = c.book_id
    where c.id = chapter_id
      and c.status = 'published'
      and b.status = 'published'
  )
  and (
    parent_id is null
    or public.palixia_parent_comment_is_valid(parent_id, chapter_id)
  )
);
