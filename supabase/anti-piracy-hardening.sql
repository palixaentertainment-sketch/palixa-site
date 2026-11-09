-- Tighten comic-page reads so unpublished chapters/books are not exposed
-- through the chapter_pages table API. Published pages remain readable.
-- Authors can preview pages belonging to their own books; admins retain access.

drop policy if exists "read pages" on public.chapter_pages;

create policy "read published or own pages"
  on public.chapter_pages
  for select
  using (
    exists (
      select 1
      from public.chapters c
      join public.books b on b.id = c.book_id
      where c.id = chapter_pages.chapter_id
        and (
          (c.status = 'published' and b.status = 'published')
          or b.author_id = auth.uid()
          or public.is_admin()
        )
    )
  );
