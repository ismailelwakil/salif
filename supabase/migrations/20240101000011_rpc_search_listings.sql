-- Salif (سلف) — RPC: bilingual search over active listings.
-- p_sort: newest | price_low | price_high | rating
create or replace function public.search_listings(
  p_q        text    default null,
  p_type     text    default null,
  p_category text    default null,
  p_location text    default null,
  p_sort     text    default 'newest',
  p_limit    integer default 50
) returns setof public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if p_sort = 'price_low' then
    return query
      select l.* from public.listings l
       where l.status = 'ACTIVE'
         and (p_type is null or l.type = p_type)
         and (p_category is null or l.category = p_category)
         and (p_location is null or l.location = p_location)
         and (v_q is null or (
               l.title ilike '%' || v_q || '%' or l.title_ar ilike '%' || v_q || '%'
            or l.description ilike '%' || v_q || '%' or l.description_ar ilike '%' || v_q || '%'
            or l.category ilike '%' || v_q || '%'))
       order by l.price_per_day asc nulls last, l.created_at desc
       limit greatest(1, least(p_limit, 200));
  elsif p_sort = 'price_high' then
    return query
      select l.* from public.listings l
       where l.status = 'ACTIVE'
         and (p_type is null or l.type = p_type)
         and (p_category is null or l.category = p_category)
         and (p_location is null or l.location = p_location)
         and (v_q is null or (
               l.title ilike '%' || v_q || '%' or l.title_ar ilike '%' || v_q || '%'
            or l.description ilike '%' || v_q || '%' or l.description_ar ilike '%' || v_q || '%'
            or l.category ilike '%' || v_q || '%'))
       order by l.price_per_day desc nulls last, l.created_at desc
       limit greatest(1, least(p_limit, 200));
  elsif p_sort = 'rating' then
    return query
      select l.* from public.listings l
       left join public.listing_ratings r on r.listing_id = l.id
       where l.status = 'ACTIVE'
         and (p_type is null or l.type = p_type)
         and (p_category is null or l.category = p_category)
         and (p_location is null or l.location = p_location)
         and (v_q is null or (
               l.title ilike '%' || v_q || '%' or l.title_ar ilike '%' || v_q || '%'
            or l.description ilike '%' || v_q || '%' or l.description_ar ilike '%' || v_q || '%'
            or l.category ilike '%' || v_q || '%'))
       order by r.avg_rating desc nulls last, r.review_count desc nulls last, l.created_at desc
       limit greatest(1, least(p_limit, 200));
  else
    return query
      select l.* from public.listings l
       where l.status = 'ACTIVE'
         and (p_type is null or l.type = p_type)
         and (p_category is null or l.category = p_category)
         and (p_location is null or l.location = p_location)
         and (v_q is null or (
               l.title ilike '%' || v_q || '%' or l.title_ar ilike '%' || v_q || '%'
            or l.description ilike '%' || v_q || '%' or l.description_ar ilike '%' || v_q || '%'
            or l.category ilike '%' || v_q || '%'))
       order by l.created_at desc
       limit greatest(1, least(p_limit, 200));
  end if;
end;
$$;

revoke all on function public.search_listings(text, text, text, text, text, integer) from public, anon;
grant execute on function public.search_listings(text, text, text, text, text, integer) to anon, authenticated, service_role;
