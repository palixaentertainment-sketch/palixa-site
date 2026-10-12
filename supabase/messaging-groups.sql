-- Palixia messaging and reading groups.
-- Additive migration only: does not alter or delete existing Palixia tables or data.
create extension if not exists pgcrypto;

create table if not exists public.messaging_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  allow_private_messages boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reading_groups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  group_type text not null default 'community' check (group_type in ('book', 'community')),
  book_id uuid references public.books(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((group_type = 'book' and book_id is not null) or group_type = 'community')
);

create index if not exists reading_groups_creator_idx on public.reading_groups(creator_id);
create index if not exists reading_groups_book_idx on public.reading_groups(book_id);
create index if not exists reading_groups_visibility_idx on public.reading_groups(visibility, created_at desc);

create table if not exists public.reading_group_members (
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'moderator', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists reading_group_members_user_idx on public.reading_group_members(user_id);

create table if not exists public.reading_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.reading_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists reading_group_messages_group_time_idx on public.reading_group_messages(group_id, created_at desc);

create table if not exists public.private_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_one uuid not null references public.profiles(id) on delete cascade,
  participant_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (participant_one <> participant_two),
  check (participant_one < participant_two),
  unique (participant_one, participant_two)
);

create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists private_messages_conversation_time_idx on public.private_messages(conversation_id, created_at desc);

-- SECURITY DEFINER helpers prevent recursive row-level-security checks on membership tables.
create or replace function public.is_reading_group_member(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reading_group_members m
    where m.group_id = p_group_id and m.user_id = p_user_id
  );
$$;

create or replace function public.is_reading_group_manager(p_group_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reading_groups g
    where g.id = p_group_id and g.creator_id = p_user_id
  ) or exists (
    select 1 from public.reading_group_members m
    where m.group_id = p_group_id and m.user_id = p_user_id
      and m.member_role in ('owner', 'moderator')
  );
$$;

create or replace function public.is_private_conversation_participant(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.private_conversations c
    where c.id = p_conversation_id
      and p_user_id in (c.participant_one, c.participant_two)
  );
$$;

alter table public.messaging_preferences enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reading_groups enable row level security;
alter table public.reading_group_members enable row level security;
alter table public.reading_group_messages enable row level security;
alter table public.private_conversations enable row level security;
alter table public.private_messages enable row level security;

-- Preferences and blocks are private to the account owner.
drop policy if exists "read own messaging preferences" on public.messaging_preferences;
create policy "read own messaging preferences" on public.messaging_preferences for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "insert own messaging preferences" on public.messaging_preferences;
create policy "insert own messaging preferences" on public.messaging_preferences for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "update own messaging preferences" on public.messaging_preferences;
create policy "update own messaging preferences" on public.messaging_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own blocks" on public.user_blocks;
create policy "read own blocks" on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());
drop policy if exists "create own blocks" on public.user_blocks;
create policy "create own blocks" on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());
drop policy if exists "remove own blocks" on public.user_blocks;
create policy "remove own blocks" on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- Groups: anyone can discover public groups; private groups are visible to members/creator.
drop policy if exists "discover public or own groups" on public.reading_groups;
create policy "discover public or own groups" on public.reading_groups for select to authenticated
  using (visibility = 'public' or creator_id = auth.uid() or public.is_reading_group_member(id));
drop policy if exists "discover public groups anon" on public.reading_groups;
create policy "discover public groups anon" on public.reading_groups for select to anon
  using (visibility = 'public');
drop policy if exists "create own reading groups" on public.reading_groups;
create policy "create own reading groups" on public.reading_groups for insert to authenticated
  with check (
    creator_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
    and (
      group_type = 'community'
      or exists (select 1 from public.books b where b.id = book_id and b.author_id = auth.uid())
    )
  );
drop policy if exists "edit own reading groups" on public.reading_groups;
create policy "edit own reading groups" on public.reading_groups for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
drop policy if exists "delete own reading groups" on public.reading_groups;
create policy "delete own reading groups" on public.reading_groups for delete to authenticated
  using (creator_id = auth.uid());

-- Membership: a user can join public groups; managers can add members to groups they manage.
drop policy if exists "view group memberships" on public.reading_group_members;
create policy "view group memberships" on public.reading_group_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_reading_group_manager(group_id)
    or public.is_reading_group_member(group_id)
  );
drop policy if exists "join public groups or manager adds" on public.reading_group_members;
create policy "join public groups or manager adds" on public.reading_group_members for insert to authenticated
  with check (
    (user_id = auth.uid() and exists (
      select 1 from public.reading_groups g where g.id = group_id and g.visibility = 'public'
    ))
    or public.is_reading_group_manager(group_id)
  );
drop policy if exists "leave group or manager removes" on public.reading_group_members;
create policy "leave group or manager removes" on public.reading_group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_reading_group_manager(group_id));

-- The group creator's owner membership is added automatically.
create or replace function public.add_reading_group_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.reading_group_members(group_id, user_id, member_role)
  values (new.id, new.creator_id, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists reading_group_owner_membership on public.reading_groups;
create trigger reading_group_owner_membership
  after insert on public.reading_groups
  for each row execute function public.add_reading_group_owner();

drop policy if exists "members read group chat" on public.reading_group_messages;
create policy "members read group chat" on public.reading_group_messages for select to authenticated
  using (public.is_reading_group_member(group_id));
drop policy if exists "members send group chat" on public.reading_group_messages;
create policy "members send group chat" on public.reading_group_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_reading_group_member(group_id));

-- Private messages are allowed only if both users are active, recipient allows messages, and neither blocked the other.
drop policy if exists "participants read conversations" on public.private_conversations;
create policy "participants read conversations" on public.private_conversations for select to authenticated
  using (auth.uid() in (participant_one, participant_two));
drop policy if exists "start private conversations" on public.private_conversations;
create policy "start private conversations" on public.private_conversations for insert to authenticated
  with check (
    participant_one = least(auth.uid(), participant_two)
    and participant_two = greatest(auth.uid(), participant_two)
    and exists (
      select 1 from public.profiles p
      where p.id = participant_two and p.status = 'active'
    )
    and coalesce((
      select mp.allow_private_messages from public.messaging_preferences mp
      where mp.user_id = participant_two
    ), true)
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = participant_one and b.blocked_id = participant_two)
         or (b.blocker_id = participant_two and b.blocked_id = participant_one)
    )
  );

drop policy if exists "participants read private messages" on public.private_messages;
create policy "participants read private messages" on public.private_messages for select to authenticated
  using (public.is_private_conversation_participant(conversation_id));
drop policy if exists "participants send private messages" on public.private_messages;
create policy "participants send private messages" on public.private_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_private_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.private_conversations c
      join public.user_blocks b on
        (b.blocker_id = c.participant_one and b.blocked_id = c.participant_two)
        or (b.blocker_id = c.participant_two and b.blocked_id = c.participant_one)
      where c.id = conversation_id
    )
  );

grant select, insert, update, delete on public.messaging_preferences to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert, update, delete on public.reading_groups to authenticated;
grant select, insert, delete on public.reading_group_members to authenticated;
grant select, insert on public.reading_group_messages to authenticated;
grant select, insert on public.private_conversations to authenticated;
grant select, insert on public.private_messages to authenticated;

grant select on public.reading_groups to anon;
grant execute on function public.is_reading_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_reading_group_manager(uuid, uuid) to authenticated;
grant execute on function public.is_private_conversation_participant(uuid, uuid) to authenticated;
