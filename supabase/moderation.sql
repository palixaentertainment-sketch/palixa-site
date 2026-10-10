-- Palixia moderation tools (additive migration; preserves existing content).
-- Run this file once in Supabase SQL Editor after deploying the moderation UI.

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('chapter_comment','community_post','community_comment','book','user')),
  target_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists moderation_reports_queue_idx on public.moderation_reports(status, created_at desc);
create index if not exists moderation_reports_target_idx on public.moderation_reports(target_type, target_id);
alter table public.moderation_reports enable row level security;

drop policy if exists "reporters and admins can read moderation reports" on public.moderation_reports;
create policy "reporters and admins can read moderation reports" on public.moderation_reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists "admins can update moderation reports" on public.moderation_reports;
create policy "admins can update moderation reports" on public.moderation_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.moderation_reports to authenticated;
grant update (status, admin_note, reviewed_by, reviewed_at) on public.moderation_reports to authenticated;

-- Let admins inspect comments across the platform. Mutations below use guarded RPC functions.
drop policy if exists "admins can inspect all chapter comments" on public.comments;
create policy "admins can inspect all chapter comments" on public.comments
  for select to authenticated using (public.is_admin());
drop policy if exists "admins can inspect all community comments" on public.community_comments;
create policy "admins can inspect all community comments" on public.community_comments
  for select to authenticated using (public.is_admin());
drop policy if exists "admins can inspect all community posts" on public.community_posts;
create policy "admins can inspect all community posts" on public.community_posts
  for select to authenticated using (public.is_admin());

create or replace function public.submit_moderation_report(p_target_type text, p_target_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then raise exception 'account_suspended'; end if;
  if char_length(btrim(coalesce(p_reason,''))) < 3 or char_length(btrim(p_reason)) > 500 then raise exception 'invalid_reason'; end if;
  if p_target_type not in ('chapter_comment','community_post','community_comment','book','user') then raise exception 'invalid_target'; end if;
  if p_target_type = 'chapter_comment' and not exists(select 1 from public.comments where id=p_target_id) then raise exception 'target_not_found'; end if;
  if p_target_type = 'community_post' and not exists(select 1 from public.community_posts where id=p_target_id) then raise exception 'target_not_found'; end if;
  if p_target_type = 'community_comment' and not exists(select 1 from public.community_comments where id=p_target_id) then raise exception 'target_not_found'; end if;
  if p_target_type = 'book' and not exists(select 1 from public.books where id=p_target_id) then raise exception 'target_not_found'; end if;
  if p_target_type = 'user' and (not exists(select 1 from public.profiles where id=p_target_id) or p_target_id=auth.uid()) then raise exception 'invalid_target'; end if;
  insert into public.moderation_reports(reporter_id,target_type,target_id,reason)
  values(auth.uid(),p_target_type,p_target_id,btrim(p_reason)) returning id into new_id;
  return new_id;
end; $$;

create or replace function public.admin_set_profile_status(p_user_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('active','suspended') then raise exception 'invalid_status'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_change_own_status'; end if;
  if exists(select 1 from public.profiles where id=p_user_id and role='admin') then raise exception 'cannot_suspend_admin'; end if;
  update public.profiles set status=p_status where id=p_user_id;
  if not found then raise exception 'user_not_found'; end if;
end; $$;

create or replace function public.admin_set_chapter_comment_status(p_comment_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('visible','hidden') then raise exception 'invalid_status'; end if;
  update public.comments set status=p_status where id=p_comment_id;
  if not found then raise exception 'comment_not_found'; end if;
end; $$;

create or replace function public.admin_set_community_comment_status(p_comment_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('visible','hidden') then raise exception 'invalid_status'; end if;
  update public.community_comments set status=p_status where id=p_comment_id;
  if not found then raise exception 'comment_not_found'; end if;
end; $$;

create or replace function public.admin_set_community_post_status(p_post_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('visible','hidden') then raise exception 'invalid_status'; end if;
  update public.community_posts set status=p_status, updated_at=now() where id=p_post_id;
  if not found then raise exception 'post_not_found'; end if;
end; $$;

create or replace function public.admin_set_book_status(p_book_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('published','unpublished') then raise exception 'invalid_status'; end if;
  update public.books set status=p_status, updated_at=now()
  where id=p_book_id and status <> 'draft';
  if not found then raise exception 'published_book_not_found'; end if;
end; $$;

create or replace function public.admin_resolve_moderation_report(p_report_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('reviewed','dismissed','open') then raise exception 'invalid_status'; end if;
  update public.moderation_reports set status=p_status, admin_note=left(coalesce(p_note,''),1000),
    reviewed_by=case when p_status='open' then null else auth.uid() end,
    reviewed_at=case when p_status='open' then null else now() end
  where id=p_report_id;
  if not found then raise exception 'report_not_found'; end if;
end; $$;

revoke all on function public.submit_moderation_report(text,uuid,text) from public, anon;
grant execute on function public.submit_moderation_report(text,uuid,text) to authenticated;
revoke all on function public.admin_set_profile_status(uuid,text,text) from public, anon;
revoke all on function public.admin_set_chapter_comment_status(uuid,text) from public, anon;
revoke all on function public.admin_set_community_comment_status(uuid,text) from public, anon;
revoke all on function public.admin_set_community_post_status(uuid,text) from public, anon;
revoke all on function public.admin_set_book_status(uuid,text) from public, anon;
revoke all on function public.admin_resolve_moderation_report(uuid,text,text) from public, anon;
grant execute on function public.admin_set_profile_status(uuid,text,text) to authenticated;
grant execute on function public.admin_set_chapter_comment_status(uuid,text) to authenticated;
grant execute on function public.admin_set_community_comment_status(uuid,text) to authenticated;
grant execute on function public.admin_set_community_post_status(uuid,text) to authenticated;
grant execute on function public.admin_set_book_status(uuid,text) to authenticated;
grant execute on function public.admin_resolve_moderation_report(uuid,text,text) to authenticated;


-- Suspended accounts may still sign in to see the suspension notice, but cannot create new content.
drop policy if exists "palixia post comments" on public.comments;
create policy "palixia post comments" on public.comments for insert to authenticated with check (
  auth.uid() = user_id
  and exists (select 1 from public.profiles p where p.id=auth.uid() and p.status='active')
  and exists (select 1 from public.chapters c join public.books b on b.id=c.book_id where c.id=chapter_id and c.status='published' and b.status='published')
  and (parent_id is null or exists (select 1 from public.comments parent where parent.id=parent_id and parent.chapter_id=chapter_id and parent.parent_id is null))
);

drop policy if exists "community create own posts" on public.community_posts;
create policy "community create own posts" on public.community_posts for insert to authenticated
with check (
  user_id=auth.uid()
  and exists (select 1 from public.profiles p where p.id=auth.uid() and p.status='active')
  and status='visible'
  and (book_id is null or exists(select 1 from public.books b where b.id=book_id and b.status='published'))
);

drop policy if exists "community create comments" on public.community_comments;
create policy "community create comments" on public.community_comments for insert to authenticated
with check (
  user_id=auth.uid()
  and exists (select 1 from public.profiles p where p.id=auth.uid() and p.status='active')
  and status='visible'
  and exists(select 1 from public.community_posts p where p.id=post_id and p.status='visible')
  and (parent_id is null or public.community_parent_comment_is_valid(parent_id, post_id))
);

-- A suspended user cannot submit moderation reports.
create or replace function public.submit_moderation_report(p_target_type text, p_target_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status = 'active') then raise exception 'account_suspended'; end if;
  if char_length(btrim(coalesce(p_reason,''))) < 3 or char_length(btrim(p_reason)) > 500 then raise exception 'invalid_reason'; end if;
  if p_target_type not in ('chapter_comment','community_post','community_comment','book','user') then raise exception 'invalid_target'; end if;
  if p_target_type = 'chapter_comment' and not exists(select 1 from public.comments where id=p_target_id) then raise exception 'target_not_found'; end if;
  if p_target_type = 'community_post' and not exists(select 1 from public.community_posts where id=p_target_id) then raise exception 'target_not_found'; end if;
  if p_target_type = 'community_comment' and not exists(select 1 from public.community_comments where id=p_target_id) then raise exception 'target_not_found'; end if;
  if p_target_type = 'book' and not exists(select 1 from public.books where id=p_target_id) then raise exception 'target_not_found'; end if;
  if p_target_type = 'user' and (not exists(select 1 from public.profiles where id=p_target_id) or p_target_id=auth.uid()) then raise exception 'invalid_target'; end if;
  insert into public.moderation_reports(reporter_id,target_type,target_id,reason)
  values(auth.uid(),p_target_type,p_target_id,btrim(p_reason)) returning id into new_id;
  return new_id;
end; $$;


-- Audit trail for administrator actions.
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists moderation_actions_created_idx on public.moderation_actions(created_at desc);
alter table public.moderation_actions enable row level security;
drop policy if exists "admins read moderation action log" on public.moderation_actions;
create policy "admins read moderation action log" on public.moderation_actions
  for select to authenticated using (public.is_admin());
grant select on public.moderation_actions to authenticated;

create or replace function public.admin_set_profile_status(p_user_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('active','suspended') then raise exception 'invalid_status'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_change_own_status'; end if;
  if exists(select 1 from public.profiles where id=p_user_id and role='admin') then raise exception 'cannot_suspend_admin'; end if;
  update public.profiles set status=p_status where id=p_user_id;
  if not found then raise exception 'user_not_found'; end if;
  insert into public.moderation_actions(admin_id,action,target_type,target_id,reason)
  values(auth.uid(),case when p_status='suspended' then 'suspend_user' else 'restore_user' end,'user',p_user_id,left(coalesce(p_reason,''),1000));
end; $$;

create or replace function public.admin_set_chapter_comment_status(p_comment_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('visible','hidden') then raise exception 'invalid_status'; end if;
  update public.comments set status=p_status where id=p_comment_id;
  if not found then raise exception 'comment_not_found'; end if;
  insert into public.moderation_actions(admin_id,action,target_type,target_id)
  values(auth.uid(),case when p_status='hidden' then 'hide_comment' else 'restore_comment' end,'chapter_comment',p_comment_id);
end; $$;

create or replace function public.admin_set_community_comment_status(p_comment_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('visible','hidden') then raise exception 'invalid_status'; end if;
  update public.community_comments set status=p_status where id=p_comment_id;
  if not found then raise exception 'comment_not_found'; end if;
  insert into public.moderation_actions(admin_id,action,target_type,target_id)
  values(auth.uid(),case when p_status='hidden' then 'hide_comment' else 'restore_comment' end,'community_comment',p_comment_id);
end; $$;

create or replace function public.admin_set_community_post_status(p_post_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('visible','hidden') then raise exception 'invalid_status'; end if;
  update public.community_posts set status=p_status, updated_at=now() where id=p_post_id;
  if not found then raise exception 'post_not_found'; end if;
  insert into public.moderation_actions(admin_id,action,target_type,target_id)
  values(auth.uid(),case when p_status='hidden' then 'hide_post' else 'restore_post' end,'community_post',p_post_id);
end; $$;

create or replace function public.admin_set_book_status(p_book_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('published','unpublished') then raise exception 'invalid_status'; end if;
  update public.books set status=p_status, updated_at=now()
  where id=p_book_id and status <> 'draft';
  if not found then raise exception 'published_book_not_found'; end if;
  insert into public.moderation_actions(admin_id,action,target_type,target_id)
  values(auth.uid(),case when p_status='unpublished' then 'unpublish_book' else 'republish_book' end,'book',p_book_id);
end; $$;

create or replace function public.admin_resolve_moderation_report(p_report_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare target_kind text; target_uuid uuid;
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('reviewed','dismissed','open') then raise exception 'invalid_status'; end if;
  select target_type,target_id into target_kind,target_uuid from public.moderation_reports where id=p_report_id;
  if not found then raise exception 'report_not_found'; end if;
  update public.moderation_reports set status=p_status, admin_note=left(coalesce(p_note,''),1000),
    reviewed_by=case when p_status='open' then null else auth.uid() end,
    reviewed_at=case when p_status='open' then null else now() end
  where id=p_report_id;
  insert into public.moderation_actions(admin_id,action,target_type,target_id,reason)
  values(auth.uid(),'report_'||p_status,target_kind,target_uuid,left(coalesce(p_note,''),1000));
end; $$;


-- Keep one report per person per item and import any existing Community post reports.
create unique index if not exists moderation_reports_one_per_reporter_target_idx
  on public.moderation_reports(reporter_id, target_type, target_id);
insert into public.moderation_reports(reporter_id,target_type,target_id,reason,status,created_at)
select reporter_id,'community_post',post_id,reason,
  case when status in ('reviewed','dismissed') then status else 'open' end,created_at
from public.community_reports
on conflict (reporter_id,target_type,target_id) do nothing;
