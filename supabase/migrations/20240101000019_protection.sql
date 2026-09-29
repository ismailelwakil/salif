-- Additive protection, valuation, and claim records.
-- Does not alter listings, bookings, reviews, favorites, or identity_records.
-- Public listing rows stay free of replacement values, coverage, and evidence.
-- Browser roles cannot read these tables.

create table if not exists public.item_assessments (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  policy_version text not null,
  processing_status text not null,
  identification_confidence text not null default 'UNAVAILABLE',
  valuation_status text not null default 'VALUATION_UNAVAILABLE',
  declared_decision text not null default 'NOT_PROVIDED',
  risk_level text not null default 'UNKNOWN',
  protection_requirement text not null default 'NOT_ELIGIBLE',
  protection_bound boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_protection_snapshots (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  listing_id uuid not null references public.listings (id),
  policy_version text not null,
  rental_price_per_day numeric,
  protection_bound boolean not null default false,
  protection_fee numeric,
  coverage_limit numeric,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.protection_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  listing_id uuid not null references public.listings (id),
  requester_id uuid not null references public.profiles (id),
  owner_id uuid not null references public.profiles (id),
  status text not null default 'OPEN',
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.protection_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  subject text not null,
  created_at timestamptz not null default now()
);

alter table public.item_assessments enable row level security;
alter table public.booking_protection_snapshots enable row level security;
alter table public.protection_claims enable row level security;
alter table public.protection_events enable row level security;

revoke all on table public.item_assessments from anon, authenticated;
revoke all on table public.booking_protection_snapshots from anon, authenticated;
revoke all on table public.protection_claims from anon, authenticated;
revoke all on table public.protection_events from anon, authenticated;
grant select, insert, update, delete on table public.item_assessments to service_role;
grant select, insert, update, delete on table public.booking_protection_snapshots to service_role;
grant select, insert, update, delete on table public.protection_claims to service_role;
grant select, insert, update, delete on table public.protection_events to service_role;
