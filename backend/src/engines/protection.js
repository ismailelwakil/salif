'use strict';
/**
 * Protection is not insurance unless an underwriter is configured.
 * The fee formula is configured and stays inactive until then.
 */
const { POLICY_VERSION, current } = require('./policy');

function indicativeFee(coverage, policy) {
  const fee = policy.protection.fee;
  if (!fee.active || !policy.protection.underwriter || coverage == null) return null;
  const raw = coverage * fee.bpsOfCoveragePerDay / 10000;
  return Math.min(fee.maxFeePerDay, Math.round(raw));
}

function decide(risk, valuation) {
  const policy = current();
  const level = risk && risk.level || 'UNKNOWN';
  const approved = valuation && valuation.declared && valuation.declared.decision === 'ACCEPTED';
  const replacement = approved ? Number(valuation.declared && valuation.estimated) : null;
  const coverage = approved && valuation.estimated_replacement_value && valuation.estimated_replacement_value.value != null
    ? Math.round(valuation.estimated_replacement_value.value * policy.protection.coverage.maxShareOfApprovedReplacement)
    : null;
  const bound = false;
  let requirement = 'NOT_ELIGIBLE';
  const reasons = ['NO_UNDERWRITER'];
  if (level === 'PROHIBITED') requirement = 'NOT_ELIGIBLE';
  else if (level === 'UNKNOWN') requirement = 'MANUAL_REVIEW';
  else if (level === 'HIGH') requirement = 'REQUIRED';
  else if (level === 'MEDIUM') requirement = 'OPTIONAL';
  else requirement = 'NOT_REQUIRED';
  if (!policy.protection.underwriter) {
    return {
      policy_version: POLICY_VERSION,
      requirement,
      bound,
      provider: null,
      coverage_limit: null,
      protection_fee: null,
      indicative_fee: null,
      replacement_value: null,
      reason_codes: reasons.concat(level === 'PROHIBITED' ? ['PROHIBITED'] : []),
      rental_price_included: false,
    };
  }
  return {
    policy_version: POLICY_VERSION,
    requirement,
    bound: requirement === 'NOT_REQUIRED' || (approved && requirement !== 'NOT_ELIGIBLE'),
    provider: policy.protection.underwriter,
    coverage_limit: coverage,
    protection_fee: indicativeFee(coverage, policy),
    replacement_value: replacement,
    reason_codes: ['UNDERWRITER_CONFIGURED'],
    rental_price_included: false,
  };
}

module.exports = { decide };
