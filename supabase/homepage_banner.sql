-- Admin-managed homepage banner. An inactive or empty banner renders no homepage section.
create table if not exists public.homepage_banner (
  id boolean primary key default true check (id = true),
  image_url text,
  alt_text text not null default 'Palixia announcement' check (char_length(alt_text) <= 180),
  link_url text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint homepage_banner_image_url_length check (image_url is null or char_length(image_url) <= 2000),
  constraint homepage_banner_link_url_length check (link_url is null or char_length(link_url) <= 1000)
);

alter table public.homepage_banner enable row level security;

drop policy if exists "public can read active homepage banner" on public.homepage_banner;
create policy "public can read active homepage banner"
  on public.homepage_banner for select to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "admins manage homepage banner" on public.homepage_banner;
create policy "admins manage homepage banner"
  on public.homepage_banner for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.homepage_banner to anon, authenticated;
grant insert, update, delete on public.homepage_banner to authenticated;

insert into public.homepage_banner (id, image_url, alt_text, link_url, is_active)
values (true, null, 'Palixia announcement', null, false)
on conflict (id) do nothing;
