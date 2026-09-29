# Protection, risk, and valuation

Salif does not currently sell insurance, read ID cards, or price items from the live web. This document describes the rules that are actually implemented, and the boundaries that stay closed until a real provider is configured.

## Architecture

```text
Frontend
  → existing Node API
      → deterministic rules (identity, risk, valuation, protection)
      → AI provider boundary (unconfigured)
      → market source registry (no live adapter)
      → local protection store, plus an additive SQL migration
```

The frontend displays results. It does not decide eligibility, risk, coverage, or identity. The AI module may only return structured evidence. With no provider configured, it returns no identification and no prices. The rules engine then records `UNKNOWN` risk and `VALUATION_UNAVAILABLE`. It does not guess.

## What already existed

Registration, login, password reset, listings, bookings, reviews, favorites, the six-neighborhood map, encrypted national ID storage, and the account-confirmation flow are unchanged in their contracts. A normal listing payload still creates an active listing. A normal booking still follows the existing date, owner, and overlap rules.

## Conflict that was not silently rewritten

The requested identity rule blocks registration when an extracted national ID, date of birth, or name does not match. No document-reading provider is configured, so there is no extracted value. Blocking every registration because a reader is missing would stop the existing product. The implemented rule is:

- If both the typed value and an extracted value exist and they differ, the decision is `BLOCKED`. The typed value is not rewritten.
- If extraction is missing, the decision is `NEEDS_ACTION`, not a pass.
- The current register route does not call a reader and does not block account creation for that reason.
- Uploading an ID photo still does not mean the identity was verified.

`SALIF_PUBLISH_GATE=risk` would hold every unidentified listing. That would stop ordinary tool listings, because identification is unavailable. The default gate is `prohibited`: only items matching the prohibited policy are refused. Unidentified items are not labeled low risk and are not insured.

## Identity comparison

`backend/src/engines/identityMatch.js`

- National ID: 14 digits, exact equality. No fuzzy match and no correction.
- Date of birth: exact `YYYY-MM-DD`.
- Name: at least two meaningful parts, including the family name. If the card has three or more meaningful parts and the typed name does too, three must match. Arabic and Latin forms use an explicit alias list, not an open-ended guess. One shared token is not enough.
- Address: punctuation, order, and known place aliases can match. A different known city or governorate, or a different building number, does not.

## Valuation

`backend/src/engines/valuation.js`

The engine accepts only observations that already contain a source name, type, HTTPS URL, title, price, currency, time, market type, match level, and reliability. It does not browse Amazon, Jumia, Noon, or any other site. The source registry lists those markets as unconfigured adapters. An empty allowlist means no collection request is permitted. Private hosts, IP literals, and non-HTTPS URLs are rejected.

Valid observations are split into new retail and used prices. Replacement value uses new retail evidence only. Used prices are not treated as replacement value. Rental, wholesale, accessory-only, damaged, foreign-currency, stale, duplicate, and unapproved observations are excluded. With at least four prices, a price more than three times the median, or less than one third of it, is excluded. The aggregate is a reliability-weighted median.

Confidence is calculated from the policy counts, not from a model’s self-score:

- `HIGH`: at least three independent trusted sources, two exact matches, fresh evidence, and prices within 25 percent of the median.
- `MEDIUM`: at least two independent sources, one trusted, and one fresh observation.
- `LOW`: any weaker accepted set.
- `UNAVAILABLE`: no accepted evidence. No price is emitted.

An owner-declared replacement value is not approved without replacement evidence. A low-confidence result is manual review, not automatic acceptance. A declared value above ten times the high end of the evidence is rejected. These ratios live in `backend/src/engines/policy.js` version `2026-09-29`.

## Risk

`backend/src/engines/risk.js`

Factors are legal, injury, misuse, property damage, theft, value, complexity, skill, and identification confidence. The owner cannot submit a risk level. A `risk_level` field on a listing request is ignored.

If identification is not `HIGH` or `MEDIUM`, the result is `UNKNOWN`, even for a drill. A title that matches the prohibited policy is `PROHIBITED` even if the owner asks for low risk. The public error does not explain which term matched.

The prohibited policy covers firearms, explosives, and illegal substances in English and Arabic. It does not treat ordinary kitchen or tool words as weapons. Uncertain wording is not an accusation; it stays `UNKNOWN` rather than `PROHIBITED` or `LOW`.

## Protection

`backend/src/engines/protection.js`

Risk and protection are separate. The requirement can be `NOT_REQUIRED`, `OPTIONAL`, `REQUIRED`, `MANUAL_REVIEW`, or `NOT_ELIGIBLE`. None of those states binds coverage, because `protection.underwriter` is null. The fee formula, 15 basis points of coverage per day capped at 500 EGP, is inactive. The API returns no protection fee and no coverage limit. The rental price is unchanged.

A booking stores a snapshot of that result: rental price, policy version, and `protection_bound: false`. Later policy edits do not rewrite the snapshot. There is no payment capture.

A claim can be opened by a booking party during or after the exchange. Opening a claim does not approve it and does not change the booking status. A reviewer decision requires `PROTECTION_REVIEWER_KEY` and is not a new product role.

## AI boundary

`backend/src/ai/providers.js` and `backend/src/ai/orchestrator.js`

`VISION_PROVIDER`, `OCR_PROVIDER`, and `MARKET_PROVIDER` are not bundled adapters. Setting the variable does not invent a connection. `AI_DEV_MOCK=true` is ignored when `NODE_ENV=production`. The mock returns no brand, no price, and no identity fields. Page text is never treated as an instruction.

Listing photos and ID images are not sent to an external model.

## Data

`supabase/migrations/20240101000019_protection.sql` adds assessments, booking snapshots, claims, and events. It does not change listings, bookings, reviews, or identity records. Browser roles have no access. This environment cannot apply the migration. The running API uses `backend/storage/protection/`, which is not part of the public bootstrap. Declared replacement values are not added to listing rows, because those rows are public.

## Environment

```text
SALIF_PUBLISH_GATE=prohibited
VISION_PROVIDER=
OCR_PROVIDER=
MARKET_PROVIDER=
MARKET_SOURCE_ALLOWLIST=
AI_DEV_MOCK=false
PROTECTION_REVIEWER_KEY=
```

Secrets stay in the server environment. The frontend has no provider key.

## Deployment

The browser talks only to the existing Node API. The API does not call an AI host. Health is `GET /api/protection/health`. Rollback is to stop reading the new routes; existing listing and booking tables are untouched.

## Tests

`node backend/src/engines.selfcheck.js` checks identity match and mismatch, missing OCR, unknown risk, prohibited items, prompt-injection text, empty valuation, weak and strong evidence, outliers, inactive protection, and the production mock refusal.

## Changing a rule

Edit `backend/src/engines/policy.js` and keep the version string in step with the change. Do not put a new percentage only inside a decision function. A new market source needs an allowlisted HTTPS adapter that returns evidence objects. It must not fetch a URL supplied by a listing. A new AI provider must implement the provider boundary and must not set `risk.level` or `protection_bound`.
