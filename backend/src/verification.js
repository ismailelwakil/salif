'use strict';
/**
 * Additive identity verification. Does not replace identity_records.
 * Prototype OTP delivery is explicit and refused when NODE_ENV=production.
 * Face match and liveness stay NOT_AVAILABLE unless a real provider is configured.
 * No universal OTP is hard-coded.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const identity = require('./identity');

let remoteFetch = null;
let remoteMode = 'unknown';

function bindFetch(fn) {
  remoteFetch = fn;
  if (remoteMode !== 'unknown' || !fn) return;
  setImmediate(() => {
    fn('/rest/v1/verification_profiles?select=user_id&limit=1', { service: true }).then((r) => {
      remoteMode = r && r.status < 300 ? 'remote' : 'local';
    }).catch(() => { remoteMode = 'local'; });
  });
}

function mirrorProfile(row) {
  if (remoteMode !== 'remote' || !remoteFetch || !row) return;
  remoteFetch('/rest/v1/verification_profiles', {
    method: 'POST', service: true, prefer: 'resolution=merge-duplicates',
    body: {
      user_id: row.user_id,
      gate: !!row.gate,
      status: row.status,
      email_status: row.email_status,
      phone_status: row.phone_status,
      phone_enc: row.phone_enc || null,
      phone_hash: row.phone_hash || null,
      government_id_status: row.government_id_status,
      id_front_ref: row.id_front_ref || null,
      id_back_ref: row.id_back_ref || null,
      name_match: row.name_match,
      dob_match: row.dob_match,
      dob_enc: row.dob_enc || null,
      national_id_match: row.national_id_match,
      selfie_status: row.selfie_status,
      selfie_ref: row.selfie_ref || null,
      face_match: 'NOT_AVAILABLE',
      liveness: 'NOT_AVAILABLE',
      address_enc: row.address_enc || null,
      lat_enc: row.lat_enc || null,
      lng_enc: row.lng_enc || null,
      location_status: row.location_status,
      neighborhood: row.neighborhood || null,
      location_id: row.location_id || null,
      updated_at: row.updated_at,
    },
  }).catch(() => { remoteMode = 'local'; });
}

const DIR = path.join(__dirname, '../storage/verification');
const RECORD_FILE = path.join(DIR, 'records.json');
const OTP_FILE = path.join(DIR, 'otps.json');
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;
const MIN_IMAGE_SIDE = 640;

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'UNDER_REVIEW', 'VERIFIED', 'NEEDS_ACTION', 'REJECTED', 'SUSPENDED'];

function prototypeAllowed() {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.VERIFICATION_PROTOTYPE === 'true';
}

function mapsEnabled() {
  const key = process.env.GOOGLE_MAPS_BROWSER_KEY || '';
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
}

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeJson(file, data) {
  ensureDir();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function blank(userId) {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    gate: false,
    status: 'NOT_STARTED',
    email_status: 'NOT_STARTED',
    phone_status: 'NOT_STARTED',
    phone_enc: '',
    phone_hash: '',
    government_id_status: 'NOT_STARTED',
    id_front_ref: '',
    id_back_ref: '',
    name_match: 'NOT_STARTED',
    dob_match: 'NOT_AVAILABLE',
    dob_enc: '',
    national_id_match: 'NOT_STARTED',
    selfie_status: 'NOT_STARTED',
    selfie_ref: '',
    face_match: 'NOT_AVAILABLE',
    liveness: 'NOT_AVAILABLE',
    address_enc: '',
    lat_enc: '',
    lng_enc: '',
    location_status: 'NOT_STARTED',
    neighborhood: '',
    location_id: '',
    sends: { email: [], phone: [] },
    reviews: [],
    events: [],
    created_at: now,
    updated_at: now,
  };
}

function loadAll() {
  return readJson(RECORD_FILE);
}

function saveAll(all) {
  writeJson(RECORD_FILE, all);
}

function getRecord(userId) {
  const all = loadAll();
  return all[userId] || null;
}

function putRecord(row) {
  const all = loadAll();
  row.updated_at = new Date().toISOString();
  all[row.user_id] = row;
  saveAll(all);
  mirrorProfile(row);
  return row;
}

function event(row, name, extra) {
  row.events.push({
    event: name,
    from_status: extra && extra.from || row.status,
    to_status: extra && extra.to || row.status,
    reason: extra && extra.reason ? String(extra.reason).slice(0, 240) : '',
    actor: extra && extra.actor ? extra.actor : 'system',
    at: new Date().toISOString(),
  });
  if (row.events.length > 80) row.events = row.events.slice(-80);
}

function normalizePhone(value) {
  let d = String(value || '').replace(/[٠-٩]/g, (ch) => '٠١٢٣٤٥٦٧٨٩'.indexOf(ch)).replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (d.startsWith('01') && d.length === 11) d = '+20' + d.slice(1);
  if (d.startsWith('201') && d.length === 12) d = '+' + d;
  if (!/^\+20(10|11|12|15)\d{8}$/.test(d)) return null;
  return d;
}

function issueCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code, userId, channel) {
  return crypto.createHmac('sha256', Buffer.from(config.dataKey, 'hex')).update(channel + ':' + userId + ':' + code).digest('hex');
}

function recentSends(list) {
  const cut = Date.now() - SEND_WINDOW_MS;
  return (list || []).filter((t) => t > cut);
}

function loadOtps() {
  return readJson(OTP_FILE);
}

function saveOtps(data) {
  writeJson(OTP_FILE, data);
}

function publicStatus(row) {
  if (!row) {
    return {
      status: 'NOT_STARTED',
      gate: false,
      activity_allowed: true,
      components: {},
      checks: {},
      prototype: prototypeAllowed(),
      maps: 'salif-neighborhood-map',
      face_match: 'NOT_AVAILABLE',
      liveness: 'NOT_AVAILABLE',
    };
  }
  const allowed = activityAllowed(row);
  return {
    status: row.status,
    gate: !!row.gate,
    activity_allowed: allowed.ok,
    activity_reason: allowed.ok ? '' : allowed.reason,
    components: {
      email: row.email_status,
      phone: row.phone_status,
      government_id: row.government_id_status,
      name_match: row.name_match,
      dob_match: row.dob_match,
      national_id_match: row.national_id_match,
      selfie: row.selfie_status,
      face_match: row.face_match,
      liveness: row.liveness,
      location: row.location_status,
    },
    neighborhood: row.neighborhood || '',
    has_private_address: !!row.address_enc,
    prototype: prototypeAllowed(),
    maps: 'salif-neighborhood-map',
    face_match: 'NOT_AVAILABLE',
    liveness: 'NOT_AVAILABLE',
    review_open: (row.reviews || []).some((r) => r.status === 'OPEN'),
  };
}

function checksReady(row) {
  return !!(row
    && row.email_status === 'VERIFIED'
    && row.phone_status === 'VERIFIED'
    && row.government_id_status === 'SUBMITTED'
    && row.selfie_status === 'SUBMITTED'
    && row.location_status === 'CONFIRMED'
    && row.name_match === 'USER_CONFIRMED'
    && (row.national_id_match === 'PASS' || row.national_id_match === 'USER_CONFIRMED')
    && row.face_match !== 'FAIL'
    && row.liveness !== 'FAIL');
}

function activityAllowed(row) {
  if (process.env.VERIFICATION_GATE === 'all') {
    if (!row) return { ok: false, reason: 'incomplete' };
    if (row.status === 'REJECTED' || row.status === 'SUSPENDED') return { ok: false, reason: 'restricted' };
    if (row.status === 'VERIFIED' || checksReady(row)) return { ok: true };
    return { ok: false, reason: 'incomplete' };
  }
  if (!row || !row.gate) return { ok: true };
  if (row.status === 'REJECTED' || row.status === 'SUSPENDED') return { ok: false, reason: 'restricted' };
  if (row.status === 'VERIFIED' || checksReady(row)) return { ok: true };
  return { ok: false, reason: 'incomplete' };
}

function refreshStatus(row) {
  if (row.status === 'REJECTED' || row.status === 'SUSPENDED' || row.status === 'VERIFIED') return row;
  if ((row.reviews || []).some((r) => r.status === 'OPEN')) {
    row.status = 'UNDER_REVIEW';
    return row;
  }
  const started = row.email_status !== 'NOT_STARTED' || row.phone_status !== 'NOT_STARTED' || row.government_id_status !== 'NOT_STARTED';
  row.status = started ? 'IN_PROGRESS' : 'NOT_STARTED';
  if (row.government_id_status === 'NEEDS_ACTION' || row.selfie_status === 'NEEDS_ACTION' || row.name_match === 'MISMATCH') {
    row.status = 'NEEDS_ACTION';
  }
  return row;
}

function openForUser(userId, info) {
  const row = getRecord(userId) || blank(userId);
  row.gate = true;
  if (info && info.frontRef) {
    row.id_front_ref = info.frontRef;
    row.government_id_status = 'SUBMITTED';
  }
  if (info && info.neighborhood) row.neighborhood = info.neighborhood;
  if (info && info.locationId) row.location_id = info.locationId;
  if (info && info.phone) {
    const phone = normalizePhone(info.phone);
    if (phone) {
      row.phone_enc = identity.encryptString(phone);
      row.phone_hash = identity.keyedHash(phone);
      if (row.phone_status === 'NOT_STARTED') row.phone_status = 'PENDING';
    }
  }
  event(row, 'VERIFICATION_STARTED', { actor: 'user' });
  refreshStatus(row);
  return putRecord(row);
}

function assertOwn(userId) {
  const row = getRecord(userId);
  if (!row) {
    const created = blank(userId);
    created.gate = false;
    return putRecord(created);
  }
  return row;
}

function sendOtp(userId, channel, destination) {
  if (!prototypeAllowed()) {
    return {
      error: 'provider',
      message: channel === 'email'
        ? 'Email verification is not connected yet. A code was not sent.'
        : 'SMS verification is not connected yet. A code was not sent.',
    };
  }
  const row = assertOwn(userId);
  const sends = recentSends(row.sends[channel]);
  if (sends.length >= MAX_SENDS) {
    return { error: 'limit', message: 'Too many codes were requested. Wait a few minutes and try again.' };
  }
  const code = issueCode();
  const otps = loadOtps();
  const id = crypto.randomBytes(8).toString('hex');
  otps[userId + ':' + channel] = {
    id,
    code_hash: hashCode(code, userId, channel),
    destination_hash: identity.keyedHash(destination),
    expires: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
  saveOtps(otps);
  row.sends[channel] = sends.concat(Date.now());
  if (channel === 'email' && row.email_status !== 'VERIFIED') row.email_status = 'PENDING';
  if (channel === 'phone' && row.phone_status !== 'VERIFIED') row.phone_status = 'PENDING';
  event(row, channel === 'email' ? 'EMAIL_CODE_SENT' : 'PHONE_CODE_SENT', { actor: 'user' });
  refreshStatus(row);
  putRecord(row);
  return {
    ok: true,
    delivery: 'prototype',
    expires_in: 600,
    prototype_code: code,
  };
}

function confirmOtp(userId, channel, code, destination) {
  const row = assertOwn(userId);
  const otps = loadOtps();
  const key = userId + ':' + channel;
  const otp = otps[key];
  if (!otp || otp.expires < Date.now()) {
    return { error: 'expired', message: 'That code has expired. Request a new one.' };
  }
  otp.attempts += 1;
  if (otp.attempts > MAX_ATTEMPTS) {
    delete otps[key];
    saveOtps(otps);
    row.status = 'NEEDS_ACTION';
    event(row, 'OTP_LOCKED', { actor: 'system', reason: channel });
    putRecord(row);
    return { error: 'locked', message: 'Too many incorrect codes. Request a new one later.' };
  }
  const destHash = identity.keyedHash(destination);
  const good = otp.destination_hash === destHash && otp.code_hash === hashCode(String(code || '').trim(), userId, channel);
  if (!good) {
    otps[key] = otp;
    saveOtps(otps);
    return { error: 'mismatch', message: 'That code does not match. Check it and try again.' };
  }
  delete otps[key];
  saveOtps(otps);
  if (channel === 'email') {
    row.email_status = 'VERIFIED';
    event(row, 'EMAIL_VERIFIED', { actor: 'user' });
  } else {
    row.phone_status = 'VERIFIED';
    event(row, 'PHONE_VERIFIED', { actor: 'user' });
  }
  refreshStatus(row);
  putRecord(row);
  return { ok: true, status: publicStatus(row) };
}

function phoneTaken(hash, userId) {
  const all = loadAll();
  return Object.values(all).some((row) => row.user_id !== userId && row.phone_hash === hash && row.phone_status === 'VERIFIED');
}

function setPhone(userId, raw) {
  const phone = normalizePhone(raw);
  if (!phone) return { error: 'phone', message: 'Enter an Egyptian mobile number, like 01xxxxxxxxx.' };
  const hash = identity.keyedHash(phone);
  if (phoneTaken(hash, userId)) return { error: 'phone', message: 'That phone number cannot be used. Try another.' };
  const row = assertOwn(userId);
  row.phone_enc = identity.encryptString(phone);
  row.phone_hash = hash;
  if (row.phone_status === 'VERIFIED') row.phone_status = 'PENDING';
  putRecord(row);
  return { ok: true, phone };
}

function storedPhone(row) {
  if (!row || !row.phone_enc) return '';
  try {
    const buf = Buffer.from(row.phone_enc, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = require('crypto').createDecipheriv('aes-256-gcm', Buffer.from(config.dataKey, 'hex'), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function acceptUpload(userId, kind, buf, meta, ip) {
  const size = identity.imageSize(buf);
  if (size && Math.min(size.width, size.height) < MIN_IMAGE_SIDE) {
    return { error: 'quality', message: 'The photo is too small to read. Retake it closer, with the whole document in frame and better light.' };
  }
  const ref = identity.saveDocument(buf, ip, meta);
  if (!ref) return { error: 'file', message: 'Use a clear JPEG, PNG, or WebP photo under 2 MB.' };
  if (!identity.takeDocument(ref, ip)) {
    identity.deleteDocument(ref);
    return { error: 'file', message: 'Upload the photo again.' };
  }
  const row = assertOwn(userId);
  if (kind === 'id_back') {
    if (row.id_back_ref) identity.deleteDocument(row.id_back_ref);
    row.id_back_ref = ref;
    if (row.id_front_ref) row.government_id_status = 'SUBMITTED';
    else row.government_id_status = 'NEEDS_ACTION';
    event(row, 'ID_BACK_SUBMITTED', { actor: 'user' });
  } else if (kind === 'selfie') {
    if (row.selfie_ref) identity.deleteDocument(row.selfie_ref);
    row.selfie_ref = ref;
    row.selfie_status = 'SUBMITTED';
    row.face_match = 'NOT_AVAILABLE';
    row.liveness = 'NOT_AVAILABLE';
    event(row, 'SELFIE_SUBMITTED', { actor: 'user', reason: 'Face match and liveness are not connected.' });
  } else {
    identity.deleteDocument(ref);
    return { error: 'kind', message: 'Choose the back of the ID or the selfie.' };
  }
  refreshStatus(row);
  putRecord(row);
  return { ok: true, status: publicStatus(row), quality: size ? 'checked' : 'unchecked' };
}

function confirmIdentity(userId, body) {
  const row = assertOwn(userId);
  const nameOk = body && body.name_matches_id === true;
  if (!nameOk) {
    row.name_match = 'MISMATCH';
    row.status = 'NEEDS_ACTION';
    event(row, 'NAME_MISMATCH', { actor: 'user' });
    openReview(row, 'The name on the account was not confirmed against the ID.');
    putRecord(row);
    return { ok: true, status: publicStatus(row) };
  }
  row.name_match = 'USER_CONFIRMED';
  if (body.national_id_matches !== true) {
    row.national_id_match = 'MISMATCH';
    row.status = 'NEEDS_ACTION';
    event(row, 'NATIONAL_ID_MISMATCH', { actor: 'user' });
    openReview(row, 'The member did not confirm that the ID number matches the card.');
    putRecord(row);
    return { ok: true, status: publicStatus(row) };
  }
  row.national_id_match = 'USER_CONFIRMED';
  const dob = String(body.date_of_birth || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return { error: 'dob', message: 'Enter the date of birth as it appears on the ID.' };
  }
  const year = Number(dob.slice(0, 4));
  const nowY = new Date().getFullYear();
  if (year < 1920 || year > nowY - 16) {
    return { error: 'dob', message: 'Check the date of birth and try again.' };
  }
  row.dob_enc = identity.encryptString(dob);
  row.dob_match = 'NOT_AVAILABLE';
  if (!row.id_back_ref) {
    row.government_id_status = 'NEEDS_ACTION';
    putRecord(row);
    return { error: 'back', message: 'Upload the back of the ID before continuing.' };
  }
  event(row, 'IDENTITY_CONFIRMED_BY_USER', { actor: 'user', reason: 'No document-extraction provider is connected.' });
  refreshStatus(row);
  putRecord(row);
  return { ok: true, status: publicStatus(row) };
}

function saveAddress(userId, body, location) {
  const address = String(body.address || '').trim();
  if (address.length < 8 || address.length > 240) {
    return { error: 'address', message: 'Enter the private address you want kept off public listings.' };
  }
  if (!location) return { error: 'neighborhood', message: 'Confirm a Shibin El Kom neighborhood on the map.' };
  const row = assertOwn(userId);
  row.address_enc = identity.encryptString(address);
  row.neighborhood = location.name;
  row.location_id = location.id;
  row.location_status = 'CONFIRMED';
  if (body.lat != null && body.lng != null && Number.isFinite(Number(body.lat)) && Number.isFinite(Number(body.lng))) {
    row.lat_enc = identity.encryptString(String(Number(body.lat)));
    row.lng_enc = identity.encryptString(String(Number(body.lng)));
  }
  event(row, 'LOCATION_CONFIRMED', { actor: 'user' });
  refreshStatus(row);
  putRecord(row);
  return { ok: true, status: publicStatus(row) };
}

function openReview(row, reason) {
  row.reviews.push({
    id: crypto.randomBytes(8).toString('hex'),
    status: 'OPEN',
    reason: String(reason || '').slice(0, 240),
    reviewer: '',
    action: '',
    previous_state: row.status,
    new_state: 'UNDER_REVIEW',
    at: new Date().toISOString(),
  });
  row.status = 'UNDER_REVIEW';
  event(row, 'MANUAL_REVIEW_STARTED', { actor: 'user', reason });
}

function requestReview(userId, reason) {
  const row = assertOwn(userId);
  if ((row.reviews || []).filter((r) => r.status === 'OPEN').length >= 2) {
    return { error: 'limit', message: 'A review is already open.' };
  }
  openReview(row, reason || 'The member asked for a person to review the verification.');
  putRecord(row);
  return { ok: true, status: publicStatus(row) };
}

function reviewerDecision(userId, action, reviewer) {
  const row = getRecord(userId);
  if (!row) return null;
  const open = (row.reviews || []).filter((r) => r.status === 'OPEN').pop();
  const previous = row.status;
  if (action === 'approve') {
    row.status = 'VERIFIED';
    if (open) {
      open.status = 'APPROVED';
      open.reviewer = reviewer;
      open.action = 'approve';
      open.new_state = 'VERIFIED';
    }
    event(row, 'VERIFICATION_APPROVED', { actor: 'reviewer', from: previous, to: 'VERIFIED' });
  } else if (action === 'reject') {
    row.status = 'REJECTED';
    if (open) {
      open.status = 'REJECTED';
      open.reviewer = reviewer;
      open.action = 'reject';
      open.new_state = 'REJECTED';
    }
    event(row, 'VERIFICATION_REJECTED', { actor: 'reviewer', from: previous, to: 'REJECTED' });
  } else {
    return { error: 'action' };
  }
  putRecord(row);
  return { ok: true };
}

function badges(ids) {
  const all = loadAll();
  return ids.slice(0, 20).map((id) => {
    const row = all[id];
    return {
      id,
      phone_verified: !!(row && row.phone_status === 'VERIFIED'),
      identity_verified: !!(row && row.status === 'VERIFIED'),
    };
  });
}

function purge(userId) {
  const row = getRecord(userId);
  if (!row) return;
  if (row.id_back_ref) identity.deleteDocument(row.id_back_ref);
  if (row.selfie_ref) identity.deleteDocument(row.selfie_ref);
  const all = loadAll();
  delete all[userId];
  saveAll(all);
  const otps = loadOtps();
  delete otps[userId + ':email'];
  delete otps[userId + ':phone'];
  saveOtps(otps);
}

function checkActivity(userId) {
  return activityAllowed(getRecord(userId));
}

module.exports = {
  bindFetch,
  STATUSES,
  prototypeAllowed,
  mapsEnabled,
  publicStatus,
  activityAllowed,
  openForUser,
  getRecord,
  sendOtp,
  confirmOtp,
  setPhone,
  storedPhone,
  acceptUpload,
  confirmIdentity,
  saveAddress,
  requestReview,
  reviewerDecision,
  badges,
  purge,
  checkActivity,
  normalizePhone,
  issueCode,
};
