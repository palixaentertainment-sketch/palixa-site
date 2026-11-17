-- Keep the word-count figure on book pages without downloading every chapter body
-- to the visitor's browser. SECURITY INVOKER preserves the chapter table's RLS rules.
create or replace function public.book_published_word_count(p_book_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    sum(
      case
        when content is null or btrim(content) = '' then 0
        else cardinality(regexp_split_to_array(btrim(content), '[[:space:]]+'))
      end
    ),
    0
  )::bigint
  from public.chapters
  where book_id = p_book_id
    and status = 'published';
$$;

revoke all on function public.book_published_word_count(uuid) from public;
grant execute on function public.book_published_word_count(uuid) to anon, authenticated;
