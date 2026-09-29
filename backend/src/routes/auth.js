'use strict';
const { Router } = require('express');
const config = require('../config');
const identity = require('../identity');
const limits = require('../ratelimit');
const verification = require('../verification');
const { asyncHandler } = require('../http/async');
const { readBody, readRaw } = require('../http/body');
const { sendJSON, sendError, tooMany } = require('../http/respond');
const { supaFetch } = require('../http/supabase');
const { bearer, getUserFromToken, getProfile, mintSession, revokeToken } = require('../http/session');

const GENERIC_AUTH = 'Invalid email or password.';
const GENERIC_REGISTER = 'If this email can be registered, the account is ready. If you already have one, sign in.';
const router = Router();

router.post('/auth/login', asyncHandler(async (req, res) => {
  const body = await readBody(req);
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  const ip = limits.clientIp(req);
  if (!email || !password) return sendError(res, 401, 'UNAUTHORIZED', GENERIC_AUTH);
  const lock = limits.loginAllowed(ip, email);
  if (!lock.ok) return tooMany(res, lock.retryAfter);
  const r = await supaFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (r.status !== 200) {
    limits.recordLoginFailure(ip, email);
    return sendError(res, 401, 'UNAUTHORIZED', GENERIC_AUTH);
  }
  limits.clearLoginFailures(ip, email);
  const profile = await getProfile(r.body.user.id);
  sendJSON(res, 200, {
    access_token: r.body.access_token, refresh_token: r.body.refresh_token,
    expires_in: r.body.expires_in, user: r.body.user, profile,
  });
}));

router.post('/auth/demo', asyncHandler(async (req, res) => {
  if (!config.allowDemo) return sendError(res, 403, 'FORBIDDEN', 'Demo sign-in is disabled.');
  const { email } = await readBody(req);
  if (!email || !/@salif\.app$/i.test(email)) return sendError(res, 403, 'FORBIDDEN', 'Demo accounts only.');
  try {
    const session = await mintSession(email);
    const profile = await getProfile(session.user.id);
    sendJSON(res, 200, { ...session, profile });
  } catch {
    sendError(res, 500, 'INTERNAL_ERROR', 'Demo sign-in failed.');
  }
}));

router.post('/auth/id-document', asyncHandler(async (req, res) => {
  let buf;
  try { buf = await readRaw(req, identity.MAX_BYTES); }
  catch { return sendError(res, 413, 'VALIDATION_ERROR', 'The ID document must be a JPEG, PNG, or WebP image under 2 MB.'); }
  const ref = identity.saveDocument(buf, limits.clientIp(req), {
    contentType: req.headers['content-type'],
    ext: req.headers['x-upload-ext'],
  });
  if (!ref) return sendError(res, 400, 'VALIDATION_ERROR', 'The ID document must be a JPEG, PNG, or WebP image under 2 MB.');
  sendJSON(res, 201, { upload_id: ref });
}));

router.post('/auth/register', asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const fullName = String(b.full_name || '').trim();
  const accepted = b.termsAccepted === true && b.privacyAccepted === true && b.dataProcessingConsent === true && (b.accurateInformationAndAgeConfirmed === true || b.accurateInfoAndAgeConfirmed === true);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, 'VALIDATION_ERROR', 'Valid email required.');
  if (!identity.strongPassword(password, email)) return sendError(res, 400, 'VALIDATION_ERROR', 'Use at least 10 characters with a letter and a number.');
  if (fullName.length < 5) return sendError(res, 400, 'VALIDATION_ERROR', 'Enter your full legal name.');
  if (!accepted || b.policy_version !== config.policyVersion) return sendError(res, 400, 'VALIDATION_ERROR', 'Accept the current terms to create an account.');
  const nationalId = identity.normalizeNationalId(b.national_id);
  if (!nationalId) return sendError(res, 400, 'VALIDATION_ERROR', 'Check the identity details and try again.');
  const uploadId = String(b.upload_id || '');
  if (!/^[a-f0-9]{32}$/.test(uploadId) || !identity.takeDocument(uploadId, limits.clientIp(req))) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Upload a valid ID document and try again.');
  }
  const locId = String(b.location_id || '');
  const locRes = /^[0-9a-f-]{36}$/i.test(locId)
    ? await supaFetch('/rest/v1/locations?id=eq.' + encodeURIComponent(locId) + '&select=id,name&limit=1', { service: true })
    : { body: [] };
  const location = Array.isArray(locRes.body) ? locRes.body[0] : null;
  if (!location) {
    identity.deleteDocument(uploadId);
    return sendError(res, 400, 'VALIDATION_ERROR', 'Choose a neighborhood from the map.');
  }
  if (b.verification_flow === true && !verification.normalizePhone(b.phone)) {
    identity.deleteDocument(uploadId);
    return sendError(res, 400, 'VALIDATION_ERROR', 'Enter an Egyptian mobile number.');
  }
  const created = await supaFetch('/auth/v1/admin/users', {
    method: 'POST', service: true,
    body: {
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName.slice(0, 120), email_verified: true },
    },
  });
  if (created.status === 422 || (created.body && created.body.error_code === 'email_exists')) {
    identity.deleteDocument(uploadId);
    return sendJSON(res, 200, { ok: true, needs_login: true, message: GENERIC_REGISTER });
  }
  if (created.status >= 300 || !created.body || !created.body.id) {
    identity.deleteDocument(uploadId);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Could not create the account.');
  }
  const uid = created.body.id;
  const now = new Date().toISOString();
  const profileWrite = await supaFetch('/rest/v1/profiles', {
    method: 'POST', service: true, prefer: 'resolution=merge-duplicates',
    body: {
      id: uid, email,
      full_name: fullName.slice(0, 120),
      full_name_latin: String(b.full_name_latin || '').trim().slice(0, 120) || null,
      neighborhood: location.name,
      bio: String(b.bio || '').slice(0, 500),
      created_at: now, updated_at: now,
    },
  });
  const idWrite = profileWrite.status < 300 ? await supaFetch('/rest/v1/identity_records', {
    method: 'POST', service: true,
    body: {
      user_id: uid,
      national_id_enc: identity.encryptString(nationalId),
      national_id_hash: identity.keyedHash(nationalId),
      document_ref: uploadId,
      location_id: location.id,
      neighborhood: location.name,
      policy_version: config.policyVersion,
      terms_version: config.policyVersion,
      privacy_version: config.policyVersion,
      privacy_policy_version: config.policyVersion,
      terms_accepted: true,
      privacy_accepted: true,
      data_processing_consent: true,
      accurate_information_and_age_confirmed: true,
      tos_accepted_at: now,
      terms_accepted_at: now,
      privacy_accepted_at: now,
      processing_consent_at: now,
      data_processing_consent_at: now,
      accuracy_age_accepted_at: now,
      accurate_information_and_age_confirmed_at: now,
    },
  }) : { status: 500 };
  if (profileWrite.status >= 300 || idWrite.status >= 300) {
    identity.deleteDocument(uploadId);
    await supaFetch('/auth/v1/admin/users/' + uid, { method: 'DELETE', service: true });
    const dup = idWrite.body && String(JSON.stringify(idWrite.body)).includes('national_id_hash');
    if (dup) return sendJSON(res, 200, { ok: true, needs_login: true, message: GENERIC_REGISTER });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Could not create the account.');
  }
  let verificationContinue = false;
  if (b.verification_flow === true) {
    try {
      verification.openForUser(uid, {
        frontRef: uploadId,
        neighborhood: location.name,
        locationId: location.id,
        phone: b.phone,
      });
      verificationContinue = true;
    } catch { /* registration itself already succeeded */ }
  }
  try {
    const session = await mintSession(email);
    const profile = await getProfile(uid);
    sendJSON(res, 200, { ...session, profile, verification: { continue: verificationContinue } });
  } catch {
    sendJSON(res, 200, { user: { id: uid, email }, needs_login: true });
  }
}));

router.post('/auth/verify-email', asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const token = String(b.token || b.access_token || '');
  if (token) await getUserFromToken(token);
  sendJSON(res, 200, { ok: true, message: 'If the verification link is valid, the email is confirmed.' });
}));

router.post('/auth/forgot', asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const email = String(b.email || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await supaFetch('/auth/v1/recover', { method: 'POST', body: { email } }).catch(() => {});
  }
  sendJSON(res, 200, { ok: true, message: 'If an account exists for that email, reset instructions will be sent.' });
}));

router.post('/auth/reset', asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const token = String(b.access_token || '');
  const password = String(b.password || '');
  const user = await getUserFromToken(token);
  if (!user) return sendError(res, 401, 'UNAUTHORIZED', 'This reset link is invalid or expired.');
  if (!identity.strongPassword(password, user.email)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Use at least 10 characters with a letter and a number.');
  }
  const updated = await supaFetch('/auth/v1/admin/users/' + user.id, { method: 'PUT', service: true, body: { password } });
  if (updated.status >= 300) return sendError(res, 500, 'INTERNAL_ERROR', 'Could not update the password.');
  revokeToken(token);
  sendJSON(res, 200, { ok: true });
}));

router.post('/auth/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = await readBody(req);
  if (!refresh_token) return sendError(res, 400, 'VALIDATION_ERROR', 'Missing refresh token.');
  const r = await supaFetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token } });
  if (r.status !== 200) return sendError(res, 401, 'UNAUTHORIZED', 'Session expired.');
  const profile = r.body.user ? await getProfile(r.body.user.id) : null;
  sendJSON(res, 200, {
    access_token: r.body.access_token, refresh_token: r.body.refresh_token || refresh_token,
    expires_in: r.body.expires_in, user: r.body.user, profile,
  });
}));

router.post('/auth/logout', asyncHandler(async (req, res) => {
  const token = bearer(req);
  if (token) {
    revokeToken(token);
    await supaFetch('/auth/v1/logout', { method: 'POST', token }).catch(() => {});
  }
  sendJSON(res, 200, { ok: true });
}));

module.exports = router;
