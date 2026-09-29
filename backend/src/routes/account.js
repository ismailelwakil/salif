'use strict';
const { Router } = require('express');
const identity = require('../identity');
const verification = require('../verification');
const { asyncHandler } = require('../http/async');
const { readBody } = require('../http/body');
const { sendJSON, sendError } = require('../http/respond');
const { supaFetch } = require('../http/supabase');
const { bearer, getProfile, revokeToken } = require('../http/session');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.get('/users/:id([0-9a-f-]{36})/identity-document', (req, res) => {
  sendError(res, 403, 'FORBIDDEN', 'You cannot access this document.');
});

router.delete('/me', requireAuth('Not signed in.'), asyncHandler(async (req, res) => {
  const user = req.user;
  if (/@salif\.app$/i.test(user.email || '')) return sendError(res, 403, 'FORBIDDEN', 'Demo accounts stay available for the neighborhood.');
  const ident = await supaFetch('/rest/v1/identity_records?user_id=eq.' + user.id + '&select=document_ref&limit=1', { service: true });
  const ref = ident.body && ident.body[0] && ident.body[0].document_ref;
  if (ref) identity.deleteDocument(ref);
  const r = await supaFetch('/auth/v1/admin/users/' + user.id, { method: 'DELETE', service: true });
  if (r.status >= 300) return sendError(res, 500, 'INTERNAL_ERROR', 'Could not delete the account.');
  verification.purge(user.id);
  revokeToken(bearer(req));
  sendJSON(res, 200, { ok: true });
}));

router.get('/me', requireAuth('Not signed in.'), asyncHandler(async (req, res) => {
  sendJSON(res, 200, { user: req.user, profile: await getProfile(req.user.id) });
}));

router.patch('/me', requireAuth('Not signed in.'), asyncHandler(async (req, res) => {
  const body = await readBody(req);
  const patch = { updated_at: new Date().toISOString() };
  if (typeof body.full_name === 'string' && body.full_name.trim()) patch.full_name = body.full_name.trim().slice(0, 120);
  if (typeof body.full_name_latin === 'string') patch.full_name_latin = body.full_name_latin.trim().slice(0, 120) || null;
  if (typeof body.bio === 'string') patch.bio = body.bio.slice(0, 500);
  if (typeof body.neighborhood === 'string' && body.neighborhood.trim()) patch.neighborhood = body.neighborhood.trim().slice(0, 80);
  if (typeof body.avatar_url === 'string') patch.avatar_url = body.avatar_url.slice(0, 500) || null;
  const r = await supaFetch('/rest/v1/profiles?id=eq.' + req.user.id, { method: 'PATCH', service: true, body: patch });
  if (r.status >= 300) return sendError(res, 500, 'INTERNAL_ERROR', 'Could not save the profile.');
  sendJSON(res, 200, { profile: await getProfile(req.user.id) });
}));

module.exports = router;
