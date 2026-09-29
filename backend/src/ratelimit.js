'use strict';
const crypto = require('crypto');
const config = require('./config');

const buckets = new Map();
const failures = new Map();

const RULES = {
  'POST /api/auth/login': { limit: 10, windowMs: 15 * 60 * 1000 },
  'POST /api/auth/register': { limit: 5, windowMs: 60 * 60 * 1000 },
  'POST /api/auth/forgot': { limit: 3, windowMs: 60 * 60 * 1000 },
  'POST /api/auth/reset': { limit: 3, windowMs: 60 * 60 * 1000 },
  'POST /api/auth/verify-email': { limit: 5, windowMs: 10 * 60 * 1000 },
  'POST /api/auth/otp': { limit: 5, windowMs: 10 * 60 * 1000 },
  'POST /api/auth/id-document': { limit: 6, windowMs: 60 * 60 * 1000 },
  'POST /api/verification/email/send': { limit: 5, windowMs: 10 * 60 * 1000 },
  'POST /api/verification/email/confirm': { limit: 8, windowMs: 10 * 60 * 1000 },
  'POST /api/verification/phone/send': { limit: 5, windowMs: 10 * 60 * 1000 },
  'POST /api/verification/phone/confirm': { limit: 8, windowMs: 10 * 60 * 1000 },
  'POST /api/verification/upload': { limit: 6, windowMs: 60 * 60 * 1000 },
  'POST /api/verification/identity': { limit: 8, windowMs: 60 * 60 * 1000 },
  'POST /api/verification/address': { limit: 10, windowMs: 60 * 60 * 1000 },
  'POST /api/verification/review': { limit: 5, windowMs: 60 * 60 * 1000 },
  'GET /api/verification': { limit: 60, windowMs: 60 * 1000 },
  'POST /api/auth/demo': { limit: 30, windowMs: 60 * 1000 },
  'POST /api/auth/refresh': { limit: 30, windowMs: 60 * 1000 },
  'POST /api/auth/logout': { limit: 30, windowMs: 60 * 1000 },
  'GET /api/search': { limit: 60, windowMs: 60 * 1000 },
  'GET /api/bootstrap': { limit: 60, windowMs: 60 * 1000 },
  'GET /api/available': { limit: 40, windowMs: 60 * 1000 },
  'GET /api/locations': { limit: 40, windowMs: 60 * 1000 },
  'POST /api/bookings': { limit: 20, windowMs: 60 * 1000 },
  'POST /api/listings': { limit: 15, windowMs: 60 * 1000 },
  'POST /api/claims': { limit: 8, windowMs: 60 * 60 * 1000 },
  'GET /api/protection/health': { limit: 60, windowMs: 60 * 1000 },
  'POST /api/reviews': { limit: 10, windowMs: 60 * 1000 },
  'POST /api/favorites': { limit: 40, windowMs: 60 * 1000 },
  'POST /api/telemetry': { limit: 20, windowMs: 60 * 1000 },
  'DELETE /api/me': { limit: 5, windowMs: 60 * 1000 },
  'GET /api/users': { limit: 10, windowMs: 60 * 1000 },
};

function clientIp(req) {
  const socketIp = (req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'local').replace(/^::ffff:/, '');
  if (!config.trustProxy) return socketIp;
  const fwd = req.headers['x-forwarded-for'];
  if (!fwd || typeof fwd !== 'string') return socketIp;
  const first = fwd.split(',')[0].trim();
  return /^[0-9a-fA-F:.]+$/.test(first) ? first : socketIp;
}

function take(key, limit, windowMs) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) bucket = { start: now, count: 0 };
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 8000) buckets.clear();
  const retryAfter = Math.max(1, Math.ceil((bucket.start + windowMs - now) / 1000));
  return { ok: bucket.count <= limit, retryAfter };
}

function gate(req, url) {
  const ip = clientIp(req);
  const rule = RULES[req.method + ' ' + url.pathname] || (
    url.pathname.startsWith('/api/') ? { limit: 120, windowMs: 60 * 1000 } : { limit: 400, windowMs: 60 * 1000 }
  );
  const hit = take('ip:' + req.method + ':' + url.pathname + ':' + ip, rule.limit, rule.windowMs);
  if (!hit.ok) return { ok: false, retryAfter: hit.retryAfter, ip };
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ') && auth.length > 20) {
    const id = crypto.createHash('sha256').update(auth.slice(7, 80)).digest('hex').slice(0, 20);
    const userHit = take('user:' + req.method + ':' + url.pathname + ':' + id, rule.limit, rule.windowMs);
    if (!userHit.ok) return { ok: false, retryAfter: userHit.retryAfter, ip };
  }
  return { ok: true, retryAfter: hit.retryAfter, ip };
}

function accountKey(email) {
  return crypto.createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');
}

function loginAllowed(ip, email) {
  const now = Date.now();
  const keys = ['fail:ip:' + ip, 'fail:acct:' + accountKey(email)];
  for (const key of keys) {
    const row = failures.get(key);
    if (row && row.lockedUntil > now) {
      return { ok: false, retryAfter: Math.ceil((row.lockedUntil - now) / 1000) };
    }
  }
  const burst = take('login-acct:' + accountKey(email), 8, 15 * 60 * 1000);
  return burst.ok ? { ok: true } : { ok: false, retryAfter: burst.retryAfter };
}

function recordLoginFailure(ip, email) {
  const until = Date.now() + 15 * 60 * 1000;
  for (const key of ['fail:ip:' + ip, 'fail:acct:' + accountKey(email)]) {
    const row = failures.get(key) || { count: 0, lockedUntil: 0 };
    row.count += 1;
    if (row.count >= 5) row.lockedUntil = until;
    failures.set(key, row);
  }
}

function clearLoginFailures(ip, email) {
  failures.delete('fail:ip:' + ip);
  failures.delete('fail:acct:' + accountKey(email));
}

module.exports = { clientIp, gate, loginAllowed, recordLoginFailure, clearLoginFailures };
