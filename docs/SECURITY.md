# سلف — authentication security

New accounts must submit a full name, a 14-digit national ID, an ID image, a neighborhood chosen from the built-in Shibin El Kom list, an email, a strong password, and four separate agreements. Existing demo login, bookings, and browsing are unchanged.

- Passwords are not stored by this app. Supabase Auth hashes them with bcrypt before they are saved.
- National IDs are encrypted with AES-256-GCM. Only a keyed hash is kept for duplicate checks.
- ID images are checked for type, size, and file signature, then encrypted outside the web root. Neighbors cannot download them.
- The public profile API does not return email addresses, national IDs, or document paths.
- Login and password-reset responses do not say whether an email is registered.
- Failed logins are throttled per IP and per account. Logout revokes the session on this server and at Supabase.
- State-changing API calls require a server-issued CSRF token. The browser script sends it in `X-CSRF-Token`.
- `DATA_ENCRYPTION_KEY` must be set in `backend/.env`. Do not commit it.

The location control is the existing neighborhood gazetteer, drawn as a local map. There is no external map provider. Device location is requested only if the person clicks the button, then snapped to the nearest neighborhood and discarded.

Rate limits are in memory, which matches this single server. Set `TRUST_PROXY=true` only behind a proxy you control. Multi-instance deployments need a shared limiter; none is configured here.
