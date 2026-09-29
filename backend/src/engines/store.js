'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '../../storage/protection');
const FILE = path.join(DIR, 'records.json');

function empty() {
  return { assessments: {}, snapshots: {}, claims: {}, events: [] };
}

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return empty(); }
}

function write(data) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

function id() {
  return crypto.randomBytes(16).toString('hex');
}

function addEvent(data, name, subject) {
  data.events.push({ id: id(), event: name, subject: String(subject || '').slice(0, 80), at: new Date().toISOString() });
  if (data.events.length > 200) data.events = data.events.slice(-200);
}

function saveAssessment(listingId, assessment) {
  const data = read();
  data.assessments[listingId] = Object.assign({ id: id(), listing_id: listingId, updated_at: new Date().toISOString() }, assessment);
  addEvent(data, 'RISK_ASSESSMENT_COMPLETED', listingId);
  if (assessment.valuation && assessment.valuation.status === 'VALUATION_UNAVAILABLE') addEvent(data, 'VALUATION_UNAVAILABLE', listingId);
  else addEvent(data, 'VALUATION_COMPLETED', listingId);
  write(data);
  return data.assessments[listingId];
}

function getAssessment(listingId) {
  return read().assessments[listingId] || null;
}

function saveSnapshot(snapshot) {
  const data = read();
  data.snapshots[snapshot.booking_id] = snapshot;
  addEvent(data, 'BOOKING_PROTECTION_SNAPSHOT_CREATED', snapshot.booking_id);
  write(data);
  return snapshot;
}

function getSnapshot(bookingId) {
  return read().snapshots[bookingId] || null;
}

function saveClaim(claim) {
  const data = read();
  data.claims[claim.id] = claim;
  addEvent(data, 'CLAIM_CREATED', claim.id);
  write(data);
  return claim;
}

function claimsFor(userId) {
  return Object.values(read().claims).filter((claim) => claim.owner_id === userId || claim.requester_id === userId);
}

function reviewClaim(claimId, action) {
  const data = read();
  const claim = data.claims[claimId];
  if (!claim) return null;
  claim.status = action === 'close' ? 'CLOSED' : 'UNDER_REVIEW';
  claim.updated_at = new Date().toISOString();
  addEvent(data, 'CLAIM_REVIEWED', claimId);
  write(data);
  return { id: claim.id, status: claim.status };
}

module.exports = {
  id, saveAssessment, getAssessment, saveSnapshot, getSnapshot, saveClaim, claimsFor, reviewClaim,
};
