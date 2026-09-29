-- سلف — private identity record. Browser roles cannot read it.
-- The national ID is ciphertext plus a keyed hash used only to reject duplicates.

create table if not exists public.identity_records (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  national_id_enc text not null,
  national_id_hash text not null unique,
  document_ref text not null,
  location_id uuid references public.locations (id),
  neighborhood text not null,
  policy_version text not null,
  tos_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  processing_consent_at timestamptz not null,
  accuracy_age_accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.identity_records enable row level security;

revoke all on table public.identity_records from anon, authenticated;
grant select, insert, update, delete on table public.identity_records to service_role;
