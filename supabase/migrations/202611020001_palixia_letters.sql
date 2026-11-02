-- Palixia Letters: opt-in newsletter subscribers.
-- Additive only. This does not touch reading, publishing, or Palixia Fridays data.

create table if not exists public.newsletter_subscribers (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  subscriber_type text not null default 'general' check (subscriber_type in ('general', 'reader', 'author')),
  source text not null default 'footer' check (source in ('footer', 'signup')),
  consent_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

-- No direct table policies: subscriber addresses and tokens are never exposed by table queries.
-- Public signup and unsubscribe happen only through these narrowly-scoped functions.
create or replace function public.subscribe_palixia_letters(
  p_email text,
  p_subscriber_type text default 'general',
  p_source text default 'footer'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_token uuid;
begin
  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  if coalesce(p_subscriber_type, 'general') not in ('general', 'reader', 'author') then
    raise exception 'invalid_subscriber_type' using errcode = '22023';
  end if;
  if coalesce(p_source, 'footer') not in ('footer', 'signup') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;

  insert into public.newsletter_subscribers
    (email, subscriber_type, source, consent_at, unsubscribed_at)
  values
    (v_email, coalesce(p_subscriber_type, 'general'), coalesce(p_source, 'footer'), now(), null)
  on conflict (email) do update set
    subscriber_type = excluded.subscriber_type,
    source = excluded.source,
    consent_at = now(),
    unsubscribe_token = case
      when public.newsletter_subscribers.unsubscribed_at is not null then gen_random_uuid()
      else public.newsletter_subscribers.unsubscribe_token
    end,
    unsubscribed_at = null,
    updated_at = now()
  returning unsubscribe_token into v_token;

  return v_token;
end;
$$;

create or replace function public.unsubscribe_palixia_letters(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_token is null then return false; end if;
  update public.newsletter_subscribers
    set unsubscribed_at = now(), updated_at = now()
    where unsubscribe_token = p_token and unsubscribed_at is null;
  return found;
end;
$$;

revoke all on function public.subscribe_palixia_letters(text, text, text) from public;
revoke all on function public.unsubscribe_palixia_letters(uuid) from public;
grant execute on function public.subscribe_palixia_letters(text, text, text) to anon, authenticated;
grant execute on function public.unsubscribe_palixia_letters(uuid) to anon, authenticated;
