'use strict';
/**
 * Evidence-only valuation. This module never searches the web and never
 * invents a price, a URL, or a comparable.
 */
const { POLICY_VERSION, current } = require('./policy');

function ageDays(iso, now) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Infinity;
  return (now - t) / 86400000;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return null;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function weightedMedian(rows) {
  const sorted = rows.slice().sort((a, b) => a.price - b.price);
  const total = sorted.reduce((sum, row) => sum + row.weight, 0);
  let cursor = 0;
  for (const row of sorted) {
    cursor += row.weight;
    if (cursor >= total / 2) return row.price;
  }
  return sorted.length ? sorted[sorted.length - 1].price : null;
}

function rejectReason(row, policy, now) {
  if (!row || typeof row !== 'object') return 'MALFORMED';
  const required = ['source_name', 'source_type', 'source_url', 'product_title', 'price', 'currency', 'retrieved_at', 'market_type', 'matching_confidence', 'source_reliability'];
  if (required.some((key) => row[key] == null || row[key] === '')) return 'MISSING_EVIDENCE';
  if (!/^https:\/\//.test(String(row.source_url))) return 'UNTRUSTED_URL';
  if (String(row.currency).toUpperCase() !== policy.currency) return 'FOREIGN_CURRENCY';
  if (row.market && row.market !== policy.market) return 'FOREIGN_MARKET';
  if (['rental', 'wholesale', 'accessory_only', 'damaged'].includes(String(row.market_type))) return 'WRONG_MARKET_TYPE';
  const price = Number(row.price);
  if (!Number.isFinite(price) || price <= 0) return 'INVALID_PRICE';
  if (ageDays(row.retrieved_at, now) > policy.freshness.mediumDays) return 'STALE';
  const known = policy.sources.find((source) => source.id === row.source_name);
  if (!known) return 'UNAPPROVED_SOURCE';
  return '';
}

function dropOutliers(rows, policy) {
  if (rows.length < policy.outlier.minSample) return { kept: rows, dropped: [] };
  const mid = median(rows.map((row) => row.price));
  const kept = [];
  const dropped = [];
  rows.forEach((row) => {
    if (row.price > mid * policy.outlier.maxRatioToMedian || row.price < mid / policy.outlier.maxRatioToMedian) dropped.push(row);
    else kept.push(row);
  });
  return { kept: kept.length ? kept : rows, dropped };
}

function confidenceFor(rows, policy, now) {
  if (!rows.length) return 'UNAVAILABLE';
  const independent = new Set(rows.map((row) => row.source_name)).size;
  const trusted = rows.filter((row) => Number(row.source_reliability) >= policy.trustedReliability).length;
  const exact = rows.filter((row) => row.matching_confidence === 'EXACT').length;
  const fresh = rows.filter((row) => ageDays(row.retrieved_at, now) <= policy.freshness.highDays).length;
  const mid = median(rows.map((row) => row.price));
  const agreed = rows.every((row) => Math.abs(row.price - mid) / mid <= policy.agreement.high);
  const high = policy.confidence.high;
  if (independent >= high.independentSources && trusted >= high.trustedSources && exact >= high.exactMatches && fresh >= high.trustedSources && agreed) {
    return 'HIGH';
  }
  const medium = policy.confidence.medium;
  if (independent >= medium.independentSources && trusted >= medium.trustedSources && fresh >= 1) return 'MEDIUM';
  return 'LOW';
}

function summarize(kind, rows, policy, now) {
  if (!rows.length) {
    return { kind, status: 'UNAVAILABLE', value: null, low: null, high: null, confidence: 'UNAVAILABLE', count: 0 };
  }
  const prices = rows.map((row) => row.price);
  return {
    kind,
    status: 'EVIDENCE',
    value: weightedMedian(rows.map((row) => ({ price: row.price, weight: Number(row.source_reliability) || 0.1 }))),
    low: Math.min.apply(null, prices),
    high: Math.max.apply(null, prices),
    confidence: confidenceFor(rows, policy, now),
    count: rows.length,
  };
}

function validateDeclared(declared, replacement, policy) {
  const amount = Number(declared);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { decision: 'NOT_PROVIDED', reason_codes: ['NO_DECLARED_VALUE'] };
  }
  if (!replacement || replacement.status !== 'EVIDENCE' || replacement.value == null) {
    return { decision: 'NOT_APPROVED', reason_codes: ['NO_RELIABLE_REPLACEMENT_EVIDENCE'] };
  }
  if (amount > replacement.high * policy.absurdMultiple) {
    return { decision: 'REJECTED', reason_codes: ['UNSUPPORTED_DECLARED_VALUE'] };
  }
  const band = policy.declaredBands[replacement.confidence] || policy.declaredBands.UNAVAILABLE;
  if (band.autoDecision !== 'ACCEPTED') {
    return { decision: band.autoDecision, reason_codes: ['CONFIDENCE_' + replacement.confidence] };
  }
  const ratio = amount / replacement.value;
  if (ratio < band.minRatio || ratio > band.maxRatio) {
    return { decision: 'REJECTED', reason_codes: ['OUTSIDE_EVIDENCE_BAND'] };
  }
  return { decision: 'ACCEPTED', reason_codes: ['WITHIN_EVIDENCE_BAND'], ratio };
}

function evaluate(observations, declared, now) {
  const policy = current();
  const clock = now || Date.now();
  const excluded = [];
  const accepted = [];
  (Array.isArray(observations) ? observations : []).forEach((row) => {
    const reason = rejectReason(row, policy, clock);
    if (reason) excluded.push({ source_name: row && row.source_name || '', reason });
    else accepted.push(Object.assign({}, row, { price: Number(row.price) }));
  });
  const seen = new Set();
  const unique = [];
  accepted.forEach((row) => {
    if (seen.has(row.source_url)) excluded.push({ source_name: row.source_name, reason: 'DUPLICATE' });
    else { seen.add(row.source_url); unique.push(row); }
  });
  const split = dropOutliers(unique, policy);
  split.dropped.forEach((row) => excluded.push({ source_name: row.source_name, reason: 'OUTLIER' }));
  const freshEnough = split.kept.filter((row) => ageDays(row.retrieved_at, clock) <= policy.freshness.mediumDays);
  const used = freshEnough.filter((row) => row.condition === 'USED' || row.market_type === 'used');
  const retail = freshEnough.filter((row) => row.condition !== 'USED' && row.market_type !== 'used');
  const usedValue = summarize('USED_MARKET_VALUE', used, policy, clock);
  const retailValue = summarize('NEW_RETAIL_VALUE', retail, policy, clock);
  const replacement = retailValue.status === 'EVIDENCE' ? Object.assign({}, retailValue, { kind: 'ESTIMATED_REPLACEMENT_VALUE' }) : {
    kind: 'ESTIMATED_REPLACEMENT_VALUE', status: 'UNAVAILABLE', value: null, confidence: 'UNAVAILABLE', count: 0,
  };
  return {
    policy_version: POLICY_VERSION,
    status: replacement.status === 'EVIDENCE' || usedValue.status === 'EVIDENCE' ? 'COMPLETED' : 'VALUATION_UNAVAILABLE',
    observed_market_price: summarize('OBSERVED_MARKET_PRICE', freshEnough, policy, clock),
    used_market_value: usedValue,
    new_retail_value: retailValue,
    estimated_replacement_value: replacement,
    declared: validateDeclared(declared, replacement, policy),
    excluded,
    accepted_count: freshEnough.length,
    fabricated: false,
  };
}

function allowlisted(url) {
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === 'metadata.google.internal') return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return false;
  const allow = String(process.env.MARKET_SOURCE_ALLOWLIST || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!allow.length) return false;
  return allow.some((item) => host === item || host.endsWith('.' + item));
}

module.exports = { evaluate, allowlisted };
