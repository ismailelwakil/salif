'use strict';
/**
 * AI may describe evidence. It does not set risk, eligibility, or coverage.
 * External page text is never accepted as an instruction.
 */
const providers = require('./providers');
const valuation = require('../engines/valuation');
const risk = require('../engines/risk');

function analyzeItem(input) {
  const identification = providers.identifyItem();
  const observations = identification.market_observations || [];
  const priced = valuation.evaluate(observations, input && input.declared_replacement_value);
  const riskResult = risk.classify({
    title: input && input.title,
    description: input && input.description,
    category: input && input.category,
    identification_confidence: identification.identification_confidence,
    signals: [],
    owner_risk_level: input && input.owner_risk_level,
  });
  return {
    processing_status: identification.processing_status,
    item_identification: {
      brand: identification.brand,
      model: identification.model,
      category: identification.category,
      condition: identification.condition,
      identification_confidence: identification.identification_confidence,
    },
    market_observations: observations,
    valuation: priced,
    risk_signals: riskResult.reason_codes,
    evidence: { source_count: priced.accepted_count, trusted_source_count: 0 },
    reason_codes: identification.reason_codes.concat(priced.status === 'VALUATION_UNAVAILABLE' ? ['VALUATION_UNAVAILABLE'] : []),
    mock: !!identification.mock,
  };
}

module.exports = { analyzeItem };
