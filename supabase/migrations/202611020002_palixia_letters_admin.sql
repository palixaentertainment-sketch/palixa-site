-- Admin-only read access for Palixia Letters subscriber management.
-- Subscriber addresses remain unavailable to anon and ordinary authenticated users.

create or replace function public.admin_list_palixia_letter_subscribers()
returns table (
  email text,
  subscriber_type text,
  source text,
  consent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.status, 'active') = 'active'
  ) then
    raise exception 'admin_required' using errcode = '42501';
  end if;

  return query
    select s.email, s.subscriber_type, s.source,
           s.consent_at, s.unsubscribed_at, s.created_at
    from public.newsletter_subscribers s
    order by s.created_at desc;
end;
$$;

revoke all on function public.admin_list_palixia_letter_subscribers() from public;
grant execute on function public.admin_list_palixia_letter_subscribers() to authenticated;
