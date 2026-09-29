'use strict';
/**
 * Versioned rules for identity comparison, valuation, risk, and protection.
 * Change policy here. Do not copy these numbers into decision functions.
 * No underwriter and no market adapter is active in this file.
 */
const POLICY_VERSION = '2026-09-29';

const policy = {
  version: POLICY_VERSION,
  identity: {
    required: ['national_id', 'date_of_birth', 'name'],
    name: {
      minMatches: 2,
      preferMatchesWhenCardHasAtLeast: 3,
      particles: ['bin', 'ibn', 'ben', 'el', 'al', 'بن', 'ابن', 'ال'],
    },
  },
  freshness: {
    highDays: 30,
    mediumDays: 90,
  },
  agreement: {
    high: 0.25,
  },
  declaredBands: {
    HIGH: { minRatio: 0.7, maxRatio: 1.4, autoDecision: 'ACCEPTED' },
    MEDIUM: { minRatio: 0.5, maxRatio: 1.8, autoDecision: 'ACCEPTED' },
    LOW: { minRatio: 0.4, maxRatio: 2.2, autoDecision: 'MANUAL_REVIEW' },
    UNAVAILABLE: { autoDecision: 'NOT_APPROVED' },
  },
  absurdMultiple: 10,
  outlier: {
    minSample: 4,
    maxRatioToMedian: 3,
  },
  confidence: {
    high: { independentSources: 3, trustedSources: 3, exactMatches: 2 },
    medium: { independentSources: 2, trustedSources: 1 },
  },
  market: 'EG',
  currency: 'EGP',
  trustedReliability: 0.7,
  sources: [
    { id: 'manufacturer', tier: 'A', market: 'EG', reliability: 0.95, accepts: ['new'], adapter: 'unconfigured' },
    { id: 'authorized_retailer_eg', tier: 'A', market: 'EG', reliability: 0.9, accepts: ['new'], adapter: 'unconfigured' },
    { id: 'established_retailer_eg', tier: 'A', market: 'EG', reliability: 0.8, accepts: ['new', 'used'], adapter: 'unconfigured' },
    { id: 'amazon_eg', tier: 'B', market: 'EG', reliability: 0.7, accepts: ['new', 'used'], adapter: 'unconfigured' },
    { id: 'jumia_eg', tier: 'B', market: 'EG', reliability: 0.7, accepts: ['new', 'used'], adapter: 'unconfigured' },
    { id: 'noon_eg', tier: 'B', market: 'EG', reliability: 0.7, accepts: ['new', 'used'], adapter: 'unconfigured' },
    { id: 'classifieds', tier: 'C', market: 'EG', reliability: 0.3, accepts: ['used'], adapter: 'unconfigured' },
  ],
  protection: {
    underwriter: null,
    fee: {
      method: 'bps_of_coverage_per_day',
      bpsOfCoveragePerDay: 15,
      maxFeePerDay: 500,
      currency: 'EGP',
      active: false,
    },
    coverage: {
      maxShareOfApprovedReplacement: 0.75,
    },
  },
  publishGate: 'prohibited',
};

function current() {
  return policy;
}

module.exports = { POLICY_VERSION, current };
