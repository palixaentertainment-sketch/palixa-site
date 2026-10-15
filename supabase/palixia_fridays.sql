-- Palixia Fridays: staged story hunts, private answers, and public announcements.
create table if not exists public.palixia_friday_hunts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  prize_type text not null default 'airtime' check (prize_type in ('airtime','cash')),
  prize_value integer not null default 500 check (prize_value between 0 and 1000000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','published','closed','cancelled')),
  winner_user_id uuid references public.profiles(id) on delete set null,
  winner_note text,
  prize_sent boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.palixia_friday_questions (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.palixia_friday_hunts(id) on delete cascade,
  sort_order integer not null check (sort_order > 0),
  prompt text not null,
  hint text not null default '',
  source_hint text not null default '',
  created_at timestamptz not null default now(),
  unique(hunt_id, sort_order)
);

-- Answers are deliberately stored separately: participants can read clues, never answer keys.
create table if not exists public.palixia_friday_answer_keys (
  question_id uuid primary key references public.palixia_friday_questions(id) on delete cascade,
  answer text not null
);

create table if not exists public.palixia_friday_entries (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.palixia_friday_hunts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  solved_question_ids uuid[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(hunt_id, user_id)
);

alter table public.palixia_friday_hunts enable row level security;
alter table public.palixia_friday_questions enable row level security;
alter table public.palixia_friday_answer_keys enable row level security;
alter table public.palixia_friday_entries enable row level security;

drop policy if exists "Public can view published Palixia Friday hunts" on public.palixia_friday_hunts;
create policy "Public can view published Palixia Friday hunts"
  on public.palixia_friday_hunts for select using (status = 'published' or public.is_admin());
drop policy if exists "Admins manage Palixia Friday hunts" on public.palixia_friday_hunts;
create policy "Admins manage Palixia Friday hunts"
  on public.palixia_friday_hunts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can view clues for published hunts" on public.palixia_friday_questions;
drop policy if exists "Admins manage Palixia Friday clues" on public.palixia_friday_questions;
-- Participants get clue text only through get_palixia_friday_current_clue(), which reveals one stage at a time.
create policy "Admins manage Palixia Friday clues"
  on public.palixia_friday_questions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins manage Palixia Friday clues" on public.palixia_friday_questions;
create policy "Admins manage Palixia Friday clues"
  on public.palixia_friday_questions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Only admins access Palixia Friday answer keys" on public.palixia_friday_answer_keys;
create policy "Only admins access Palixia Friday answer keys"
  on public.palixia_friday_answer_keys for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Participants and admins can view Palixia Friday entries" on public.palixia_friday_entries;
create policy "Participants and admins can view Palixia Friday entries"
  on public.palixia_friday_entries for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Admins manage Palixia Friday entries" on public.palixia_friday_entries;
create policy "Admins manage Palixia Friday entries"
  on public.palixia_friday_entries for all using (public.is_admin()) with check (public.is_admin());



create or replace function public.get_palixia_friday_current_clue(p_hunt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hunt public.palixia_friday_hunts%rowtype;
  v_entry public.palixia_friday_entries%rowtype;
  v_question public.palixia_friday_questions%rowtype;
  v_total integer;
  v_solved integer := 0;
begin
  select * into v_hunt from public.palixia_friday_hunts
   where id = p_hunt_id and status = 'published';
  if not found then raise exception 'hunt_not_available'; end if;

  select count(*) into v_total from public.palixia_friday_questions where hunt_id = p_hunt_id;
  if v_user is not null then
    select * into v_entry from public.palixia_friday_entries
     where hunt_id = p_hunt_id and user_id = v_user;
    if found then v_solved := cardinality(v_entry.solved_question_ids); end if;
  end if;

  if now() < v_hunt.starts_at then
    return jsonb_build_object('total', v_total, 'solved', v_solved, 'current', null, 'completed', false, 'not_started', true);
  end if;

  if v_user is not null then
    select q.* into v_question from public.palixia_friday_questions q
     where q.hunt_id = p_hunt_id and not (q.id = any(coalesce(v_entry.solved_question_ids, '{}'::uuid[])))
     order by q.sort_order limit 1;
  else
    select q.* into v_question from public.palixia_friday_questions q
     where q.hunt_id = p_hunt_id order by q.sort_order limit 1;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'solved', v_solved,
    'completed', v_total > 0 and v_solved >= v_total,
    'not_started', false,
    'current', case when v_question.id is null then null else jsonb_build_object(
      'id', v_question.id, 'sort_order', v_question.sort_order,
      'prompt', v_question.prompt, 'hint', v_question.hint, 'source_hint', v_question.source_hint
    ) end
  );
end;
$$;

revoke all on function public.get_palixia_friday_current_clue(uuid) from public;
grant execute on function public.get_palixia_friday_current_clue(uuid) to anon, authenticated;

create or replace function public.submit_palixia_friday_answer(p_hunt_id uuid, p_question_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hunt public.palixia_friday_hunts%rowtype;
  v_question public.palixia_friday_questions%rowtype;
  v_entry public.palixia_friday_entries%rowtype;
  v_answer text;
  v_expected uuid;
  v_total integer;
  v_completed boolean := false;
begin
  if v_user is null then raise exception 'login_required'; end if;
  if length(trim(coalesce(p_answer, ''))) < 1 or length(p_answer) > 500 then raise exception 'invalid_answer'; end if;

  select * into v_hunt from public.palixia_friday_hunts
   where id = p_hunt_id and status = 'published';
  if not found then raise exception 'hunt_not_available'; end if;
  if now() < v_hunt.starts_at or now() > v_hunt.ends_at then raise exception 'hunt_not_open'; end if;

  select * into v_question from public.palixia_friday_questions
   where id = p_question_id and hunt_id = p_hunt_id;
  if not found then raise exception 'question_not_found'; end if;

  insert into public.palixia_friday_entries(hunt_id, user_id)
    values (p_hunt_id, v_user)
    on conflict (hunt_id, user_id) do nothing;
  select * into v_entry from public.palixia_friday_entries
   where hunt_id = p_hunt_id and user_id = v_user for update;

  select q.id into v_expected
    from public.palixia_friday_questions q
   where q.hunt_id = p_hunt_id and not (q.id = any(v_entry.solved_question_ids))
   order by q.sort_order limit 1;
  if v_expected is null then
    return jsonb_build_object('correct', false, 'completed', true, 'message', 'You have already solved this hunt.');
  end if;
  if v_question.id <> v_expected then
    return jsonb_build_object('correct', false, 'completed', false, 'message', 'Solve the current clue before opening the next stage.');
  end if;

  select answer into v_answer from public.palixia_friday_answer_keys where question_id = p_question_id;
  if v_answer is null then raise exception 'answer_key_missing'; end if;
  if regexp_replace(lower(trim(v_answer)), '[^[:alnum:]]', '', 'g')
     <> regexp_replace(lower(trim(p_answer)), '[^[:alnum:]]', '', 'g') then
    return jsonb_build_object('correct', false, 'completed', false, 'message', 'Not quite. Re-read the clue and try again.');
  end if;

  update public.palixia_friday_entries
     set solved_question_ids = array_append(solved_question_ids, p_question_id),
         updated_at = now()
   where id = v_entry.id
   returning * into v_entry;

  select count(*) into v_total from public.palixia_friday_questions where hunt_id = p_hunt_id;
  v_completed := cardinality(v_entry.solved_question_ids) >= v_total;
  if v_completed then
    update public.palixia_friday_entries set completed_at = now(), updated_at = now() where id = v_entry.id;
  end if;

  select q.id into v_expected from public.palixia_friday_questions q
   where q.hunt_id = p_hunt_id and not (q.id = any(v_entry.solved_question_ids))
   order by q.sort_order limit 1;
  return jsonb_build_object(
    'correct', true,
    'completed', v_completed,
    'next_question_id', v_expected,
    'message', case when v_completed then 'You solved the hunt! Your entry is complete.' else 'Correct! The next clue is unlocked.' end
  );
end;
$$;

revoke all on function public.submit_palixia_friday_answer(uuid, uuid, text) from public;
grant execute on function public.submit_palixia_friday_answer(uuid, uuid, text) to authenticated;

create index if not exists palixia_friday_hunts_status_dates_idx on public.palixia_friday_hunts(status, starts_at, ends_at);
create index if not exists palixia_friday_questions_hunt_order_idx on public.palixia_friday_questions(hunt_id, sort_order);
create index if not exists palixia_friday_entries_hunt_completed_idx on public.palixia_friday_entries(hunt_id, completed_at);
