const presetsCfg = require("../config/strategyPresets.v1.json");
const overridesCfg = require("../config/overrides.v1.json");

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function applyStrategyOverrides(strategy, input, riskProfile) {
  const out = deepClone(strategy);

  for (const rule of overridesCfg.strategy_overrides) {
    // input gte rules
    if (rule.if_input_gte?.["exposure.legal_exposure"] != null) {
      const thr = rule.if_input_gte["exposure.legal_exposure"];
      if (input.exposure.legal_exposure >= thr) {
        for (const [k, v] of Object.entries(rule.force || {})) setPath(out, k, v);
      }
    }

    // mode gte rules
    if (rule.if_mode_gte?.admission != null) {
      const thr = rule.if_mode_gte.admission;
      if ((riskProfile.mode_scores.admission ?? 0) >= thr) {
        for (const [k, v] of Object.entries(rule.force || {})) setPath(out, k, v);
      }
    }
  }

  return out;
}

function fineTune(strategy, input, riskProfile) {
  // v1: minimal deterministic tuning without changing identity
  const out = deepClone(strategy);
  const m = riskProfile.mode_scores;

  // High misinterpretation → increase clarity posture
  if (m.misinterpretation >= 0.7) {
    if (out.disclosure_level === "minimal") out.disclosure_level = "selective";
    if (out.structure_mode === "single_shot") out.structure_mode = "structured";
    out.guardrails.require_ambiguity_buffer = true;
  }

  // High escalation → reduce CTA intensity by one step (unless time_pressure extreme)
  if (m.escalation >= 0.7 && input.stakes.time_pressure < 0.8) {
    if (out.cta_intensity === "high") out.cta_intensity = "medium";
    if (out.cta_intensity === "medium") out.cta_intensity = "low";
    out.guardrails.require_ambiguity_buffer = true;
  }

  // Relationship intent can slightly bias relationship_priority in non-extreme tiers
  if (riskProfile.risk_tier === "low" || riskProfile.risk_tier === "medium") {
    out.relationship_priority = input.intent.relationship_goal;
  }

  return out;
}

function computeStrategyMapV1(input, riskProfile) {
  const preset = presetsCfg.presets[riskProfile.risk_tier];
  let strategy = deepClone(preset);

  strategy = fineTune(strategy, input, riskProfile);
  strategy = applyStrategyOverrides(strategy, input, riskProfile);

  return strategy;
}

module.exports = { computeStrategyMapV1 };
