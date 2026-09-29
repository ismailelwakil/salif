# سلف

سوق محلي صغير في شبين الكوم: استعير أدوات، احجز مهارات، وشارك اللي عندك مع جيرانك. الاسم بالعربي **سلف**، وباللاتيني **Salif**.

A bilingual (Arabic-first) hyperlocal marketplace. The running app is the zero-dependency Node server in this folder — not a Next.js rewrite — because the live site, the real Supabase data, and the tested UI stay in place. The folders below match the blueprint’s responsibilities.

## Run

```bash
cp backend/.env.example backend/.env   # fill locally; never commit
npm start
# http://localhost:3000
```

The browser only loads `frontend/`. The service key lives in `backend/.env` and never leaves that process.

Arabic is the default shell. The globe button switches to English and flips `dir` between RTL and LTR.

## Layout

| Blueprint piece | Where it lives here |
| --- | --- |
| Home, search, listing, host dashboard, trips | `frontend/index.html` + `frontend/js/app.js` (hash routes) |
| i18n `en.json` / `ar.json` | `frontend/i18n/` (generated from `frontend/js/i18n.js`) |
| Listing grid cache (IndexedDB + TTL) | `frontend/js/cache/listingGridCache.js` |
| Supabase RPC wrappers | `backend/src/lib/rpc.js` → `create_booking`, `toggle_favorite`, `search_listings`, `available_listings` |
| Migrations `000001`–`000014` | `supabase/migrations/` |
| Manual seeds | `supabase/seed.sql`, `supabase/seed-locations.sql` |
| Sentry | `backend/src/lib/sentry.js` + `frontend/js/sentry.js` (`POST /api/telemetry`) |
| CI | `.github/workflows/staging-deploy.yml`, `preview-qa.yml`, `production-deploy.yml` |
| QA probes | `scripts/qa-probes.sh` |

Auth, bookings, and writes go through `backend/`. The service-role key never reaches the browser.

## Database

Migrations are idempotent and match the live schema. Booking overlap, own-listing rejection, and wishlist toggles are enforced inside Postgres (`security definer` RPCs), not only in the API.

```bash
psql "$DIRECT_URL" -f supabase/seed.sql
psql "$DIRECT_URL" -f supabase/seed-locations.sql
```

Seeds are manual. They are not migrations.

## Demo

Log in with any `@salif.app` neighbor from the sign-in screen (demo, ahmed, mona, sara).
