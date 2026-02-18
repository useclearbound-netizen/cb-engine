const weightsCfg = require("../config/riskWeights.v1.json");
const tierCfg = require("../config/tierThresholds.v1.json");
const overridesCfg = require("../config/overrides.v1.json");

function clip01(x) {
  return Math.max(0, Math.min(1, x));
}

function modeScore(P, C) {
  return clip01(P * C);
}

function evidenceFactor(e) {
  if (e === "strong") return 0.85;
  if (e === "partial") return 0.65;
  return 0.45;
}

function computeModesV1(input) {
  // Probability heuristics (v1: deterministic, first-principles)
  const P_escalation =
    0.35 * input.facts.emotion_intensity +
    0.25 * (1 - input.counterparty.predictability) +
    0.25 * input.counterparty.power_asymmetry +
    0.15 * input.history.pattern_repetition;

  const C_escalation =
    0.45 * input.stakes.severity +
    0.25 * (1 - input.stakes.reversibility) +
    0.20 * input.exposure.reputation_exposure +
    0.10 * input.intent.relationship_goal === "exit" ? 1 : 0.4;

  const misBase = input.communication.misinterpretation_risk;
  const P_misinterpretation =
    0.50 * misBase +
    0.20 * input.communication.channel_risk +
    0.15 * (1 - input.counterparty.trust_level) +
    0.15 * (1 - input.counterparty.predictability);

  const C_misinterpretation =
    0.35 * input.stakes.severity +
    0.25 * input.exposure.reputation_exposure +
    0.20 * input.exposure.audience_spillover +
    0.20 * input.history.prior_boundary_failed;

  const P_documentation =
    0.40 * input.exposure.legal_exposure +
    0.20 * input.exposure.reputation_exposure +
    0.20 * input.exposure.audience_spillover +
    0.20 * input.communication.channel_risk;

  const C_documentation =
    0.45 * input.exposure.legal_exposure +
    0.25 * input.exposure.financial_exposure +
    0.20 * input.stakes.severity +
    0.10 * (1 - input.stakes.reversibility);

  const P_relationship =
    0.35 * input.history.pattern_repetition +
    0.25 * input.history.prior_boundary_failed +
    0.20 * (1 - input.counterparty.trust_level) +
    0.20 * input.facts.emotion_intensity;

  const C_relationship =
    0.40 * input.stakes.severity +
    0.30 * (input.intent.relationship_goal === "repair" ? 0.6 : 0.9) +
    0.30 * input.counterparty.power_asymmetry;

  // Admission risk depends on legal exposure + evidence + documentation context
  const ef = evidenceFactor(input.facts.evidence_strength);
  const P_admission =
    0.45 * input.exposure.legal_exposure +
    0.25 * input.communication.channel_risk +
    0.20 * (1 - ef) +
    0.10 * input.intent.goal_type === "document" ? 0.8 : 0.4;

  const C_admission =
    0.55 * input.exposure.legal_exposure +
    0.25 * input.exposure.financial_exposure +
    0.20 * input.stakes.severity;

  return {
    escalation: modeScore(clip01(P_escalation), clip01(C_escalation)),
    misinterpretation: modeScore(clip01(P_misinterpretation), clip01(C_misinterpretation)),
    documentation_backfire: modeScore(clip01(P_documentation), clip01(C_documentation)),
    relationship_break: modeScore(clip01(P_relationship), clip01(C_relationship)),
    admission: modeScore(clip01(P_admission), clip01(C_admission))
  };
}

function applyModeMultipliers(modes, input) {
  // From overrides.v1.json (v1: only one multiplier rule)
  let out = { ...modes };
  for (const rule of overridesCfg.strategy_overrides) {
    if (!rule.multiply_mode) continue;
    const spill = input.exposure.audience_spillover;
    if (rule.if_input_gte?.["exposure.audience_spillover"] != null) {
      const thr = rule.if_input_gte["exposure.audience_spillover"];
      if (spill >= thr) {
        for (const k of Object.keys(rule.multiply_mode)) {
          out[k] = clip01(out[k] * rule.multiply_mode[k]);
        }
      }
    }
  }
  return out;
}

function overallScore01(modes) {
  const w = weightsCfg.mode_weights;
  return clip01(
    w.documentation_backfire * modes.documentation_backfire +
    w.escalation * modes.escalation +
    w.misinterpretation * modes.misinterpretation +
    w.admission * modes.admission +
    w.relationship_break * modes.relationship_break
  );
}

function score01to100(x) {
  return Math.round(clip01(x) * 100);
}

function tierFrom100(score100) {
  const t = tierCfg.thresholds;
  if (score100 <= t.low_max) return "low";
  if (score100 <= t.medium_max) return "medium";
  if (score100 <= t.high_max) return "high";
  return "extreme";
}

function applyTierOverrides(baseTier, modes, input) {
  let tier = baseTier;
  for (const rule of tierCfg.tier_overrides) {
    if (rule.if_mode_gte) {
      const [k, thr] = Object.entries(rule.if_mode_gte)[0];
      if ((modes[k] ?? 0) >= thr) tier = rule.force_tier;
    }
    if (rule.if_input_gte) {
      const [path, thr] = Object.entries(rule.if_input_gte)[0];
      if (path === "exposure.legal_exposure" && input.exposure.legal_exposure >= thr) {
        // at least high
        if (tier === "low" || tier === "medium") tier = rule.force_tier;
      }
    }
  }
  return tier;
}

function buildDrivers(input, modes, overall100, tier) {
  // Minimal explainability: top mode drivers + key input drivers
  const sortedModes = Object.entries(modes).sort((a, b) => b[1] - a[1]);
  const top = sortedModes.slice(0, 3);

  const drivers = [];
  drivers.push({ type: "overall", note: `Overall risk score = ${overall100}/100 (${tier}).` });

  for (const [mode, val] of top) {
    drivers.push({ type: "mode", mode, score: Math.round(val * 100) / 100 });
  }

  // Input-based driver hints (deterministic)
  if (input.exposure.legal_exposure >= 0.7) drivers.push({ type: "signal", key: "legal_exposure_high" });
  if (input.exposure.audience_spillover >= 0.7) drivers.push({ type: "signal", key: "audience_spillover_high" });
  if (input.counterparty.power_asymmetry >= 0.7) drivers.push({ type: "signal", key: "power_asymmetry_high" });
  if (input.communication.misinterpretation_risk >= 0.7) drivers.push({ type: "signal", key: "misinterpretation_risk_high" });

  return drivers;
}

function computeRiskProfileV1(input) {
  const rawModes = computeModesV1(input);
  const modes = applyModeMultipliers(rawModes, input);

  const overall01 = overallScore01(modes);
  const overall100 = score01to100(overall01);

  const baseTier = tierFrom100(overall100);
  const tier = applyTierOverrides(baseTier, modes, input);

  return {
    overall_risk_score: overall100,
    risk_tier: tier,
    mode_scores: modes,
    drivers: buildDrivers(input, modes, overall100, tier)
  };
}

module.exports = { computeRiskProfileV1 };
