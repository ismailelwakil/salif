'use strict';
const { Router } = require('express');
const identity = require('../identity');
const limits = require('../ratelimit');
const verification = require('../verification');
const { asyncHandler } = require('../http/async');
const { readBody, readRaw } = require('../http/body');
const { sendJSON, sendError } = require('../http/respond');
const { supaFetch } = require('../http/supabase');
const { requireAuth, requireReviewer } = require('../middleware/auth');

const router = Router();

router.get('/verification/maps-config', (req, res) => {
  sendJSON(res, 200, { enabled: false, provider: 'salif-neighborhood-map' });
});

router.get('/verification/badges', (req, res) => {
  const ids = String(req.query.ids || '').split(',').map((item) => item.trim()).filter((item) => /^[0-9a-f-]{36}$/i.test(item));
  sendJSON(res, 200, { badges: verification.badges(ids) });
});

router.use('/verification/documents', (req, res) => {
  sendError(res, 403, 'FORBIDDEN', 'You cannot access this document.');
});

router.get('/verification', requireAuth('Sign in first.'), (req, res) => {
  sendJSON(res, 200, verification.publicStatus(verification.getRecord(req.user.id)));
});

router.post('/verification/email/send', requireAuth('Sign in first.'), (req, res) => {
  const result = verification.sendOtp(req.user.id, 'email', String(req.user.email || '').toLowerCase());
  if (result.error === 'provider') return sendError(res, 503, 'PROVIDER_NOT_CONFIGURED', result.message);
  if (result.error) return sendError(res, 429, 'RATE_LIMITED', result.message);
  sendJSON(res, 200, result);
});

router.post('/verification/email/confirm', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const result = verification.confirmOtp(req.user.id, 'email', b.code, String(req.user.email || '').toLowerCase());
  if (result.error) return sendError(res, 400, 'VALIDATION_ERROR', result.message);
  sendJSON(res, 200, result);
}));

router.post('/verification/phone/send', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const set = verification.setPhone(req.user.id, b.phone || verification.storedPhone(verification.getRecord(req.user.id)));
  if (set.error) return sendError(res, 400, 'VALIDATION_ERROR', set.message);
  const result = verification.sendOtp(req.user.id, 'phone', set.phone);
  if (result.error === 'provider') return sendError(res, 503, 'PROVIDER_NOT_CONFIGURED', result.message);
  if (result.error) return sendError(res, 429, 'RATE_LIMITED', result.message);
  sendJSON(res, 200, result);
}));

router.post('/verification/phone/confirm', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const phone = verification.storedPhone(verification.getRecord(req.user.id));
  if (!phone) return sendError(res, 400, 'VALIDATION_ERROR', 'Enter a phone number first.');
  const result = verification.confirmOtp(req.user.id, 'phone', b.code, phone);
  if (result.error) return sendError(res, 400, 'VALIDATION_ERROR', result.message);
  sendJSON(res, 200, result);
}));

router.post('/verification/upload', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const kind = String(req.headers['x-upload-kind'] || '');
  let buf;
  try { buf = await readRaw(req, identity.MAX_BYTES); }
  catch { return sendError(res, 413, 'VALIDATION_ERROR', 'The photo must be a JPEG, PNG, or WebP image under 2 MB.'); }
  const result = verification.acceptUpload(req.user.id, kind, buf, {
    contentType: req.headers['content-type'],
    ext: req.headers['x-upload-ext'],
  }, limits.clientIp(req));
  if (result.error === 'quality') return sendError(res, 400, 'QUALITY', result.message);
  if (result.error) return sendError(res, 400, 'VALIDATION_ERROR', result.message);
  sendJSON(res, 201, result);
}));

router.post('/verification/identity', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const result = verification.confirmIdentity(req.user.id, b);
  if (result.error) return sendError(res, 400, 'VALIDATION_ERROR', result.message);
  sendJSON(res, 200, result);
}));

router.post('/verification/address', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const locId = String(b.location_id || '');
  const locRes = /^[0-9a-f-]{36}$/i.test(locId)
    ? await supaFetch('/rest/v1/locations?id=eq.' + encodeURIComponent(locId) + '&select=id,name&limit=1', { service: true })
    : { body: [] };
  const location = Array.isArray(locRes.body) ? locRes.body[0] : null;
  const result = verification.saveAddress(req.user.id, b, location);
  if (result.error) return sendError(res, 400, 'VALIDATION_ERROR', result.message);
  if (location) {
    await supaFetch('/rest/v1/profiles?id=eq.' + req.user.id, {
      method: 'PATCH', service: true,
      body: { neighborhood: location.name, updated_at: new Date().toISOString() },
    });
  }
  sendJSON(res, 200, result);
}));

router.post('/verification/review', requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const result = verification.requestReview(req.user.id, b.reason);
  if (result.error) return sendError(res, 429, 'RATE_LIMITED', result.message);
  sendJSON(res, 200, result);
}));

router.post('/verification/review/:id([0-9a-fA-F-]{36})', requireReviewer('VERIFICATION_REVIEWER_KEY'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const result = verification.reviewerDecision(req.params.id, b.action, 'reviewer');
  if (!result) return sendError(res, 404, 'NOT_FOUND', 'No verification record.');
  if (result.error) return sendError(res, 400, 'VALIDATION_ERROR', 'Choose approve or reject.');
  sendJSON(res, 200, { ok: true });
}));

module.exports = router;
