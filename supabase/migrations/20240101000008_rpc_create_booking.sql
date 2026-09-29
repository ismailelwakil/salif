-- Salif (سلف) — RPC: atomic booking creation.
-- Enforces, inside ONE transaction:
--   1. authenticated requester
--   2. listing exists and is ACTIVE (row-locked to serialize racing requests)
--   3. requester is not the owner
--   4. date range is valid
--   5. no overlap with PENDING/ACCEPTED/ACTIVE bookings
-- Error contract: raised messages are prefixed SALIF:<CODE> so the API can
-- map them to VALIDATION_ERROR / FORBIDDEN / NOT_FOUND / CONFLICT.

create or replace function public.create_booking(
  p_listing   uuid,
  p_start     date,
  p_end       date,
  p_message   text default '',
  p_requester uuid default auth.uid()
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_status text;
  v_clash  uuid;
  v_row    public.bookings;
begin
  if p_requester is null then
    raise exception 'SALIF:UNAUTHORIZED' using errcode = '28000';
  end if;

  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'SALIF:INVALID_DATES';
  end if;

  -- Lock the listing row so concurrent requests serialize on it.
  select l.owner_id, l.status
    into v_owner, v_status
    from public.listings l
   where l.id = p_listing
   for update;

  if v_owner is null then
    raise exception 'SALIF:NOT_FOUND';
  end if;
  if v_status <> 'ACTIVE' then
    raise exception 'SALIF:NOT_ACTIVE';
  end if;
  if v_owner = p_requester then
    raise exception 'SALIF:OWN_LISTING';
  end if;

  select b.id into v_clash
    from public.bookings b
   where b.listing_id = p_listing
     and b.status in ('PENDING','ACCEPTED','ACTIVE')
     and not (b.end_date < p_start or b.start_date > p_end)
   limit 1;

  if v_clash is not null then
    raise exception 'SALIF:DATE_CONFLICT';
  end if;

  insert into public.bookings (listing_id, requester_id, start_date, end_date, status, message)
  values (p_listing, p_requester, p_start, p_end, 'PENDING', coalesce(p_message, ''))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_booking(uuid, date, date, text, uuid) from public, anon;
grant execute on function public.create_booking(uuid, date, date, text, uuid) to authenticated, service_role;
