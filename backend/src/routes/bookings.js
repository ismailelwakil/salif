'use strict';
const { Router } = require('express');
const rpc = require('../lib/rpc');
const engines = require('../engines');
const { asyncHandler } = require('../http/async');
const { readBody } = require('../http/body');
const { sendJSON, sendError } = require('../http/respond');
const { supaFetch } = require('../http/supabase');
const { requireAuth, requireActivity } = require('../middleware/auth');

const router = Router();

router.post('/bookings', requireAuth('Sign in to request a booking.'), requireActivity('Complete identity verification to continue.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const listingId = String(b.listing_id || '');
  const listing = (await supaFetch('/rest/v1/listings?id=eq.' + encodeURIComponent(listingId) + '&limit=1', { service: true })).body[0];
  if (!listing) return sendError(res, 404, 'NOT_FOUND', 'Listing not found.');
  if (listing.owner_id === req.user.id) return sendError(res, 403, 'FORBIDDEN', 'You cannot book your own listing.');
  const start = String(b.start_date || '');
  const end = String(b.end_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Pick a valid date range.');
  }
  const r = await rpc.createBooking(supaFetch, {
    listingId, requesterId: req.user.id, start, end,
    message: String(b.message || '').slice(0, 600),
  });
  if (r.status >= 300 || !r.body || !r.body.id) {
    const mapped = rpc.mapRpcError(r.body);
    if (mapped) return sendError(res, mapped.status, mapped.code, mapped.message);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Could not send the request.');
  }
  let protectionSnapshot = null;
  try { protectionSnapshot = engines.snapshotFor(r.body, listing); } catch { /* booking already exists */ }
  sendJSON(res, 201, {
    booking: r.body,
    protection: protectionSnapshot ? {
      protection_bound: false,
      protection_fee: null,
      coverage_limit: null,
      rental_price_per_day: listing.price_per_day,
      policy_version: protectionSnapshot.policy_version,
    } : engines.publicView(null),
  });
}));

router.get('/bookings', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const mine = await supaFetch('/rest/v1/bookings?requester_id=eq.' + req.user.id + '&order=created_at.desc', { service: true });
  const ownedListings = await supaFetch('/rest/v1/listings?owner_id=eq.' + req.user.id + '&select=id', { service: true });
  const ids = (Array.isArray(ownedListings.body) ? ownedListings.body : []).map((listing) => 'listing_id.eq.' + listing.id).join(',');
  const theirs = ids
    ? await supaFetch('/rest/v1/bookings?or=(' + ids + ')&order=created_at.desc', { service: true })
    : { body: [] };
  sendJSON(res, 200, { as_requester: mine.body || [], as_owner: theirs.body || [] });
}));

router.patch('/bookings/:id([0-9a-fA-F-]{36})/status', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const booking = (await supaFetch('/rest/v1/bookings?id=eq.' + req.params.id + '&limit=1', { service: true })).body[0];
  if (!booking) return sendError(res, 404, 'NOT_FOUND', 'Booking not found.');
  const listing = (await supaFetch('/rest/v1/listings?id=eq.' + booking.listing_id + '&limit=1', { service: true })).body[0];
  const isOwner = listing && listing.owner_id === req.user.id;
  const isRequester = booking.requester_id === req.user.id;
  const next = String(b.status || '');
  const transitions = {
    PENDING: { owner: ['ACCEPTED', 'DECLINED'], requester: ['CANCELLED'] },
    ACCEPTED: { owner: ['ACTIVE', 'CANCELLED'], requester: ['CANCELLED'] },
    ACTIVE: { owner: ['COMPLETED', 'DISPUTED'], requester: ['COMPLETED', 'DISPUTED'] },
  };
  const allowed = (transitions[booking.status] || {})[isOwner ? 'owner' : isRequester ? 'requester' : 'none'] || [];
  if (!allowed.includes(next)) return sendError(res, 403, 'FORBIDDEN', 'That status change is not allowed.');
  const r = await supaFetch('/rest/v1/bookings?id=eq.' + req.params.id, {
    method: 'PATCH', service: true,
    body: { status: next, updated_at: new Date().toISOString() },
  });
  if (r.status >= 300) return sendError(res, 500, 'INTERNAL_ERROR', 'Could not update the booking.');
  sendJSON(res, 200, { ok: true, status: next });
}));

module.exports = router;
