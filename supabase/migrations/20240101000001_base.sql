-- Salif (سلف) — base schema: profiles + listings + updated_at trigger.
-- Mirrors the live schema exactly (match-existing strategy).

create extension if not exists pgcrypto;

-- profiles.id intentionally has no FK to auth.users in the live schema:
-- profiles can exist for demo/seed identities; the app layer enforces identity.
create table if not exists public.profiles (
  id              uuid primary key,
  email           text,
  full_name       text not null,
  bio             text not null default '',
  neighborhood    text not null default '',
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.listings (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  type            text not null,
  title           text not null,
  description     text not null,
  category        text not null,
  price_per_day   numeric,
  currency        text not null default 'EGP',
  images          text[] not null default '{}',
  status          text not null default 'ACTIVE',
  visibility      text not null default 'PUBLIC',
  location        text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_listings_touch on public.listings;
create trigger trg_listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();
