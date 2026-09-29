# سلف · Salif

A bilingual neighborhood marketplace for Shibin El Kom. Neighbors lend items, offer skills, and request bookings without leaving the city. Arabic is the default language and the default reading direction. English is one toggle away.

This repository is the running product: a static single-page app and an Express API on Node.js. It is not a Next.js rewrite. The live schema, seed data, and tested screens stay in these folders.

| | |
| --- | --- |
| Product | سلف / Salif |
| Place | Shibin El Kom, Monufia, Egypt |
| Stack | Hash-routed SPA · Express 4 · Supabase Auth and Postgres |
| Node | 20 or newer |
| Default URL | `http://localhost:3000` |

Deeper notes live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/PROTECTION.md](docs/PROTECTION.md), and [backend/README.md](backend/README.md).

## What it does

Salif lets a neighbor browse what is available nearby, publish an item or a skill, request dates, accept or decline that request, leave a review after a completed exchange, and save favorites. The public surface shows a neighborhood, never a street address or coordinates.

The product also records identity material for new accounts and can run an extra confirmation flow. It can screen a listing against a prohibited-item policy and store an unbound protection assessment. Those later pieces assist the existing marketplace. They do not replace listings, bookings, prices, or accounts.

## What it does not do

These are intentional gaps, not unfinished buttons:

- No payments, deposits, wallets, or card charging.
- No chat, delivery, courier, or handover tracking.
- No analytics product, advertising pixels, or OAuth login.
- No second listing system, booking system, image host, or auth system.
- No Google Maps, and no map API key in the browser. The map is Salif’s own six-neighborhood gazetteer.
- No live OCR, face match, liveness, SMS gateway, market-price fetch, or insurance underwriter.
- No automatic coverage, protection fee, or bound policy. The rental price is never rewritten into a protection fee.
- AI does not approve a listing, set risk, or decide a claim. With no provider configured, it returns no identification and no price.

## Features

### Browse and search

- Home with a hero, category shortcuts, item and skill carousels, and a share call to action.
- Explore grid with text search, type (`ITEM` or `SKILL`), category, neighborhood, and sort.
- Date availability through `available_listings`, so occupied ranges can be excluded.
- Listing page with gallery, bilingual title and description, price in EGP, host, reviews, and a booking panel.
- Categories: tools, kitchen, electronics, sports, crafts, lessons, repairs, garden, cleaning.
- Listing photos are local files under `frontend/img/`. A listing stores paths such as `/img/tools-drill.jpg`, not remote URLs.
- The grid can be cached in IndexedDB with a TTL (`frontend/js/cache/listingGridCache.js`).

### Language

- Arabic-first. `lang="ar"` and `dir="rtl"` are the document defaults.
- The globe button switches to English and flips the page to LTR.
- Dictionaries live in `frontend/js/i18n.js`. `frontend/i18n/en.json` and `ar.json` are generated copies.
- Listing and profile fields keep both Arabic and Latin text where the schema has both.

### Accounts

- Email and password sign-in through Supabase Auth. Passwords are hashed by Supabase, not by this app.
- Password reset and a generic “if the account exists” response, so the API does not reveal whether an email is registered.
- Session refresh and logout. Logout drops the token on this server and asks Supabase to revoke it.
- Demo one-click sign-in for `@salif.app` accounts, only when `ALLOW_DEMO=true`.
- Demo neighbors: `demo@salif.app`, `ahmed@salif.app`, `mona@salif.app`, `sara@salif.app`.
- Profile edit for name, Latin name, bio, neighborhood, and avatar path.
- Account deletion removes the auth user and the stored ID document. Demo neighborhood accounts cannot be deleted.
- Public profile reads do not return email, national ID, or document paths.

### Registration

A new account requires all of the following. There is no neighborhood dropdown.

- Full legal name and a strong password (at least 10 characters, with a letter and a number).
- A 14-digit national ID. It is encrypted with AES-256-GCM. A keyed hash is the only duplicate check. The number is not stored twice.
- A JPEG, PNG, or WebP ID image under 2 MB, checked by type and file signature, then stored encrypted outside the public tree.
- A neighborhood chosen on the built-in Shibin El Kom map: open, select, confirm, display, then submit. Device location is used only if the person presses the button, then snapped to the nearest known neighborhood and discarded.
- Four separate mandatory checkboxes: terms, privacy, data processing, and accurate information plus age. Each is stored with the policy version and a timestamp.
- `#/terms` and `#/privacy` are real pages, linked from registration.

### Neighborhoods

| English | Arabic |
| --- | --- |
| City Center | وسط البلد |
| El-Bahri | البحري |
| El-Gaish St. | شارع الجيش |
| El-Khadra | الخضراء |
| East Branch | الفرع الشرقي |
| Shanawan | شنوان |

Coordinates live in `locations` and are used to draw the picker. Exact address and coordinates are not published on a listing.

### Listings

- Types: `ITEM` and `SKILL`.
- Statuses: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`.
- Visibility: `PUBLIC` or `NEIGHBORHOOD_ONLY`.
- Daily price in EGP, optional. A skill can be listed without a price.
- Create, edit, and delete are limited to the signed-in owner.
- A title that matches the prohibited policy is refused with a generic `ITEM_NOT_ALLOWED` before insert. The response does not say which word matched.
- An empty title still fails validation. A normal tool listing still publishes.
- The owner cannot set `risk_level`. That field is ignored.
- The default publish gate is prohibited-only. `SALIF_PUBLISH_GATE=risk` is not the operating default, because unidentified items would be held.

### Bookings

- A signed-in neighbor requests a date range on someone else’s active listing.
- Postgres (`create_booking`) rejects an invalid range, an own listing, and an overlap with `PENDING`, `ACCEPTED`, or `ACTIVE`.
- The owner can accept, decline, start, complete, cancel, or mark a dispute, according to the current status.
- The requester can cancel, and can complete or dispute an active exchange.
- The dashboard Bookings tab shows requests the user made and requests on the user’s listings.
- A booking can store a protection snapshot. That snapshot is unbound: no fee, no coverage limit, and `protection_bound` stays false. A snapshot failure does not undo a booking that already succeeded.

### Reviews and favorites

- A review is 1–5 stars plus an optional comment, after a completed booking, or by the listing owner.
- Ratings are aggregated in `listing_ratings`.
- Favorites are a per-user wishlist. Toggle is an atomic Postgres function, `toggle_favorite`.

### Dashboard and member pages

- `#/dashboard` tabs: bookings, my listings, favorites.
- `#/new` and `#/edit/:id` are the host form.
- `#/member/:id` is a public neighbor profile: neighborhood, listings, and review average. No email and no national ID.
- `#/how-it-works` and `#/safety` explain the neighborhood rules. Safety copy states that handover details stay between the booking parties.

### Account confirmation

`#/verify` is an extra flow for accounts that opted into `verification_flow`. It does not replace registration.

Steps, in order: email code, Egyptian mobile code, ID details and card back, private selfie, neighborhood plus private address, then a review request.

Current boundaries:

- No verification row, or `VERIFICATION_GATE` left unset, does not block existing users from listing or booking.
- Only new `verification_flow` users are gated when the gate is on.
- A public identity badge requires a reviewer decision of `VERIFIED`.
- Prototype email and phone codes run only when `VERIFICATION_PROTOTYPE=true`, and that mode is refused when `NODE_ENV=production`. There is no universal production OTP.
- Uploading a photo is not verification. Face match and liveness are not connected. The screen says so.
- Reviewer approval needs `VERIFICATION_REVIEWER_KEY`. That key is not a product role, and the route is hidden without it.
- Identity documents are not downloadable by neighbors. Those routes return forbidden.

### Protection, risk, and valuation

Rules live in `backend/src/engines/`. The browser only displays a result. It does not decide eligibility.

- Prohibited items (firearms, explosives, illegal substances, in English and Arabic) are refused. Ordinary kitchen and tool words are not treated as weapons.
- If identification is not high or medium confidence, risk is `UNKNOWN`. Unknown is not low.
- Valuation accepts only complete evidence objects. With no market adapter and an empty allowlist, the result is `VALUATION_UNAVAILABLE`. No price or URL is invented. Used prices are not treated as replacement value.
- Owner-declared replacement value is not auto-approved without replacement evidence.
- Protection requirement and coverage are separate from `price_per_day`. With no underwriter, the public result is not eligible, fee null, coverage null, provider null.
- A claim can be opened by a booking party for an active, disputed, or completed exchange. Opening it does not decide it. Review needs `PROTECTION_REVIEWER_KEY`.
- Assessment or snapshot failures must not roll back a listing or booking that already succeeded.
- Listing photos and ID images are not sent to an external model.

`docs/PROTECTION.md` is the rule reference. Policy version for those engines is `2026-09-29`.

## Architecture

```text
Browser
  frontend/          hash-routed SPA, no secrets
        |
        |  same-origin /api  and static files
        v
Express process      backend/src
  middleware         rate limit, CSRF, production HTTPS check
  routes             auth, account, listings, bookings, social,
                     verification, protection, system
  engines            identity match, risk, valuation, protection
  ai/                provider boundary only; no live adapter
  local storage      encrypted ID files, verification records,
                     protection JSON store
        |
        |  service key, server only
        v
Supabase             Auth, Postgres, RLS, security-definer RPCs
```

The service-role key never reaches the browser. The SPA talks only to same-origin `/api`. Bootstrap, search, bookings, and writes go through the API. Row-level security remains on the database; the API is not a reason to open tables to the anon key.

```text
salif/
├── frontend/                 static UI
│   ├── index.html
│   ├── css/styles.css
│   ├── i18n/                 generated en.json and ar.json
│   ├── img/                  local listing photos
│   └── js/
│       ├── app.js            hash router and screens
│       ├── api.js            session and API client
│       ├── i18n.js           dictionaries
│       ├── verify.js         account confirmation
│       ├── protection.js     public unbound note only
│       ├── sentry.js         scrubbed client errors
│       └── cache/            IndexedDB listing grid
├── backend/
│   ├── src/app.js            Express app and middleware order
│   ├── src/index.js          process entry
│   ├── src/server.js         HTTP server wrapper
│   ├── src/middleware/       protect.js, auth.js
│   ├── src/routes/           one router per area
│   ├── src/http/             body, session, Supabase, static, responses
│   ├── src/engines/          deterministic rules
│   ├── src/ai/               unconfigured provider boundary
│   ├── src/security.js       headers and CSRF
│   └── src/ratelimit.js      route limits and login lockout
├── supabase/migrations/      000001 through 000019, additive
├── supabase/seed.sql         manual bilingual demo data
├── supabase/seed-locations.sql
├── docs/
├── scripts/qa-probes.sh
└── .github/workflows/        staging, preview QA, production
```

### Request pipeline

1. `X-Powered-By` is disabled.
2. `OPTIONS` returns 204 with the security headers.
3. In production, if `TRUST_PROXY=true`, a non-HTTPS forwarded protocol is rejected.
4. The custom limiter checks IP and, when present, a hash of the bearer token. A hit returns HTTP 429 and `Retry-After`.
5. State-changing `/api` calls need the double-submit CSRF token. `GET`, `HEAD`, and `OPTIONS` do not.
6. `requireAuth` loads the Supabase user from the bearer token and sets `req.user`. Routes do not trust an id sent in the body.
7. Listing, booking, favorite, review, and claim handlers then check ownership or party membership.
8. JSON bodies are size-limited. ID and verification uploads are read raw, not through a JSON parser.
9. Unknown `/api` paths return `NOT_FOUND`. Everything else is a static file, or `index.html` for a client route.
10. Uncaught route errors become a generic `INTERNAL_ERROR`. Details go to Sentry only if `SENTRY_DSN` is set.

Helmet’s default frame blocking is not used. The preview is embedded in an iframe. Production still sends HSTS, `X-Frame-Options: SAMEORIGIN`, and `frame-ancestors 'self'`.

### Frontend routes

| Hash | Screen |
| --- | --- |
| `#/` | Home |
| `#/explore` | Search and filters |
| `#/listing/:id` | Listing, booking, reviews |
| `#/how-it-works` | How sharing works |
| `#/safety` | Neighborhood safety |
| `#/login` `#/register` `#/forgot` | Auth |
| `#/terms` `#/privacy` | Legal pages linked from registration |
| `#/verify` | Account confirmation |
| `#/dashboard` | Bookings, listings, favorites |
| `#/new` `#/edit/:id` | Create or edit a listing |
| `#/member/:id` | Public neighbor profile |

### API

All paths are under `/api`. Unsafe methods require `X-CSRF-Token` plus the `salif_csrf` cookie.

| Area | Methods | Purpose |
| --- | --- | --- |
| System | `GET /health` `/csrf` `/bootstrap` `/search` `/available` `/locations` | Liveness, CSRF issue, public catalog, search, dates, gazetteer |
| System | `POST /telemetry` | Scrubbed client error |
| Auth | `POST /auth/login` `/register` `/demo` `/refresh` `/logout` `/forgot` `/reset` `/verify-email` | Session lifecycle |
| Auth | `POST /auth/id-document` | Raw ID upload before registration |
| Account | `GET` `PATCH /me`, `DELETE /me` | Profile and deletion |
| Account | `GET /users/:id/identity-document` | Always forbidden |
| Listings | `GET` `POST /listings`, `GET` `PATCH` `DELETE /listings/:id` | Catalog and owner edits |
| Bookings | `GET` `POST /bookings`, `PATCH /bookings/:id/status` | Requests and status changes |
| Social | `GET` `POST /favorites`, `POST /reviews` | Wishlist and reviews |
| Verification | `GET /verification`, `/badges`, `/maps-config` | Status, public badge, map provider flag (`enabled: false`) |
| Verification | `POST /verification/email/*` `/phone/*` `/upload` `/identity` `/address` `/review` | Confirmation steps |
| Verification | `POST /verification/review/:id` | Hidden reviewer decision |
| Protection | `GET /protection/health`, `GET /listings/:id/protection` | Unbound public status |
| Protection | `POST /listings/:id/assess`, `GET` `POST /claims`, `POST /claims/:id/review` | Owner assessment, claims, hidden review |

`GET /verification/maps-config` reports `salif-neighborhood-map`. It does not enable an external provider.

### Data

Migrations `20240101000001` through `20240101000019` are additive. They do not delete existing rows.

| Migration | Adds |
| --- | --- |
| 000001–000007 | Profiles, listings, favorites, bookings, reviews, indexes, RLS, grants |
| 000008–000012 | `create_booking`, `toggle_favorite`, ratings view, search, availability |
| 000013–000014 | Locations and locale fields |
| 000015–000017 | Encrypted identity record and consent versions |
| 000018 | Verification tables. Not required for existing accounts to keep working |
| 000019 | Protection assessments, snapshots, claims, events. No protection columns on `listings` or `profiles`. Browser roles revoked |

Seeds are manual. They are not part of `db push`.

```bash
psql "$DIRECT_URL" -f supabase/seed.sql
psql "$DIRECT_URL" -f supabase/seed-locations.sql
```

Runtime verification records and protection assessments also have a local JSON store under `backend/storage/`. That directory is gitignored. It is not part of the public bootstrap. Do not put national IDs, valuation evidence, or coverage on `profiles` or `listings`. Those reads are broad.

### Security controls

| Control | Behavior |
| --- | --- |
| CSRF | 64-hex token, 4-hour cookie, `HttpOnly`, `SameSite=Lax`, `Secure` in production |
| Login lockout | 5 failures per IP and per account locks for 15 minutes |
| Registration | 5 requests per hour per IP |
| Password reset | 3 requests per hour |
| OTP sends | 5 per 10 minutes |
| ID and verification uploads | 6 per hour, 2 MB, JPEG/PNG/WebP signatures only |
| Other API routes | Route table in `backend/src/ratelimit.js`, otherwise 120 per minute |
| Static files | 400 per minute |
| Headers | `nosniff`, strict referrer, camera and microphone disabled, geolocation self only, CSP with self scripts |
| Proxy | `TRUST_PROXY=true` only behind a proxy you control. The limiter is in memory and is correct for one process |

Login and reset responses stay generic. Identity routes do not echo the national ID. Sentry context is scrubbed of passwords and ID numbers.

## Run

```bash
cp backend/.env.example backend/.env   # fill locally; never commit
cd backend && npm install
cd .. && npm start
```

Open `http://localhost:3000`.

Required in `backend/.env`:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Service role. Server only |
| `DATA_ENCRYPTION_KEY` | 64 hex characters. Encrypts identity data at rest |

Common flags:

| Variable | Safe default |
| --- | --- |
| `ALLOW_DEMO` | `false` outside a demo |
| `TRUST_PROXY` | `false` unless a trusted proxy sets `X-Forwarded-For` |
| `PORT` | `3000` |
| `NODE_ENV` | unset locally; `production` enables HSTS, frame headers, Secure cookies, and refuses the OTP prototype |
| `VERIFICATION_PROTOTYPE` | unset in production |
| `VERIFICATION_GATE` | unset. `all` would require a completed verification record before publish and booking |
| `VERIFICATION_REVIEWER_KEY` | unset |
| `SALIF_PUBLISH_GATE` | `prohibited` |
| `VISION_PROVIDER` `OCR_PROVIDER` `MARKET_PROVIDER` | unset. A name is not a connection |
| `MARKET_SOURCE_ALLOWLIST` | empty, so market collection does not fetch |
| `AI_DEV_MOCK` | `false`, and ignored in production |
| `PROTECTION_REVIEWER_KEY` | unset |
| `SENTRY_DSN` | optional |

The root `.env.example` also lists database URLs and a publishable key for operators. The browser bundle does not receive the service key, the encryption key, or a provider credential.

## Checks

```bash
node backend/src/engines.selfcheck.js
node backend/src/verification.selfcheck.js
npm run qa    # needs the server on port 3000
```

`scripts/qa-probes.sh` checks health, bootstrap, search, locations, availability, and the Arabic homepage. Preview deploys run the same script from `.github/workflows/preview-qa.yml`.

## For the next developer

- Add an HTTP route in the matching file under `backend/src/routes/`. Do not grow a second server.
- Protect a signed-in route with `requireAuth`. Check owner or party in the handler. Do not trust a user id from the body.
- Keep business rules in `backend/src/engines/` or in a Postgres RPC. The route should map errors, not invent a second policy.
- Do not log passwords, tokens, national IDs, or one-time codes.
- Do not add a global `express.json()`. Uploads are raw.
- Do not replace `ratelimit.js` with a generic limiter, and do not enable Helmet’s default frame guard.
- A new market or vision provider must implement the boundary in `backend/src/ai/` and must not set risk or `protection_bound` by itself.
- Migrations stay additive. Existing users, listings, bookings, reviews, favorites, and routes keep working.
