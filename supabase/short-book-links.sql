-- Short, readable book URLs. Existing UUID URLs continue to work.
alter table public.books add column if not exists slug text;

create or replace function public.palixia_slugify(value text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$;

-- Backfill stable, unique slugs for existing books.
with prepared as (
  select id, public.palixia_slugify(title) as base_slug,
         row_number() over (
           partition by public.palixia_slugify(title)
           order by created_at, id
         ) as duplicate_number
  from public.books
)
update public.books b
set slug = case
  when p.duplicate_number = 1 then p.base_slug
  else p.base_slug || '-' || left(replace(b.id::text, '-', ''), 8)
end
from prepared p
where p.id = b.id and (b.slug is null or b.slug = '');

-- A unique index protects titles that collide now or in the future.
create unique index if not exists books_slug_unique_idx on public.books (slug);

create or replace function public.set_book_slug()
returns trigger language plpgsql set search_path = public as $$
declare
  base_slug text;
begin
  if new.slug is not null and new.slug <> '' and
     (tg_op = 'INSERT' or new.title is not distinct from old.title) then
    return new;
  end if;
  base_slug := public.palixia_slugify(new.title);
  if base_slug = '' then base_slug := 'book'; end if;
  if exists (select 1 from public.books b where b.slug = base_slug and b.id <> new.id) then
    new.slug := base_slug || '-' || left(replace(new.id::text, '-', ''), 8);
  else
    new.slug := base_slug;
  end if;
  return new;
end;
$$;

drop trigger if exists books_set_slug on public.books;
create trigger books_set_slug
before insert or update of title on public.books
for each row execute function public.set_book_slug();

grant select (slug) on public.books to anon, authenticated;

-- Expose the slug to the existing catalogue cards without changing their current fields.
create or replace view public.book_cards with (security_invoker = true) as
select
  b.id, b.author_id, b.title, b.description, b.cover_url, b.book_type, b.tags,
  b.reads, b.featured, b.is_sample, b.created_at,
  b.genre_id, g.name as genre_name, g.slug as genre_slug,
  p.name as author_name, p.username as author_username, p.avatar_url as author_avatar,
  (select count(*) from public.chapters c where c.book_id = b.id and c.status = 'published')::int as chapter_count,
  lower(b.title || ' ' || p.name || ' ' || p.username || ' ' || coalesce(g.name, '') || ' ' ||
        coalesce(array_to_string(b.tags, ' '), '')) as search,
  b.story_status,
  b.slug
from public.books b
join public.profiles p on p.id = b.author_id
left join public.genres g on g.id = b.genre_id
where b.status = 'published' and p.status = 'active';
