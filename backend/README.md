# سلف — backend

Express application. It is the only process that holds the Supabase service key.

```bash
cp .env.example .env   # fill locally; never commit
npm install
npm start
```

`ALLOW_DEMO=true` enables one-click `@salif.app` sign-in. Leave it `false` outside a demo.

## Layout

```text
src/app.js                 Express app and middleware order
src/index.js               Process entry
src/server.js              http.Server wrapper used by npm start
src/middleware/protect.js  Rate limit, CSRF, HTTPS check
src/middleware/auth.js     requireAuth, requireActivity, requireReviewer
src/routes/                One router per area: auth, account, listings, bookings, social, verification, protection
src/http/                  Response, body, Supabase, and session helpers
src/engines/               Deterministic risk, valuation, and protection rules
src/ai/                    Provider boundary. Unconfigured providers do not invent results.
```

## Security choices

- `X-Powered-By` is disabled.
- Security headers stay in `src/security.js`. Helmet’s default frame blocking is not used, because it would break the embedded preview. Production still sends HSTS and `X-Frame-Options`.
- Unsafe API methods require the existing double-submit CSRF cookie. The cookie is HttpOnly and SameSite, and Secure in production.
- Login lockout and route limits stay in `src/ratelimit.js`. A generic limiter is not a replacement.
- `requireAuth` loads the Supabase user from the bearer token and attaches `req.user`. Routes do not trust an id sent by the browser.
- Listing changes and booking decisions check ownership or party membership in the route.
- Reviewer actions are hidden unless the matching server-only key is present. That is not a product role.
- Request bodies are read with a size limit. Raw uploads are not passed through a JSON parser, so a photo cannot be truncated into JSON.
- Identity documents, national IDs, and provider secrets are not returned by profile or listing routes.

## Adding a route

Add it to the router for that area. Protect it with `requireAuth` if it needs a session. Do not read the service key in the route. Do not log passwords, tokens, national IDs, or one-time codes.
