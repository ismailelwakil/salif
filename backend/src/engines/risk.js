'use strict';
/**
 * Deterministic risk classification. Owner-supplied risk is ignored.
 * Missing identification is UNKNOWN, never LOW.
 */
const { POLICY_VERSION } = require('./policy');

const PROHIBITED = [
  { code: 'WEAPON', re: /\b(firearm|gun|pistol|revolver|rifle|shotgun|ammunition|ammo)\b|سلاح ناري|مسدس|بندقية|بندقيه|ذخيرة|ذخيره/i },
  { code: 'EXPLOSIVE', re: /\b(explosive|grenade|dynamite|bomb|tnt)\b|متفجر|قنبلة|قنبله/i },
  { code: 'ILLEGAL_SUBSTANCE', re: /\b(cocaine|heroin|methamphetamine)\b|مخدر|هيروين|كوكايين/i },
];

function screenText(text) {
  const value = String(text || '');
  const hit = PROHIBITED.find((rule) => rule.re.test(value));
  return hit ? hit.code : '';
}

function classify(input) {
  const text = [input && input.title, input && input.description, input && input.category].filter(Boolean).join('\n');
  const prohibited = screenText(text) || ((input && input.signals || []).includes('PROHIBITED') ? 'POLICY_SIGNAL' : '');
  const identification = (input && input.identification_confidence) || 'UNAVAILABLE';
  const factors = {
    LEGAL: prohibited ? 'HIGH' : 'UNKNOWN',
    INJURY: 'UNKNOWN',
    MISUSE: 'UNKNOWN',
    PROPERTY_DAMAGE: 'UNKNOWN',
    THEFT: 'UNKNOWN',
    VALUE: 'UNKNOWN',
    COMPLEXITY: 'UNKNOWN',
    SKILL: 'UNKNOWN',
    IDENTIFICATION_CONFIDENCE: identification,
  };
  if (prohibited) {
    return {
      policy_version: POLICY_VERSION,
      level: 'PROHIBITED',
      factors,
      reason_codes: ['PROHIBITED_' + prohibited],
      owner_override_ignored: !!(input && input.owner_risk_level),
    };
  }
  if (identification !== 'HIGH' && identification !== 'MEDIUM') {
    return {
      policy_version: POLICY_VERSION,
      level: 'UNKNOWN',
      factors,
      reason_codes: ['IDENTIFICATION_INSUFFICIENT'],
      owner_override_ignored: !!(input && input.owner_risk_level),
    };
  }
  const signals = new Set(input.signals || []);
  if (signals.has('HIGH_INJURY') || signals.has('HIGH_VALUE') || signals.has('POWER_TOOL')) factors.INJURY = 'HIGH';
  else if (signals.has('SIMPLE_HAND_TOOL')) factors.INJURY = 'LOW';
  else factors.INJURY = 'MEDIUM';
  factors.LEGAL = 'LOW';
  factors.THEFT = signals.has('HIGH_VALUE') ? 'HIGH' : 'MEDIUM';
  factors.VALUE = signals.has('HIGH_VALUE') ? 'HIGH' : 'MEDIUM';
  factors.COMPLEXITY = signals.has('NEEDS_TRAINING') ? 'HIGH' : 'LOW';
  factors.SKILL = factors.COMPLEXITY;
  factors.MISUSE = factors.INJURY === 'HIGH' ? 'HIGH' : 'MEDIUM';
  factors.PROPERTY_DAMAGE = factors.INJURY === 'HIGH' ? 'MEDIUM' : 'LOW';
  const values = Object.values(factors);
  let level = 'LOW';
  if (values.includes('HIGH')) level = 'HIGH';
  else if (values.includes('MEDIUM') || values.includes('UNKNOWN')) level = 'MEDIUM';
  return {
    policy_version: POLICY_VERSION,
    level,
    factors,
    reason_codes: ['RULES_' + level],
    owner_override_ignored: !!(input && input.owner_risk_level),
  };
}

module.exports = { classify, screenText };
