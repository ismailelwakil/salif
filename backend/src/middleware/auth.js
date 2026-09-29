'use strict';
const { sendError } = require('../http/respond');
const { bearer, getUserFromToken } = require('../http/session');
const verification = require('../verification');

function requireAuth(message) {
  return async function requireAuthMiddleware(req, res, next) {
    try {
      const user = await getUserFromToken(bearer(req));
      if (!user) return sendError(res, 401, 'UNAUTHORIZED', message || 'Sign in first.');
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireActivity(message) {
  return function requireActivityMiddleware(req, res, next) {
    const gate = verification.checkActivity(req.user.id);
    if (!gate.ok) return sendError(res, 403, 'VERIFICATION_REQUIRED', message || 'Complete identity verification to continue.');
    next();
  };
}

function requireReviewer(envName) {
  return function requireReviewerMiddleware(req, res, next) {
    const expected = process.env[envName] || '';
    if (!expected || req.headers['x-reviewer-key'] !== expected) {
      return sendError(res, 404, 'NOT_FOUND', 'Unknown endpoint.');
    }
    next();
  };
}

module.exports = { requireAuth, requireActivity, requireReviewer };
