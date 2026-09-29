-- Salif (سلف) — RPC: wishlist toggle (idempotent add / remove).
create or replace function public.toggle_favorite(
  p_listing uuid,
  p_remove  boolean default false,
  p_user    uuid default auth.uid()
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    raise exception 'SALIF:UNAUTHORIZED' using errcode = '28000';
  end if;

  if p_remove then
    delete from public.favorites where user_id = p_user and listing_id = p_listing;
    return false;
  else
    insert into public.favorites (user_id, listing_id)
    values (p_user, p_listing)
    on conflict (user_id, listing_id) do nothing;
    return true;
  end if;
end;
$$;

revoke all on function public.toggle_favorite(uuid, boolean, uuid) from public, anon;
grant execute on function public.toggle_favorite(uuid, boolean, uuid) to authenticated, service_role;
