'use strict';
const { Router } = require('express');
const rpc = require('../lib/rpc');
const sentry = require('../lib/sentry');
const { asyncHandler } = require('../http/async');
const { readBody } = require('../http/body');
const { sendJSON, sendError, attachCsrf } = require('../http/respond');
const { supaFetch } = require('../http/supabase');

const router = Router();

router.get('/health', (req, res) => {
  sendJSON(res, 200, { ok: true, app: 'سلف', name: 'Salif', framework: 'express' });
});

router.get('/csrf', (req, res) => {
  sendJSON(res, 200, { csrfToken: attachCsrf(res) });
});

router.post('/telemetry', asyncHandler(async (req, res) => {
  const b = await readBody(req);
  sentry.capture(b.message || 'client error', {
    stack: String(b.stack || '').slice(0, 2000),
    href: String(b.href || '').slice(0, 300),
    lang: b.lang || '',
  });
  sendJSON(res, 202, { ok: true });
}));

router.get('/bootstrap', asyncHandler(async (req, res) => {
  const [listings, profiles, reviews, ratings, locations] = await Promise.all([
    supaFetch('/rest/v1/listings?select=*&order=created_at.desc', { service: true }),
    supaFetch('/rest/v1/profiles?select=*', { service: true }),
    supaFetch('/rest/v1/reviews?select=*&order=created_at.desc', { service: true }),
    supaFetch('/rest/v1/listing_ratings?select=*', { service: true }),
    supaFetch('/rest/v1/locations?select=*&order=name', { service: true }),
  ]);
  const publicProfiles = (Array.isArray(profiles.body) ? profiles.body : []).map((row) => {
    const copy = { ...row };
    delete copy.email;
    return copy;
  });
  sendJSON(res, 200, {
    listings: listings.body || [],
    profiles: publicProfiles,
    reviews: reviews.body || [],
    ratings: Array.isArray(ratings.body) ? ratings.body : [],
    locations: Array.isArray(locations.body) ? locations.body : [],
  });
}));

router.get('/search', asyncHandler(async (req, res) => {
  const r = await rpc.searchListings(supaFetch, {
    q: req.query.q,
    type: req.query.type,
    category: req.query.category || req.query.cat,
    location: req.query.location,
    sort: req.query.sort,
    limit: req.query.limit,
  });
  if (!Array.isArray(r.body)) return sendError(res, 500, 'INTERNAL_ERROR', 'Search failed.');
  sendJSON(res, 200, { listings: r.body });
}));

router.get('/available', asyncHandler(async (req, res) => {
  const start = String(req.query.start || '');
  const end = String(req.query.end || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'start and end dates are required.');
  }
  const r = await rpc.availableListings(supaFetch, {
    start, end,
    category: req.query.category,
    location: req.query.location,
    limit: req.query.limit,
  });
  if (!Array.isArray(r.body)) {
    const mapped = rpc.mapRpcError(r.body);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Availability lookup failed.');
  }
  sendJSON(res, 200, { listings: r.body });
}));

router.get('/locations', asyncHandler(async (req, res) => {
  const r = await supaFetch('/rest/v1/locations?select=*&order=name', { service: true });
  sendJSON(res, 200, { locations: Array.isArray(r.body) ? r.body : [] });
}));

module.exports = router;
