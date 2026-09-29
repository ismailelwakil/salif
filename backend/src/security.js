'use strict';
const crypto = require('crypto');

const csrfTokens = new Map();

function issueCsrf() {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, Date.now() + 4 * 60 * 60 * 1000);
  if (csrfTokens.size > 4000) {
    const now = Date.now();
    for (const [key, exp] of csrfTokens) if (exp < now) csrfTokens.delete(key);
  }
  return token;
}

function validCsrf(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const exp = csrfTokens.get(token);
  return !!exp && exp > Date.now();
}

function csrfCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return 'salif_csrf=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=14400' + secure;
}

function securityHeaders() {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
    'Cache-Control': 'no-store',
  };
  // Frame blocking and HSTS are production-only. The live preview is embedded
  // in a cross-origin iframe, so denying frames here would break the app.
  if (process.env.NODE_ENV === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=15552000; includeSubDomains';
    headers['X-Frame-Options'] = 'SAMEORIGIN';
    headers['Content-Security-Policy'] += "; frame-ancestors 'self'";
  }
  return headers;
}

module.exports = { securityHeaders, issueCsrf, validCsrf, csrfCookie };
