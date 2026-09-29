-- Separate terms and privacy versions on the private identity record.
alter table public.identity_records
  add column if not exists terms_version text not null default '2026-09-28';
alter table public.identity_records
  add column if not exists privacy_policy_version text not null default '2026-09-28';
