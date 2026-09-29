-- Salif (سلف) — favorites (wishlist). Composite PK mirrors the live schema.
create table if not exists public.favorites (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  listing_id   uuid not null references public.listings (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, listing_id)
);
