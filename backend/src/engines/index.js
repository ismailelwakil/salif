'use strict';
const policy = require('./policy');
const identityMatch = require('./identityMatch');
const risk = require('./risk');
const valuation = require('./valuation');
const protection = require('./protection');
const store = require('./store');
const ai = require('../ai/orchestrator');
const providers = require('../ai/providers');

function textOf(input) {
  return [input.title, input.title_ar, input.description, input.description_ar, input.category].filter(Boolean).join('\n');
}

function assess(input) {
  const analysis = ai.analyzeItem({
    title: textOf(input),
    description: '',
    category: input.category,
    declared_replacement_value: input.declared_replacement_value,
    owner_risk_level: input.owner_risk_level || input.risk_level,
  });
  const riskResult = risk.classify({
    title: textOf(input),
    description: '',
    category: input.category,
    identification_confidence: analysis.item_identification.identification_confidence,
    owner_risk_level: input.owner_risk_level || input.risk_level,
  });
  const protectionResult = protection.decide(riskResult, analysis.valuation);
  const gate = process.env.SALIF_PUBLISH_GATE || policy.current().publishGate;
  const blocked = riskResult.level === 'PROHIBITED' || (gate === 'risk' && riskResult.level === 'UNKNOWN');
  return {
    policy_version: policy.POLICY_VERSION,
    processing_status: analysis.processing_status,
    identification: analysis.item_identification,
    valuation: analysis.valuation,
    risk: { level: riskResult.level, factors: riskResult.factors, reason_codes: riskResult.reason_codes },
    protection: protectionResult,
    blocked,
    block_code: riskResult.level === 'PROHIBITED' ? 'ITEM_NOT_ALLOWED' : (blocked ? 'MANUAL_REVIEW' : ''),
    reason_codes: analysis.reason_codes,
    mock: analysis.mock,
  };
}

function publicView() {
  return {
    protection_bound: false,
    requirement: 'NOT_ELIGIBLE',
    protection_fee: null,
    coverage_limit: null,
    provider: null,
    reason_codes: ['NO_UNDERWRITER'],
  };
}

function ownerView(assessment) {
  if (!assessment) return publicView(null);
  return {
    processing_status: assessment.processing_status,
    identification_confidence: assessment.identification.identification_confidence,
    condition: assessment.identification.condition,
    valuation_status: assessment.valuation.status,
    declared_decision: assessment.valuation.declared.decision,
    risk_level: assessment.risk.level,
    protection_bound: false,
    requirement: assessment.protection.requirement,
    protection_fee: null,
    coverage_limit: null,
    reason_codes: assessment.reason_codes.concat(assessment.protection.reason_codes),
  };
}

function snapshotFor(booking, listing) {
  const assessment = store.getAssessment(listing.id) || assess(listing);
  return store.saveSnapshot({
    id: store.id(),
    booking_id: booking.id,
    listing_id: listing.id,
    policy_version: policy.POLICY_VERSION,
    rental_price_per_day: listing.price_per_day,
    protection_bound: false,
    protection_fee: null,
    coverage_limit: null,
    replacement_value_reference: null,
    reason_codes: ['NO_UNDERWRITER'],
    created_at: new Date().toISOString(),
  });
}

module.exports = {
  policy: policy.current,
  identityMatch,
  assess,
  publicView,
  ownerView,
  snapshotFor,
  store,
  providers,
  valuation,
  risk,
};
