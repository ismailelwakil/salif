'use strict';
/**
 * Deterministic identity comparison. This module does not read a card and
 * does not change a value the member typed. A missing extraction is not a match.
 */
const { POLICY_VERSION, current } = require('./policy');

const ALIASES = {
  محمد: ['mohamed', 'mohammed', 'muhammad', 'mohammad'],
  احمد: ['ahmed', 'ahmad'],
  محمود: ['mahmoud', 'mahmud'],
  علي: ['ali'],
  حسن: ['hassan', 'hasan'],
  حسين: ['hussein', 'hussain'],
  ابراهيم: ['ibrahim'],
  يوسف: ['youssef', 'yousef', 'yusuf'],
  عمر: ['omar'],
  خالد: ['khaled', 'khalid'],
  فاطمه: ['fatma', 'fatima'],
  مريم: ['mariam', 'maryam'],
  نور: ['nour', 'noor'],
  ساره: ['sara', 'sarah'],
  عبدالله: ['abdullah', 'abdallah'],
  عبدالرحمن: ['abdelrahman', 'abdulrahman'],
  منوفيه: ['monufia', 'menoufia', 'minufiyah'],
  شبين: ['shibin', 'shebin', 'shbeen'],
  كوم: ['kom', 'koum'],
  القاهره: ['cairo'],
  الجيزه: ['giza'],
  اسكندريه: ['alexandria', 'iskandaria'],
  طنطا: ['tanta'],
};

function fold(value) {
  return String(value || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function digits(value) {
  return String(value || '').replace(/[٠-٩]/g, (ch) => '٠١٢٣٤٥٦٧٨٩'.indexOf(ch)).replace(/\D/g, '');
}

function tokens(value) {
  const particles = new Set(current().identity.name.particles.map(fold));
  return fold(value).split(' ').filter((token) => token && token.length >= 2 && !particles.has(token) && !/^ال/.test(token));
}

function aliasSet(token) {
  const set = new Set([token]);
  Object.keys(ALIASES).forEach((ar) => {
    const group = [ar].concat(ALIASES[ar]);
    if (group.includes(token)) group.forEach((item) => set.add(item));
  });
  return set;
}

function tokensMatch(a, b) {
  const left = aliasSet(a);
  const right = aliasSet(b);
  for (const token of left) if (right.has(token)) return true;
  return false;
}

function compareNationalId(entered, extracted) {
  if (!extracted) return 'NOT_AVAILABLE';
  const a = digits(entered);
  const b = digits(extracted);
  if (!/^\d{14}$/.test(a) || !/^\d{14}$/.test(b)) return 'MISMATCH';
  return a === b ? 'MATCH' : 'MISMATCH';
}

function compareDob(entered, extracted) {
  if (!extracted) return 'NOT_AVAILABLE';
  const a = String(entered || '').slice(0, 10);
  const b = String(extracted || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return 'MISMATCH';
  return a === b ? 'MATCH' : 'MISMATCH';
}

function compareName(entered, extracted) {
  if (!extracted) return 'NOT_AVAILABLE';
  const left = tokens(entered);
  const right = tokens(extracted);
  if (left.length < 2 || right.length < 2) return 'INSUFFICIENT';
  const used = new Set();
  let matches = 0;
  left.forEach((token) => {
    const hit = right.findIndex((other, index) => !used.has(index) && tokensMatch(token, other));
    if (hit >= 0) { used.add(hit); matches += 1; }
  });
  const familyOk = tokensMatch(left[left.length - 1], right[right.length - 1]);
  if (!familyOk) return 'MISMATCH';
  const prefer = current().identity.name.preferMatchesWhenCardHasAtLeast;
  const needed = right.length >= prefer && left.length >= prefer ? prefer : current().identity.name.minMatches;
  if (matches < needed) return 'INSUFFICIENT';
  return 'MATCH';
}

const PLACES = [
  ['monufia', ['منوفيه', 'monufia', 'menoufia']],
  ['cairo', ['القاهره', 'cairo']],
  ['giza', ['الجيزه', 'giza']],
  ['alexandria', ['اسكندريه', 'alexandria']],
  ['tanta', ['طنطا', 'tanta']],
  ['shibin', ['شبين الكوم', 'shibin el kom', 'shebin el kom', 'shibin']],
];

function placeHits(value) {
  const text = fold(value);
  const hits = new Set();
  PLACES.forEach(([id, forms]) => {
    if (forms.some((form) => text.includes(fold(form)))) hits.add(id);
  });
  return hits;
}

function compareAddress(entered, extracted) {
  if (!extracted) return 'NOT_AVAILABLE';
  const left = fold(entered);
  const right = fold(extracted);
  if (left.length < 4 || right.length < 4) return 'REVIEW';
  const leftPlaces = placeHits(entered);
  const rightPlaces = placeHits(extracted);
  const sharedPlace = [...leftPlaces].some((id) => rightPlaces.has(id));
  const conflicting = leftPlaces.size && rightPlaces.size && !sharedPlace;
  if (conflicting) return 'MISMATCH';
  const leftNums = new Set(left.match(/\d+/g) || []);
  const rightNums = new Set(right.match(/\d+/g) || []);
  if (leftNums.size && rightNums.size) {
    const sameNumber = [...leftNums].some((n) => rightNums.has(n));
    if (!sameNumber) return 'MISMATCH';
  }
  if (sharedPlace) return 'MATCH';
  const leftTokens = new Set(tokens(entered));
  const rightTokens = new Set(tokens(extracted));
  let overlap = 0;
  leftTokens.forEach((token) => {
    if ([...rightTokens].some((other) => tokensMatch(token, other))) overlap += 1;
  });
  const base = Math.max(leftTokens.size, rightTokens.size, 1);
  if (sharedPlace && overlap / base >= 0.34) return 'MATCH';
  if (overlap / base >= 0.6) return 'MATCH';
  return 'REVIEW';
}

function compare(entered, extracted) {
  const fields = {
    national_id: compareNationalId(entered && entered.national_id, extracted && extracted.national_id),
    date_of_birth: compareDob(entered && entered.date_of_birth, extracted && extracted.date_of_birth),
    name: compareName(entered && entered.name, extracted && extracted.name),
    address: compareAddress(entered && entered.address, extracted && extracted.address),
  };
  const reasons = [];
  Object.keys(fields).forEach((key) => {
    if (fields[key] !== 'MATCH') reasons.push(key + '_' + fields[key]);
  });
  const required = current().identity.required;
  const mismatch = required.some((key) => fields[key] === 'MISMATCH' || fields[key] === 'INSUFFICIENT');
  const missing = required.some((key) => fields[key] === 'NOT_AVAILABLE') || fields.address === 'REVIEW';
  let registration = 'ALLOWED';
  if (mismatch || fields.address === 'MISMATCH') registration = 'BLOCKED';
  else if (missing || fields.address === 'NOT_AVAILABLE') registration = 'NEEDS_ACTION';
  return {
    policy_version: POLICY_VERSION,
    fields,
    registration,
    blocked: registration === 'BLOCKED',
    passed: registration === 'ALLOWED',
    reason_codes: reasons,
  };
}

module.exports = { compare, fold, tokens };
