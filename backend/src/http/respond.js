'use strict';
const { securityHeaders, issueCsrf, validCsrf, csrfCookie } = require('../security');

function attachCsrf(res) {
  const token = issueCsrf();
  res.setHeader('X-CSRF-Token', token);
  res.setHeader('Set-Cookie', csrfCookie(token));
  return token;
}

function csrfOk(req) {
  const header = req.headers['x-csrf-token'];
  if (!validCsrf(header)) return false;
  const cookie = String(req.headers.cookie || '');
  const match = cookie.match(/(?:^|;\s*)salif_csrf=([a-f0-9]{64})/);
  if (match && match[1] !== header) return false;
  return true;
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...securityHeaders(),
  };
  if (res.headersSent) return;
  if (typeof res.status === 'function') {
    res.status(status);
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    res.end(body);
    return;
  }
  res.writeHead(status, headers);
  res.end(body);
}

function sendError(res, status, code, message, extraHeaders) {
  if (extraHeaders) Object.entries(extraHeaders).forEach(([key, value]) => res.setHeader(key, value));
  sendJSON(res, status, { error: { code, message } });
}

function tooMany(res, retryAfter) {
  return sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Try again later.', {
    'Retry-After': String(retryAfter || 60),
  });
}

module.exports = { attachCsrf, csrfOk, sendJSON, sendError, tooMany };
