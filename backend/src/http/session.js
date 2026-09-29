'use strict';
const https = require('https');
const { supaFetch } = require('./supabase');

const tokenCache = new Map();
const revokedTokens = new Set();

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function getUserFromToken(token) {
  if (!token || revokedTokens.has(token)) return null;
  const hit = tokenCache.get(token);
  if (hit && hit.exp * 1000 > Date.now() + 30000) return hit.user;
  const r = await supaFetch('/auth/v1/user', { token });
  if (r.status !== 200 || !r.body || !r.body.id) return null;
  let exp = 0;
  try { exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp || 0; } catch { /* ignore */ }
  tokenCache.set(token, { user: r.body, exp });
  if (tokenCache.size > 500) tokenCache.clear();
  return r.body;
}

async function getProfile(userId) {
  const r = await supaFetch('/rest/v1/profiles?id=eq.' + encodeURIComponent(userId) + '&limit=1', { service: true });
  return Array.isArray(r.body) ? r.body[0] || null : null;
}

async function mintSession(email) {
  const gl = await supaFetch('/auth/v1/admin/generate_link', {
    method: 'POST', service: true, body: { type: 'magiclink', email },
  });
  if (gl.status >= 300 || !gl.body || !gl.body.action_link) throw new Error('generate_link_failed');
  const link = gl.body.action_link;
  const loc = await new Promise((resolve, reject) => {
    const url = new URL(link);
    const req = https.request({ method: 'GET', hostname: url.hostname, path: url.pathname + url.search }, (r) => {
      r.resume();
      resolve(r.headers.location || '');
    });
    req.on('error', reject);
    req.end();
  });
  const frag = loc.includes('#') ? loc.slice(loc.indexOf('#') + 1) : '';
  const params = new URLSearchParams(frag);
  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (!access) throw new Error('no_token_in_redirect');
  const user = gl.body;
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: Number(params.get('expires_in') || 3600),
    user: { id: user.id, email: user.email, full_name: (user.user_metadata || {}).full_name || '' },
  };
}

function revokeToken(token) {
  if (!token) return;
  tokenCache.delete(token);
  revokedTokens.add(token);
  if (revokedTokens.size > 5000) revokedTokens.clear();
}

module.exports = { bearer, getUserFromToken, getProfile, mintSession, revokeToken };
