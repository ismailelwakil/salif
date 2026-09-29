-- Salif (سلف) — RPC: listings bookable for a date range.
-- Returns ACTIVE listings with no PENDING/ACCEPTED/ACTIVE booking that
-- overlaps [p_start, p_end], excluding the caller's own listings.
create or replace function public.available_listings(
  p_start     date,
  p_end       date,
  p_category  text    default null,
  p_location  text    default null,
  p_for_user  uuid    default auth.uid(),
  p_limit     integer default 50
) returns setof public.listings
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'SALIF:INVALID_DATES';
  end if;

  return query
    select l.*
      from public.listings l
     where l.status = 'ACTIVE'
       and (p_for_user is null or l.owner_id <> p_for_user)
       and (p_category is null or l.category = p_category)
       and (p_location is null or l.location = p_location)
       and not exists (
             select 1 from public.bookings b
              where b.listing_id = l.id
                and b.status in ('PENDING','ACCEPTED','ACTIVE')
                and not (b.end_date < p_start or b.start_date > p_end)
           )
     order by l.created_at desc
     limit greatest(1, least(p_limit, 200));
end;
$$;

revoke all on function public.available_listings(date, date, text, text, uuid, integer) from public;
grant execute on function public.available_listings(date, date, text, text, uuid, integer) to anon, authenticated, service_role;
