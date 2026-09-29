-- Persist the four consent flags and the timestamps the registration API records.
alter table public.identity_records add column if not exists terms_accepted boolean not null default false;
alter table public.identity_records add column if not exists privacy_accepted boolean not null default false;
alter table public.identity_records add column if not exists data_processing_consent boolean not null default false;
alter table public.identity_records add column if not exists accurate_information_and_age_confirmed boolean not null default false;
alter table public.identity_records add column if not exists privacy_version text not null default '2026-09-28';
alter table public.identity_records add column if not exists terms_accepted_at timestamptz;
alter table public.identity_records add column if not exists data_processing_consent_at timestamptz;
alter table public.identity_records add column if not exists accurate_information_and_age_confirmed_at timestamptz;
