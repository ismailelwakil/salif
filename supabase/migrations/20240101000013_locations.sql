-- Salif (سلف) — neighborhood gazetteer for map/radius discovery (Phase 5 prep).
-- Additive table; safe on the live database.
create table if not exists public.locations (
  id       uuid primary key default gen_random_uuid(),
  name     text not null unique,
  name_ar  text not null default '',
  city     text not null default 'Shibin El Kom',
  lat      double precision not null,
  lng      double precision not null
);

alter table public.locations enable row level security;
drop policy if exists locations_read on public.locations;
create policy locations_read on public.locations for select using (true);

grant select on public.locations to anon, authenticated, service_role;
