# سلف — architecture map

The product runs as a bilingual SPA plus a Node API that proxies Supabase. That is intentional: the live schema, seed data, and tested UI stay. The blueprint’s Next.js tree maps onto these files.

```
salif/
├── .github/workflows/
│   ├── staging-deploy.yml       # push to main → supabase db push (+ functions if present)
│   ├── preview-qa.yml           # deployment_status Preview → scripts/qa-probes.sh
│   └── production-deploy.yml    # tags v* + environment: production
├── supabase/
│   ├── config.toml
│   ├── migrations/              # 20240101000001 … 000014
│   ├── seed.sql                 # bilingual listings/users (manual)
│   └── seed-locations.sql       # Shibin El Kom lat/lng (manual)
├── frontend/                    # browser app — no secrets
│   ├── index.html
│   ├── css/styles.css
│   ├── i18n/
│   └── js/
│       ├── i18n.js              # locale dictionaries (source of frontend/i18n/*.json)
│       ├── api.js               # session, bootstrap, wishlist
│       ├── app.js               # router + views (home, search, listing, host, trips)
│       ├── cache/listingGridCache.js
│       └── sentry.js
├── backend/                     # Express API — service key from the environment only
│   ├── .env.example
│   └── src/
│       ├── index.js             # process entry
│       ├── app.js               # Express app, middleware order, routers
│       ├── server.js            # http.Server wrapper
│       ├── middleware/          # rate limit, CSRF, requireAuth
│       ├── routes/              # auth, account, listings, bookings, social, verification, protection
│       ├── engines/             # risk, valuation, protection rules
│       └── lib/rpc.js
├── scripts/qa-probes.sh
└── package.json
```

## Routes

| URL | View |
| --- | --- |
| `#/` | Home: hero, categories, carousels |
| `#/explore` | Search grid, filters, sort |
| `#/listing/:id` | Gallery, host, booking, reviews |
| `#/new` `#/edit/:id` | Host listing form |
| `#/dashboard` | Host inbox + guest trips + wishlist |
| `#/login` `#/register` | Auth |
| `#/member/:id` | Neighbor profile |

Protection, valuation, and risk rules are documented in [PROTECTION.md](PROTECTION.md). They do not replace listing or booking storage.

## Booking rules (RPC `create_booking`)

One transaction: requester is signed in, listing is ACTIVE, requester is not the owner, dates are valid, no overlap with PENDING / ACCEPTED / ACTIVE. Failures raise `SALIF:<CODE>` and the API maps them to 400 / 403 / 404 / 409.
