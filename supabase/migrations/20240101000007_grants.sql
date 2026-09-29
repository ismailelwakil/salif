-- Salif (سلف) — role grants (mirror of live grants).
-- RLS still governs row visibility; grants govern table-level access.

do $$
declare r text; t text;
begin
  foreach r in array array['anon','authenticated','service_role'] loop
    foreach t in array array['profiles','listings','favorites','bookings','reviews'] loop
      execute format('grant all on table public.%I to %I', t, r);
    end loop;
  end loop;
end $$;
