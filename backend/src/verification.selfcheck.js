'use strict';
/**
 * Local checks for the additive verification layer.
 * Does not call Supabase and does not print codes or identity values.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const verification = require('./verification');
const identity = require('./identity');

const uid = '11111111-1111-4111-8111-111111111111';

function jpeg(width, height) {
  const buf = Buffer.alloc(32, 0);
  buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff; buf[3] = 0xc0;
  buf.writeUInt16BE(11, 4);
  buf[6] = 8;
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  return buf;
}

function main() {
  assert.strictEqual(verification.normalizePhone('01012345678'), '+201012345678');
  assert.strictEqual(verification.normalizePhone('not-a-phone'), null);
  assert.strictEqual(verification.activityAllowed(null).ok, true);
  assert.strictEqual(verification.checkActivity('00000000-0000-4000-8000-000000000000').ok, true);

  const previous = process.env.VERIFICATION_PROTOTYPE;
  process.env.VERIFICATION_PROTOTYPE = 'true';
  const sent = verification.sendOtp(uid, 'email', 'person@example.com');
  assert.strictEqual(sent.ok, true);
  assert.strictEqual(sent.delivery, 'prototype');
  assert.notStrictEqual(sent.prototype_code, '123456');
  const store = fs.readFileSync(path.join(__dirname, '../storage/verification/otps.json'), 'utf8');
  assert.strictEqual(store.includes(sent.prototype_code), false);
  const bad = verification.confirmOtp(uid, 'email', '000000', 'person@example.com');
  assert.strictEqual(bad.ok, undefined);
  const good = verification.confirmOtp(uid, 'email', sent.prototype_code, 'person@example.com');
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.status.components.email, 'VERIFIED');
  assert.strictEqual(good.status.components.face_match, 'NOT_AVAILABLE');
  process.env.VERIFICATION_PROTOTYPE = previous;

  const tiny = verification.acceptUpload(uid, 'id_back', jpeg(320, 240), {
    contentType: 'image/jpeg', ext: 'jpg',
  }, '127.0.0.1');
  assert.strictEqual(tiny.error, 'quality');

  const sized = identity.imageSize(jpeg(800, 640));
  assert.strictEqual(sized.width, 800);
  assert.strictEqual(sized.height, 640);

  const row = verification.getRecord(uid);
  assert.strictEqual(row.gate, false);
  assert.strictEqual(verification.publicStatus(row).activity_allowed, true);
  const pub = JSON.stringify(verification.publicStatus(row));
  assert.strictEqual(/\\d{14}/.test(pub), false);
  assert.strictEqual(pub.includes('prototype_code'), false);
  assert.strictEqual(pub.includes('person@example.com'), false);
  verification.purge(uid);

  const child = spawnSync(process.execPath, ['-e', `
    process.env.NODE_ENV = 'production';
    process.env.VERIFICATION_PROTOTYPE = 'true';
    const v = require('./verification');
    const r = v.sendOtp('22222222-2222-4222-8222-222222222222', 'phone', '+201012345678');
    if (r.ok || r.prototype_code || r.error !== 'provider') process.exit(1);
  `], { cwd: __dirname, encoding: 'utf8' });
  assert.strictEqual(child.status, 0, child.stderr);

  console.log('verification selfcheck passed');
}

main();
