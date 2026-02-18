function computeDeliverableType(channelType) {
  if (channelType === "email") return "email";
  if (channelType === "in_person" || channelType === "phone") return "dialogue_script";
  return "message";
}

function blockTemplateForStructure(structureMode, deliverableType) {
  // Minimal v1 mapping (LOCK)
  // The block plan is the Realizer blueprint.
  if (deliverableType === "dialogue_script") {
    return {
      required_blocks: [
        "opening_line",
        "context_anchor",
        "observations",
        "boundary_or_request",
        "clarifying_question",
        "fallback_if_pushback",
        "closing_line"
      ],
      block_constraints: {
        no_emotional_language: true,
        avoid_admissions: true,
        require_ambiguity_buffer: true,
        cta_must_be_clear: true
      }
    };
  }

  if (structureMode === "record_style") {
    return {
      required_blocks: [
        "context_anchor",
        "facts_log",
        "expectation_standard",
        "requested_process",
        "cta",
        "closing"
      ],
      block_constraints: {
        no_emotional_language: true,
        evidence_reference_required: false,
        cta_must_be_clear: true
      }
    };
  }

  if (structureMode === "formal_email" || deliverableType === "email") {
    return {
      required_blocks: [
        "context_anchor",
        "observations",
        "impact",
        "boundary_or_request",
        "cta",
        "closing"
      ],
      block_constraints: {
        no_emotional_language: true,
        evidence_reference_required: false,
        cta_must_be_clear: true
      }
    };
  }

  if (structureMode === "structured") {
    return {
      required_blocks: [
        "context_anchor",
        "observations",
        "boundary_or_request",
        "cta",
        "closing"
      ],
      block_constraints: {
        no_emotional_language: true,
        evidence_reference_required: false,
        cta_must_be_clear: true
      }
    };
  }

  // single_shot
  return {
    required_blocks: ["context_anchor", "boundary_or_request", "cta", "closing"],
    block_constraints: {
      no_emotional_language: true,
      cta_must_be_clear: true
    }
  };
}

function computeBlockPlanV1(input, riskProfile, strategyMap) {
  const deliverable_type = computeDeliverableType(input.communication.channel_type);
  const template = blockTemplateForStructure(strategyMap.structure_mode, deliverable_type);

  // Tie guardrails to constraints
  if (strategyMap.guardrails?.avoid_admissions) template.block_constraints.avoid_admissions = true;
  if (strategyMap.guardrails?.require_ambiguity_buffer) template.block_constraints.require_ambiguity_buffer = true;

  return {
    deliverable_type,
    required_blocks: template.required_blocks,
    block_constraints: template.block_constraints
  };
}

module.exports = { computeBlockPlanV1 };
