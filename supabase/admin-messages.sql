-- Palixia admin-to-user messaging. Additive: does not modify existing notification tables.
create table if not exists public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 1 and 160),
  body text not null check (char_length(body) between 1 and 10000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  audience text not null check (audience in ('all','authors','readers','selected')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.admin_messages(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, recipient_id)
);

create index if not exists admin_message_recipients_user_created_idx
  on public.admin_message_recipients(recipient_id, created_at desc);
create index if not exists admin_message_recipients_unread_idx
  on public.admin_message_recipients(recipient_id) where read_at is null;

alter table public.admin_messages enable row level security;
alter table public.admin_message_recipients enable row level security;

drop policy if exists "users read messages addressed to them" on public.admin_messages;
create policy "users read messages addressed to them" on public.admin_messages
  for select to authenticated
  using (exists (
    select 1 from public.admin_message_recipients r
    where r.message_id = admin_messages.id and r.recipient_id = auth.uid()
  ));

drop policy if exists "users read own message receipts" on public.admin_message_recipients;
create policy "users read own message receipts" on public.admin_message_recipients
  for select to authenticated using (recipient_id = auth.uid());

drop policy if exists "users mark own messages read" on public.admin_message_recipients;
create policy "users mark own messages read" on public.admin_message_recipients
  for update to authenticated using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke all on public.admin_messages from anon, authenticated;
revoke all on public.admin_message_recipients from anon, authenticated;
grant select on public.admin_messages, public.admin_message_recipients to authenticated;
grant update (read_at) on public.admin_message_recipients to authenticated;

create or replace function public.admin_send_message(
  p_subject text,
  p_body text,
  p_audience text default 'all',
  p_user_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only Palixia administrators can send messages' using errcode = '42501';
  end if;

  if nullif(trim(p_subject), '') is null or char_length(trim(p_subject)) > 160 then
    raise exception 'Subject must be between 1 and 160 characters';
  end if;
  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 10000 then
    raise exception 'Message must be between 1 and 10000 characters';
  end if;
  if p_audience not in ('all','authors','readers','selected') then
    raise exception 'Invalid message audience';
  end if;
  if p_audience = 'selected' and coalesce(array_length(p_user_ids, 1), 0) = 0 then
    raise exception 'Choose at least one recipient';
  end if;

  insert into public.admin_messages(subject, body, created_by, audience)
  values (trim(p_subject), trim(p_body), auth.uid(), p_audience)
  returning id into v_message_id;

  insert into public.admin_message_recipients(message_id, recipient_id)
  select v_message_id, p.id
  from public.profiles p
  where p.status = 'active'
    and (
      p_audience = 'all'
      or (p_audience = 'authors' and p.role = 'author')
      or (p_audience = 'readers' and p.role = 'reader')
      or (p_audience = 'selected' and p.id = any(p_user_ids))
    )
  on conflict (message_id, recipient_id) do nothing;

  return v_message_id;
end;
$$;

revoke all on function public.admin_send_message(text,text,text,uuid[]) from public, anon;
grant execute on function public.admin_send_message(text,text,text,uuid[]) to authenticated;
