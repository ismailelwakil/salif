'use strict';
const { Router } = require('express');
const engines = require('../engines');
const { asyncHandler } = require('../http/async');
const { readBody } = require('../http/body');
const { sendJSON, sendError } = require('../http/respond');
const { supaFetch } = require('../http/supabase');
const { requireAuth, requireReviewer } = require('../middleware/auth');

const router = Router();

router.get('/protection/health', (req, res) => {
  sendJSON(res, 200, {
    ok: true,
    policy_version: engines.policy().version,
    vision: false,
    ocr: false,
    market: false,
    underwriter: false,
    valuation: 'unavailable_without_evidence',
  });
});

router.get('/listings/:id([0-9a-fA-F-]{36})/protection', (req, res) => {
  sendJSON(res, 200, engines.publicView(engines.store.getAssessment(req.params.id)));
});

router.post('/listings/:id([0-9a-fA-F-]{36})/assess', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const own = await supaFetch('/rest/v1/listings?id=eq.' + req.params.id + '&owner_id=eq.' + req.user.id + '&select=id,title,description,category&limit=1', { service: true });
  const listing = Array.isArray(own.body) ? own.body[0] : null;
  if (!listing) return sendError(res, 404, 'NOT_FOUND', 'Listing not found.');
  const b = await readBody(req);
  const assessment = engines.assess(Object.assign({}, listing, {
    declared_replacement_value: b.declared_replacement_value,
    owner_risk_level: b.risk_level,
  }));
  engines.store.saveAssessment(listing.id, assessment);
  sendJSON(res, 200, { assessment: engines.ownerView(assessment) });
}));

router.get('/claims', requireAuth('Sign in first.'), (req, res) => {
  sendJSON(res, 200, {
    claims: engines.store.claimsFor(req.user.id).map((claim) => ({
      id: claim.id, booking_id: claim.booking_id, status: claim.status, created_at: claim.created_at,
    })),
  });
});

router.post('/claims', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const booking = (await supaFetch('/rest/v1/bookings?id=eq.' + encodeURIComponent(String(b.booking_id || '')) + '&limit=1', { service: true })).body[0];
  if (!booking) return sendError(res, 404, 'NOT_FOUND', 'Booking not found.');
  const listing = (await supaFetch('/rest/v1/listings?id=eq.' + booking.listing_id + '&select=id,owner_id&limit=1', { service: true })).body[0];
  const party = booking.requester_id === req.user.id || (listing && listing.owner_id === req.user.id);
  if (!party) return sendError(res, 403, 'FORBIDDEN', 'You cannot open a claim for this booking.');
  if (!['ACTIVE', 'DISPUTED', 'COMPLETED'].includes(booking.status)) {
    return sendError(res, 403, 'FORBIDDEN', 'A claim can be opened during or after the exchange.');
  }
  const summary = String(b.summary || '').trim();
  if (summary.length < 8) return sendError(res, 400, 'VALIDATION_ERROR', 'Describe what happened.');
  const claim = engines.store.saveClaim({
    id: engines.store.id(),
    booking_id: booking.id,
    listing_id: booking.listing_id,
    requester_id: booking.requester_id,
    owner_id: listing ? listing.owner_id : '',
    status: 'OPEN',
    summary: summary.slice(0, 1000),
    decision: null,
    created_at: new Date().toISOString(),
  });
  sendJSON(res, 201, { claim: { id: claim.id, status: claim.status } });
}));

router.post('/claims/:id([a-fA-F0-9]{32})/review', requireReviewer('PROTECTION_REVIEWER_KEY'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const reviewed = engines.store.reviewClaim(req.params.id, b.action);
  if (!reviewed) return sendError(res, 404, 'NOT_FOUND', 'Claim not found.');
  sendJSON(res, 200, { claim: reviewed });
}));

module.exports = router;
