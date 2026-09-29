'use strict';
const config = require('../config');
const limits = require('../ratelimit');
const { securityHeaders } = require('../security');
const { csrfOk, sendError, tooMany } = require('../http/respond');

function requestUrl(req) {
  return new URL(req.originalUrl || req.url, 'http://localhost');
}

function gateRequests(req, res, next) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, securityHeaders());
    return res.end();
  }
  if (process.env.NODE_ENV === 'production' && config.trustProxy) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    if (proto && proto !== 'https') return sendError(res, 400, 'VALIDATION_ERROR', 'HTTPS is required.');
  }
  const url = requestUrl(req);
  const limited = limits.gate(req, url);
  if (!limited.ok) return tooMany(res, limited.retryAfter);
  if (url.pathname.startsWith('/api/')) {
    const safe = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (!safe && !csrfOk(req)) return sendError(res, 403, 'FORBIDDEN', 'Request could not be verified.');
  }
  next();
}

module.exports = { gateRequests, requestUrl };
