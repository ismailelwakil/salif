'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const STORE = path.join(__dirname, '../storage/identity');
const MAX_BYTES = 2 * 1024 * 1024;
const uploads = new Map();

function key() {
  return Buffer.from(config.dataKey, 'hex');
}

function encryptString(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function encryptBytes(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

function keyedHash(plain) {
  return crypto.createHmac('sha256', key()).update(String(plain)).digest('hex');
}

function normalizeNationalId(value) {
  const digits = String(value || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  if (!/^\d{14}$/.test(digits) || /^0+$/.test(digits)) return null;
  return digits;
}

function strongPassword(password, email) {
  const p = String(password || '');
  if (p.length < 10 || p.length > 72) return false;
  if (!/[A-Za-z\u0600-\u06FF]/.test(p) || !/\d/.test(p)) return false;
  if (email && p.toLowerCase() === String(email).toLowerCase()) return false;
  return true;
}

function imageSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return null;
}

function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12 || buf.length > MAX_BYTES) return null;
  const head = buf.slice(0, 64).toString('latin1').toLowerCase();
  if (head.includes('<script') || head.includes('<svg') || head.includes('<html') || head.includes('%pdf') || head.includes('<?xml')) {
    return null;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

const ALLOWED = {
  jpg: ['image/jpeg', 'image/jpg'],
  png: ['image/png'],
  webp: ['image/webp'],
};

function declaredKind(contentType, ext) {
  const clean = String(ext || '').toLowerCase().replace(/^\./, '');
  if (!clean || clean.length > 5 || /[^a-z0-9]/.test(clean)) return null;
  const kind = clean === 'jpeg' ? 'jpg' : clean;
  const mime = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (!ALLOWED[kind] || !ALLOWED[kind].includes(mime)) return null;
  return kind;
}

function saveDocument(buf, ip, meta) {
  const declared = declaredKind(meta && meta.contentType, meta && meta.ext);
  const sniffed = sniffImage(buf);
  if (!declared || sniffed !== declared) return null;
  fs.mkdirSync(STORE, { recursive: true, mode: 0o700 });
  const ref = crypto.randomBytes(16).toString('hex');
  const dest = path.join(STORE, ref + '.bin');
  if (!dest.startsWith(STORE + path.sep)) return null;
  fs.writeFileSync(dest, encryptBytes(buf), { mode: 0o600 });
  uploads.set(ref, { expires: Date.now() + 20 * 60 * 1000, ip, consumed: false });
  return ref;
}

function takeDocument(ref, ip) {
  const row = uploads.get(ref);
  if (!row || row.consumed || row.expires < Date.now()) return false;
  if (row.ip !== ip) return false;
  const dest = path.join(STORE, ref + '.bin');
  if (!dest.startsWith(STORE + path.sep) || !fs.existsSync(dest)) return false;
  row.consumed = true;
  return true;
}

function deleteDocument(ref) {
  const dest = path.join(STORE, String(ref || '') + '.bin');
  if (!dest.startsWith(STORE + path.sep)) return;
  fs.rmSync(dest, { force: true });
  uploads.delete(ref);
}

module.exports = {
  MAX_BYTES,
  encryptString,
  keyedHash,
  normalizeNationalId,
  strongPassword,
  sniffImage,
  imageSize,
  saveDocument,
  takeDocument,
  deleteDocument,
};
