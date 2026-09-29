-- Salif (سلف) — secondary indexes (mirror of live indexes).
create index if not exists listings_owner_idx    on public.listings (owner_id);
create index if not exists listings_status_idx    on public.listings (status);
create index if not exists listings_category_idx  on public.listings (category);
create index if not exists bookings_listing_idx   on public.bookings (listing_id);
create index if not exists bookings_requester_idx on public.bookings (requester_id);
create index if not exists reviews_listing_idx    on public.reviews (listing_id);
