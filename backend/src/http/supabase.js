'use strict';
const https = require('https');
const config = require('../config');

function supaFetch(pathname, { method = 'GET', body, token, service = false, prefer } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(config.supabaseUrl + pathname);
    const req = https.request({
      method, hostname: url.hostname, path: url.pathname + url.search, family: 4,
      headers: {
        apikey: config.serviceKey,
        Authorization: 'Bearer ' + (service || !token ? config.serviceKey : token),
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(prefer ? { Prefer: prefer } : {}),
      },
    }, (r) => {
      let out = '';
      r.on('data', (chunk) => { out += chunk; });
      r.on('end', () => {
        let parsed = null;
        try { parsed = out ? JSON.parse(out) : null; } catch { parsed = out; }
        resolve({ status: r.statusCode, body: parsed, headers: r.headers });
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('upstream_timeout')));
    if (data) req.write(data);
    req.end();
  });
}

module.exports = { supaFetch };
