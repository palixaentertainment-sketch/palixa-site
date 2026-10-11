-- Palixia visitor and reading analytics.
-- Run this file in Supabase SQL Editor before deploying the admin analytics feature.
-- Stores page paths and a random browser session ID; it does not collect IP addresses.

create table if not exists public.visitor_events (
  id bigint generated always as identity primary key,
  session_id text not null check (char_length(session_id) between 8 and 100),
  path text not null check (char_length(path) between 1 and 500),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null default 'page_view' check (event_type in ('page_view')),
  created_at timestamptz not null default now()
);

create index if not exists visitor_events_created_at_idx
  on public.visitor_events (created_at desc);
create index if not exists visitor_events_session_idx
  on public.visitor_events (session_id, created_at desc);
create index if not exists visitor_events_path_idx
  on public.visitor_events (path, created_at desc);

alter table public.visitor_events enable row level security;

drop policy if exists "visitors can record page views" on public.visitor_events;
create policy "visitors can record page views"
  on public.visitor_events for insert to anon, authenticated
  with check (
    (auth.uid() is null and user_id is null)
    or (auth.uid() is not null and (user_id is null or user_id = auth.uid()))
  );

drop policy if exists "admins can view visitor analytics" on public.visitor_events;
create policy "admins can view visitor analytics"
  on public.visitor_events for select to authenticated
  using (public.is_admin());

grant insert on public.visitor_events to anon, authenticated;
grant select on public.visitor_events to authenticated;

create or replace function public.admin_analytics_summary()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select json_build_object(
    'page_views', (select count(*) from public.visitor_events),
    'unique_visitors', (select count(distinct session_id) from public.visitor_events),
    'views_today', (select count(*) from public.visitor_events where created_at >= date_trunc('day', now())),
    'views_7_days', (select count(*) from public.visitor_events where created_at >= now() - interval '7 days'),
    'readers', (select count(distinct user_id) from public.chapter_reads),
    'authors', (select count(*) from public.profiles where role = 'author' and status = 'active'),
    'total_reads', (select coalesce(sum(reads), 0) from public.books where status = 'published'),
    'top_pages', coalesce((
      select json_agg(x) from (
        select path, count(*) as views
        from public.visitor_events
        where created_at >= now() - interval '30 days'
        group by path
        order by count(*) desc
        limit 5
      ) x
    ), '[]'::json)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_analytics_summary() from public, anon;
grant execute on function public.admin_analytics_summary() to authenticated;
