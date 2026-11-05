-- Allow Palixia Fridays to use a no-cost recognition reward.
-- Existing airtime and cash hunts remain supported.
alter table public.palixia_friday_hunts
  drop constraint if exists palixia_friday_hunts_prize_type_check;

alter table public.palixia_friday_hunts
  add constraint palixia_friday_hunts_prize_type_check
  check (prize_type in ('airtime', 'cash', 'recognition'));
