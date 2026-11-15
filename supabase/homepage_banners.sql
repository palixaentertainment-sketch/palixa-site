-- Multi-banner promotional carousel for the homepage.
-- Safe migration: preserves the existing single homepage banner by copying it into the new table.
create table if not exists public.homepage_banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null check (char_length(image_url) <= 2000),
  alt_text text not null default 'Palixia promotion' check (char_length(alt_text) <= 180),
  link_url text check (link_url is null or char_length(link_url) <= 1000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homepage_banner_settings (
  id boolean primary key default true check (id = true),
  display_seconds integer not null default 5 check (display_seconds between 3 and 10),
  updated_at timestamptz not null default now()
);

alter table public.homepage_banners enable row level security;
alter table public.homepage_banner_settings enable row level security;

drop policy if exists "public can read active promotional banners" on public.homepage_banners;
create policy "public can read active promotional banners"
  on public.homepage_banners for select to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "admins manage promotional banners" on public.homepage_banners;
create policy "admins manage promotional banners"
  on public.homepage_banners for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "public can read promotional banner settings" on public.homepage_banner_settings;
create policy "public can read promotional banner settings"
  on public.homepage_banner_settings for select to anon, authenticated
  using (true);

drop policy if exists "admins manage promotional banner settings" on public.homepage_banner_settings;
create policy "admins manage promotional banner settings"
  on public.homepage_banner_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.homepage_banners, public.homepage_banner_settings to anon, authenticated;
grant insert, update, delete on public.homepage_banners, public.homepage_banner_settings to authenticated;

insert into public.homepage_banner_settings (id, display_seconds)
values (true, 5)
on conflict (id) do nothing;

insert into public.homepage_banners (image_url, alt_text, link_url, is_active, sort_order)
select image_url, alt_text, link_url, is_active, 0
from public.homepage_banner
where id = true and image_url is not null
  and not exists (select 1 from public.homepage_banners);

