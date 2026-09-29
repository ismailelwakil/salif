-- Salif (سلف) — per-listing rating summary (powers sort-by-rating and cards).
create or replace view public.listing_ratings as
select
  r.listing_id,
  count(*)::int                as review_count,
  round(avg(r.rating)::numeric, 2) as avg_rating
from public.reviews r
group by r.listing_id;

grant select on public.listing_ratings to anon, authenticated, service_role;
