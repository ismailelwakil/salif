'use strict';
const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '../.env'));

function required(name) {
  const value = process.env[name];
  if (!value || /^(YOUR_|changeme|placeholder)/i.test(value)) {
    throw new Error('Missing ' + name + '. Copy backend/.env.example to backend/.env and fill it locally. Never commit that file.');
  }
  return value;
}

const supabaseUrl = required('SUPABASE_URL').replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  throw new Error('SUPABASE_URL must be an https Supabase project URL.');
}

const serviceKey = required('SUPABASE_SECRET_KEY');
if (serviceKey.length < 20) throw new Error('SUPABASE_SECRET_KEY looks invalid.');

const dataKey = required('DATA_ENCRYPTION_KEY');
if (!/^[0-9a-f]{64}$/i.test(dataKey)) throw new Error('DATA_ENCRYPTION_KEY must be 64 hex characters.');

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid.');

module.exports = {
  port,
  host: '0.0.0.0',
  supabaseUrl,
  serviceKey,
  dataKey,
  sentryDsn: process.env.SENTRY_DSN || '',
  allowDemo: process.env.ALLOW_DEMO === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
  policyVersion: '2026-09-28',
  frontendDir: path.resolve(__dirname, '../../frontend'),
};
