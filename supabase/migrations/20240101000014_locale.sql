-- Salif (سلف) — locale columns: Arabic-first bilingual content.
-- Idempotent: mirrors columns already present in the live schema.
alter table public.listings add column if not exists title_ar       text not null default '';
alter table public.listings add column if not exists description_ar text not null default '';
alter table public.profiles add column if not exists full_name_latin text;

-- Backfill rule used by the API when a locale field is omitted:
--   title_ar       := coalesce(nullif(title_ar, ''), title)
--   description_ar := coalesce(nullif(description_ar, ''), description)
--   full_name_latin is optional; UI falls back to full_name.
