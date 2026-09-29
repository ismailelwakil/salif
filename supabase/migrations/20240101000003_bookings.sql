-- Salif (سلف) — bookings with status lifecycle.
-- Status values used by the app: PENDING, ACCEPTED, ACTIVE, COMPLETED,
-- DECLINED, CANCELLED, DISPUTED.
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings (id) on delete cascade,
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  start_date    date not null,
  end_date      date not null,
  status        text not null default 'PENDING',
  message       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_bookings_touch on public.bookings;
create trigger trg_bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
