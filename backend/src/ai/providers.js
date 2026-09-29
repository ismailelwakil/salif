'use strict';
/**
 * Provider boundary. Production never receives a fabricated identification,
 * a fabricated card reading, or a fabricated market price from this module.
 */

function production() {
  return process.env.NODE_ENV === 'production';
}

function visionProvider() {
  if (!process.env.VISION_PROVIDER) return null;
  return null;
}

function ocrProvider() {
  if (!process.env.OCR_PROVIDER) return null;
  return null;
}

function marketProvider() {
  if (!process.env.MARKET_PROVIDER) return null;
  return null;
}

function devMockAllowed() {
  return process.env.AI_DEV_MOCK === 'true' && !production();
}

function identifyItem() {
  if (devMockAllowed()) {
    return {
      processing_status: 'COMPLETED',
      provider: 'dev-mock',
      mock: true,
      brand: null,
      model: null,
      category: null,
      condition: 'UNKNOWN',
      identification_confidence: 'UNAVAILABLE',
      market_observations: [],
      reason_codes: ['DEV_MOCK_NO_EVIDENCE'],
    };
  }
  return {
    processing_status: 'FAILED',
    provider: null,
    mock: false,
    brand: null,
    model: null,
    category: null,
    condition: 'UNKNOWN',
    identification_confidence: 'UNAVAILABLE',
    market_observations: [],
    reason_codes: ['PROVIDER_NOT_CONFIGURED'],
  };
}

function extractIdentity() {
  return {
    processing_status: 'NEEDS_ACTION',
    provider: null,
    fields: null,
    reason_codes: ['OCR_NOT_CONFIGURED'],
  };
}

module.exports = {
  visionProvider,
  ocrProvider,
  marketProvider,
  identifyItem,
  extractIdentity,
  devMockAllowed,
};
