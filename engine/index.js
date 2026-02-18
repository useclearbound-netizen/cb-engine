const { normalizeInputV1 } = require("./normalize/normalizeInput.v1");
const { computeRiskProfileV1 } = require("./risk/computeRiskProfile.v1");
const { computeStrategyMapV1 } = require("./strategy/computeStrategyMap.v1");
const { computeBlockPlanV1 } = require("./blocks/computeBlockPlan.v1");

function runEngineV1(rawCanonicalInput) {
  const input = normalizeInputV1(rawCanonicalInput);
  const risk_profile = computeRiskProfileV1(input);
  const strategy_map = computeStrategyMapV1(input, risk_profile);
  const block_plan = computeBlockPlanV1(input, risk_profile, strategy_map);

  return {
    version: "engine.v1",
    input,
    risk_profile,
    strategy_map,
    block_plan
  };
}

module.exports = { runEngineV1 };
