-- Salif (سلف) — reviews. App layer restricts reviews to completed exchanges.
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  comment     text not null default '',
  created_at  timestamptz not null default now()
);
