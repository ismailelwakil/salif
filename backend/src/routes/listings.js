'use strict';
const { Router } = require('express');
const engines = require('../engines');
const { asyncHandler } = require('../http/async');
const { readBody } = require('../http/body');
const { sendJSON, sendError } = require('../http/respond');
const { supaFetch } = require('../http/supabase');
const { requireAuth, requireActivity } = require('../middleware/auth');

const LISTING_TYPES = new Set(['ITEM', 'SKILL']);
const LISTING_STATUSES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
const ALLOWED_IMG = /^\/img\/[a-z0-9\-_.]+\.(jpg|jpeg|png|webp)$/i;
const router = Router();
const id = ':id([0-9a-fA-F-]{36})';

router.get('/listings', asyncHandler(async (req, res) => {
  const r = await supaFetch('/rest/v1/listings?select=*&order=created_at.desc', { service: true });
  sendJSON(res, 200, { listings: Array.isArray(r.body) ? r.body : [] });
}));

router.post('/listings', requireAuth('Sign in to share a listing.'), requireActivity('Complete identity verification to continue.'), asyncHandler(async (req, res) => {
  const b = await readBody(req);
  const title = (b.title || '').trim();
  const titleAr = (b.title_ar || '').trim();
  const description = (b.description || '').trim();
  const descriptionAr = (b.description_ar || '').trim();
  if (!title) return sendError(res, 400, 'VALIDATION_ERROR', 'Title is required.');
  if (!description) return sendError(res, 400, 'VALIDATION_ERROR', 'Description is required.');
  const type = LISTING_TYPES.has(b.type) ? b.type : 'ITEM';
  const images = Array.isArray(b.images) ? b.images.filter((image) => ALLOWED_IMG.test(image)).slice(0, 6) : [];
  if (!images.length) return sendError(res, 400, 'VALIDATION_ERROR', 'At least one image is required.');
  const price = b.price_per_day == null || b.price_per_day === '' ? null : Number(b.price_per_day);
  if (price != null && (!Number.isFinite(price) || price < 0)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid price.');
  const screened = engines.risk.classify({
    title: [title, titleAr, description, descriptionAr].join('\n'),
    category: b.category,
    identification_confidence: 'UNAVAILABLE',
    owner_risk_level: b.risk_level,
  });
  if (screened.level === 'PROHIBITED') return sendError(res, 403, 'ITEM_NOT_ALLOWED', 'This item cannot be listed on Salif.');
  const now = new Date().toISOString();
  const row = {
    owner_id: req.user.id, type,
    title: title.slice(0, 140), title_ar: (titleAr || title).slice(0, 140),
    description: description.slice(0, 2000), description_ar: (descriptionAr || description).slice(0, 2000),
    category: String(b.category || 'tools').slice(0, 40),
    price_per_day: price, currency: 'EGP',
    images, status: LISTING_STATUSES.has(b.status) ? b.status : 'ACTIVE',
    visibility: b.visibility === 'NEIGHBORHOOD_ONLY' ? 'NEIGHBORHOOD_ONLY' : 'PUBLIC',
    location: String(b.location || 'City Center').slice(0, 80),
    created_at: now, updated_at: now,
  };
  const r = await supaFetch('/rest/v1/listings', { method: 'POST', service: true, prefer: 'return=representation', body: row });
  if (r.status >= 300) return sendError(res, 500, 'INTERNAL_ERROR', 'Could not create the listing.');
  const listing = Array.isArray(r.body) ? r.body[0] : r.body;
  let assessment = null;
  try {
    assessment = engines.assess({
      title, title_ar: titleAr, description, description_ar: descriptionAr,
      category: row.category,
      declared_replacement_value: b.declared_replacement_value,
      owner_risk_level: b.risk_level,
    });
    engines.store.saveAssessment(listing.id, assessment);
  } catch { /* listing creation already succeeded */ }
  sendJSON(res, 201, { listing, assessment: assessment ? engines.ownerView(assessment) : null });
}));

router.get('/listings/' + id, asyncHandler(async (req, res) => {
  const r = await supaFetch('/rest/v1/listings?id=eq.' + req.params.id + '&limit=1', { service: true });
  const row = Array.isArray(r.body) ? r.body[0] : null;
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Listing not found.');
  sendJSON(res, 200, { listing: row });
}));

router.patch('/listings/' + id, requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const own = await supaFetch('/rest/v1/listings?id=eq.' + req.params.id + '&owner_id=eq.' + req.user.id + '&limit=1', { service: true });
  if (!(Array.isArray(own.body) && own.body.length)) return sendError(res, 403, 'FORBIDDEN', 'You can only manage your own listings.');
  const b = await readBody(req);
  const patch = { updated_at: new Date().toISOString() };
  for (const key of ['title', 'title_ar', 'description', 'description_ar', 'category', 'location']) {
    if (typeof b[key] === 'string') patch[key] = b[key].slice(0, key.startsWith('desc') ? 2000 : 140);
  }
  if (b.type && LISTING_TYPES.has(b.type)) patch.type = b.type;
  if (b.status && LISTING_STATUSES.has(b.status)) patch.status = b.status;
  if (b.price_per_day !== undefined) {
    const price = b.price_per_day == null || b.price_per_day === '' ? null : Number(b.price_per_day);
    if (price != null && (!Number.isFinite(price) || price < 0)) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid price.');
    patch.price_per_day = price;
  }
  if (Array.isArray(b.images)) {
    const images = b.images.filter((image) => ALLOWED_IMG.test(image)).slice(0, 6);
    if (images.length) patch.images = images;
  }
  const nextText = [patch.title, patch.title_ar, patch.description, patch.description_ar, patch.category].filter(Boolean).join('\n');
  if (nextText && engines.risk.classify({ title: nextText, identification_confidence: 'UNAVAILABLE' }).level === 'PROHIBITED') {
    return sendError(res, 403, 'ITEM_NOT_ALLOWED', 'This item cannot be listed on Salif.');
  }
  const r = await supaFetch('/rest/v1/listings?id=eq.' + req.params.id, { method: 'PATCH', service: true, body: patch });
  if (r.status >= 300) return sendError(res, 500, 'INTERNAL_ERROR', 'Could not update the listing.');
  sendJSON(res, 200, { listing: (await supaFetch('/rest/v1/listings?id=eq.' + req.params.id + '&limit=1', { service: true })).body[0] });
}));

router.delete('/listings/' + id, requireAuth('Sign in first.'), asyncHandler(async (req, res) => {
  const own = await supaFetch('/rest/v1/listings?id=eq.' + req.params.id + '&owner_id=eq.' + req.user.id + '&limit=1', { service: true });
  if (!(Array.isArray(own.body) && own.body.length)) return sendError(res, 403, 'FORBIDDEN', 'You can only manage your own listings.');
  const r = await supaFetch('/rest/v1/listings?id=eq.' + req.params.id, { method: 'DELETE', service: true });
  if (r.status >= 300) return sendError(res, 500, 'INTERNAL_ERROR', 'Could not delete the listing.');
  sendJSON(res, 200, { ok: true });
}));

module.exports = router;
