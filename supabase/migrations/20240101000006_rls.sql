-- Salif (سلف) — Row Level Security (exact mirror of live policies).
-- Defense in depth: the Salif API server enforces the same rules with the
-- service key; RLS protects direct PostgREST access.

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.favorites enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;

-- profiles: public read, self write
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_write_own on public.profiles;
create policy profiles_write_own on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- listings: ACTIVE visible to everyone; owners see + manage their own
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using (status = 'ACTIVE' or owner_id = auth.uid());
drop policy if exists listings_write_own on public.listings;
create policy listings_write_own on public.listings for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- favorites: only your own rows
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- bookings: visible to the requester or the owner of the listed item
drop policy if exists bookings_participant on public.bookings;
create policy bookings_participant on public.bookings for select
  using (
    requester_id = auth.uid()
    or exists (select 1 from listings l where l.id = bookings.listing_id and l.owner_id = auth.uid())
  );
drop policy if exists bookings_request on public.bookings;
create policy bookings_request on public.bookings for insert
  with check (requester_id = auth.uid());
drop policy if exists bookings_update_participant on public.bookings;
create policy bookings_update_participant on public.bookings for update
  using (
    requester_id = auth.uid()
    or exists (select 1 from listings l where l.id = bookings.listing_id and l.owner_id = auth.uid())
  );

-- reviews: public read, author-only write
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);
drop policy if exists reviews_write on public.reviews;
create policy reviews_write on public.reviews for insert
  with check (author_id = auth.uid());
