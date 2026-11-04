-- Admin-only reader activity and book momentum.
-- Reading progress remains private to each reader; this SECURITY DEFINER RPC
-- exposes a limited operational view only to active Palixia administrators.

create or replace function public.admin_reader_activity(p_limit integer default 500)
returns table (
  user_id uuid,
  reader_name text,
  reader_username text,
  reader_avatar text,
  book_id uuid,
  book_title text,
  book_cover text,
  author_name text,
  chapter_id uuid,
  chapter_title text,
  chapter_number integer,
  progress numeric,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
  select
    rp.user_id,
    coalesce(p.name, 'Reader')::text,
    coalesce(p.username, '')::text,
    coalesce(p.avatar_url, '')::text,
    b.id,
    b.title::text,
    coalesce(b.cover_url, '')::text,
    coalesce(author.name, '')::text,
    rp.chapter_id,
    coalesce(c.title, '')::text,
    coalesce(c.chapter_number, 0)::integer,
    coalesce(rp.progress, 0)::numeric,
    rp.updated_at
  from public.reading_progress rp
  join public.profiles p on p.id = rp.user_id
  join public.books b on b.id = rp.book_id
  join public.profiles author on author.id = b.author_id
  left join public.chapters c on c.id = rp.chapter_id
  where p.status = 'active'
    and b.status = 'published'
  order by rp.updated_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 500), 1000));
end;
$$;

revoke all on function public.admin_reader_activity(integer) from public, anon;
grant execute on function public.admin_reader_activity(integer) to authenticated;
