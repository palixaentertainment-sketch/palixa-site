-- Palixia newsletter broadcasts and official activity-feed entries.
-- Additive migration: preserves existing notification recipient rules and triggers.

alter table public.notifications
  add column if not exists newsletter_id uuid,
  add column if not exists newsletter_title text,
  add column if not exists newsletter_body text,
  add column if not exists newsletter_image_url text,
  add column if not exists newsletter_button_label text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('community_like','community_comment','follow','new_book','new_chapter','palixia_news'));

create table if not exists public.palixia_newsletters (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 10000),
  image_url text,
  button_label text,
  link_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.palixia_newsletters enable row level security;
drop policy if exists "admins manage Palixia newsletters" on public.palixia_newsletters;
create policy "admins manage Palixia newsletters" on public.palixia_newsletters
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'));

grant select, insert, update on public.palixia_newsletters to authenticated;

create or replace function public.admin_send_palixia_newsletter(
  p_title text,
  p_body text,
  p_image_url text default null,
  p_button_label text default null,
  p_link_url text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_newsletter_id uuid;
  v_count integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception 'Only active Palixia admins can send newsletters';
  end if;

  if nullif(trim(p_title), '') is null or char_length(trim(p_title)) > 140 then
    raise exception 'Enter a newsletter title of 1 to 140 characters';
  end if;
  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 10000 then
    raise exception 'Enter newsletter text of 1 to 10000 characters';
  end if;
  if p_link_url is not null and not (p_link_url ~ '^https://' or (p_link_url like '/%' and p_link_url not like '//%')) then
    raise exception 'Newsletter links must use https:// or a Palixia path';
  end if;

  insert into public.palixia_newsletters(title, body, image_url, button_label, link_url, created_by, sent_at)
  values (trim(p_title), trim(p_body), nullif(trim(p_image_url), ''),
          nullif(trim(p_button_label), ''), nullif(trim(p_link_url), ''), auth.uid(), now())
  returning id into v_newsletter_id;

  insert into public.notifications(
    recipient_id, actor_id, kind, message, link_url,
    newsletter_id, newsletter_title, newsletter_body, newsletter_image_url, newsletter_button_label
  )
  select p.id, null, 'palixia_news', trim(p_title),
         coalesce(nullif(trim(p_link_url), ''), '/notifications'),
         v_newsletter_id, trim(p_title), trim(p_body), nullif(trim(p_image_url), ''),
         nullif(trim(p_button_label), '')
  from public.profiles p
  where p.status = 'active';

  get diagnostics v_count = row_count;
  return json_build_object('newsletter_id', v_newsletter_id, 'recipients', v_count);
end;
$$;

revoke all on function public.admin_send_palixia_newsletter(text,text,text,text,text) from public;
grant execute on function public.admin_send_palixia_newsletter(text,text,text,text,text) to authenticated;
