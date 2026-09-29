'use strict';
const { Router } = require('express');
const rpc = require('../lib/rpc');
const { asyncHandler } = require('../http/async');
const { readBody } = require('../http/body');
const { sendJSON, sendError } = require('../http/respond');
const { supaFetch } = require('../http/supabase');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/favorites', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const r = await supaFetch('/rest/v1/favorites?user_id=eq.' + req.user.id + '&select=listing_id', { service: true });
  sendJSON(res, 200, { favorites: (r.body || []).map((row) => row.listing_id) });
}));

router.post('/favorites', requireAuth('Sign in to save favorites.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const listingId = String(b.listing_id || '');
  if (!listingId) return sendError(res, 400, 'VALIDATION_ERROR', 'Missing listing.');
  const r = await rpc.toggleFavorite(supaFetch, { listingId, userId: req.user.id, remove: !!b.remove });
  if (r.status >= 300) {
    const mapped = rpc.mapRpcError(r.body);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Could not save the favorite.');
  }
  sendJSON(res, 200, { favorited: r.body === true });
}));

router.post('/reviews', requireAuth('Sign in to leave a review.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const listingId = String(b.listing_id || '');
  const rating = Number(b.rating);
  if (!listingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Rating must be 1–5.');
  }
  const completed = await supaFetch(
    '/rest/v1/bookings?listing_id=eq.' + listingId + '&requester_id=eq.' + req.user.id + '&status=eq.COMPLETED&limit=1',
    { service: true }
  );
  const listing = (await supaFetch('/rest/v1/listings?id=eq.' + listingId + '&select=owner_id&limit=1', { service: true })).body[0];
  const eligible = (Array.isArray(completed.body) && completed.body.length) || (listing && listing.owner_id === req.user.id);
  if (!eligible) return sendError(res, 403, 'FORBIDDEN', 'Reviews open after a completed exchange.');
  const r = await supaFetch('/rest/v1/reviews', {
    method: 'POST', service: true, prefer: 'return=representation',
    body: {
      listing_id: listingId, author_id: req.user.id, rating,
      comment: String(b.comment || '').slice(0, 1000),
      created_at: new Date().toISOString(),
    },
  });
  if (r.status >= 300) return sendError(res, 500, 'INTERNAL_ERROR', 'Could not post the review.');
  sendJSON(res, 201, { review: Array.isArray(r.body) ? r.body[0] : r.body });
}));

module.exports = router;
