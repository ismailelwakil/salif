'use strict';
const https = require('https');
const crypto = require('crypto');
const { sentryDsn } = require('../config');

function parseDsn(dsn) {
  const u = new URL(dsn);
  return {
    host: u.host,
    key: decodeURIComponent(u.username),
    storePath: '/api/' + u.pathname.replace(/^\//, '') + '/store/',
  };
}

function scrub(value) {
  const text = String(value || '');
  return text
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .slice(0, 500);
}

function capture(message, extra) {
  if (!sentryDsn) return;
  let parsed;
  try { parsed = parseDsn(sentryDsn); } catch { return; }
  const safeExtra = {};
  Object.keys(extra || {}).forEach((k) => { safeExtra[k] = scrub(extra[k]); });
  const event = {
    event_id: crypto.randomBytes(16).toString('hex'),
    timestamp: new Date().toISOString(),
    platform: 'node',
    level: 'error',
    logger: 'salif-backend',
    message: scrub(message),
    extra: safeExtra,
    tags: { app: 'salif' },
  };
  const data = JSON.stringify(event);
  const req = https.request({
    method: 'POST',
    hostname: parsed.host,
    path: parsed.storePath,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'X-Sentry-Auth': 'Sentry sentry_version=7, sentry_client=salif-backend/1.0, sentry_key=' + parsed.key,
    },
  }, (r) => { r.resume(); });
  req.on('error', () => {});
  req.setTimeout(4000, () => req.destroy());
  req.write(data);
  req.end();
}

module.exports = { capture };
