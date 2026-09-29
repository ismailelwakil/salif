-- Additive verification records. Does not alter listings, bookings, reviews, or favorites.
-- Sensitive values stay encrypted by the API. This table is not readable by browser roles.
-- national_id remains on identity_records. Do not add a second national-id column.

create table if not exists public.verification_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  gate boolean not null default false,
  status text not null default 'NOT_STARTED',
  email_status text not null default 'NOT_STARTED',
  phone_status text not null default 'NOT_STARTED',
  phone_enc text,
  phone_hash text,
  government_id_status text not null default 'NOT_STARTED',
  id_front_ref text,
  id_back_ref text,
  name_match text not null default 'NOT_STARTED',
  dob_match text not null default 'NOT_AVAILABLE',
  dob_enc text,
  national_id_match text not null default 'NOT_STARTED',
  selfie_status text not null default 'NOT_STARTED',
  selfie_ref text,
  face_match text not null default 'NOT_AVAILABLE',
  liveness text not null default 'NOT_AVAILABLE',
  address_enc text,
  lat_enc text,
  lng_enc text,
  location_status text not null default 'NOT_STARTED',
  neighborhood text,
  location_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  reason text,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.verification_otps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null,
  code_hash text not null,
  destination_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  primary key (user_id, channel)
);

create table if not exists public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'OPEN',
  reason text not null,
  reviewer text,
  action text,
  previous_state text,
  new_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.verification_profiles enable row level security;
alter table public.verification_events enable row level security;
alter table public.verification_otps enable row level security;
alter table public.verification_reviews enable row level security;

revoke all on table public.verification_profiles from anon, authenticated;
revoke all on table public.verification_events from anon, authenticated;
revoke all on table public.verification_otps from anon, authenticated;
revoke all on table public.verification_reviews from anon, authenticated;
grant select, insert, update, delete on table public.verification_profiles to service_role;
grant select, insert, update, delete on table public.verification_events to service_role;
grant select, insert, update, delete on table public.verification_otps to service_role;
grant select, insert, update, delete on table public.verification_reviews to service_role;
