function clip01(x) {
  const n = typeof x === "number" ? x : 0;
  return Math.max(0, Math.min(1, n));
}

function get(obj, path, fallback) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || !(p in cur)) return fallback;
    cur = cur[p];
  }
  return cur;
}

function normalizeEnum(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

function normalizeInputV1(raw) {
  const out = {
    stakes: {
      severity: clip01(get(raw, "stakes.severity", 0.5)),
      reversibility: clip01(get(raw, "stakes.reversibility", 0.5)),
      time_pressure: clip01(get(raw, "stakes.time_pressure", 0.5))
    },
    counterparty: {
      power_asymmetry: clip01(get(raw, "counterparty.power_asymmetry", 0.5)),
      trust_level: clip01(get(raw, "counterparty.trust_level", 0.5)),
      predictability: clip01(get(raw, "counterparty.predictability", 0.5))
    },
    exposure: {
      legal_exposure: clip01(get(raw, "exposure.legal_exposure", 0)),
      financial_exposure: clip01(get(raw, "exposure.financial_exposure", 0)),
      reputation_exposure: clip01(get(raw, "exposure.reputation_exposure", 0)),
      audience_spillover: clip01(get(raw, "exposure.audience_spillover", 0))
    },
    history: {
      pattern_repetition: clip01(get(raw, "history.pattern_repetition", 0)),
      prior_boundary_failed: clip01(get(raw, "history.prior_boundary_failed", 0)),
      prior_documentation_exists: clip01(get(raw, "history.prior_documentation_exists", 0))
    },
    communication: {
      channel_type: normalizeEnum(
        get(raw, "communication.channel_type", "text"),
        ["text", "email", "in_person", "phone"],
        "text"
      ),
      channel_risk: clip01(get(raw, "communication.channel_risk", 0.5)),
      misinterpretation_risk: clip01(get(raw, "communication.misinterpretation_risk", 0.5))
    },
    intent: {
      goal_type: normalizeEnum(
        get(raw, "intent.goal_type", "clarify"),
        ["clarify", "negotiate", "boundary", "resolve", "document"],
        "clarify"
      ),
      relationship_goal: normalizeEnum(
        get(raw, "intent.relationship_goal", "maintain"),
        ["repair", "maintain", "boundary", "exit"],
        "maintain"
      ),
      desired_action: normalizeEnum(
        get(raw, "intent.desired_action", "reply"),
        ["reply", "schedule", "confirm", "acknowledge", "adjust"],
        "reply"
      )
    },
    facts: {
      factual_summary: String(get(raw, "facts.factual_summary", "") || ""),
      evidence_strength: normalizeEnum(
        get(raw, "facts.evidence_strength", "partial"),
        ["none", "partial", "strong"],
        "partial"
      ),
      emotion_intensity: clip01(get(raw, "facts.emotion_intensity", 0.3))
    }
  };

  return out;
}

module.exports = { normalizeInputV1 };
