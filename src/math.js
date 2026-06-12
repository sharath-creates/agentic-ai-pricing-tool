/* ============ CORE MATH ============ */

/**
 * Tokens for one task. Context grows each step:
 * step i input = sys + user + (i-1)*(out + toolResult)
 */
function taskTokens(p) {
  const N = p.steps, base = p.sysTokens + p.userTokens, grow = p.outPerStep + p.toolTokens;
  const totalInput  = N * base + grow * (N * (N - 1) / 2);
  const totalOutput = N * p.outPerStep;
  const newTokens   = N * grow; // freshly written context (cache-write candidates)
  return { totalInput, totalOutput, newTokens };
}

/**
 * LLM cost for one task given a model's pricing.
 */
function llmCostPerTask(p, model) {
  const t = taskTokens(p);
  const h = p.cacheHit / 100;
  const inP = model.inP / 1e6, outP = model.outP / 1e6;

  // cached share billed at cacheRead multiplier, uncached at full rate
  const cost = t.totalInput * ((1 - h) + h * model.cacheRead) * inP + t.totalOutput * outP;

  // cache write premium on newly appended tokens (Anthropic-style), only meaningful if caching is used
  const writePremium = (model.cacheWrite > 1 && h > 0) ? t.newTokens * inP * (model.cacheWrite - 1) : 0;

  return { cost: cost + writePremium, t };
}

/**
 * Comprehensive cost calculation.
 * @param {Object} p Parameters including sliders and selections
 * @param {Object} dataset The DATA object containing models, tools, gpus
 */
function computeCosts(p, dataset) {
  const days = 30.4;

  // 1. LLM Cost (including routing)
  const m = dataset.models.find(x => x.id === p.modelId);
  const share = p.route / 100;
  const mainLLM = llmCostPerTask(p, m);
  let llmResult = { cost: mainLLM.cost, t: mainLLM.t, m: m };

  if (share > 0) {
    const cheap = dataset.models.find(x => x.id === dataset.cheapestInFamily[m.family]);
    if (cheap && cheap.id !== m.id) {
      const c = llmCostPerTask(p, cheap);
      llmResult.cost = mainLLM.cost * (1 - share) + c.cost * share;
    }
  }

  // 2. Tool Cost
  let toolsCost = 0;
  for (const tl of dataset.tools) {
    const calls = p.tools[tl.id] || 0;
    if (calls > 0) toolsCost += tl.price * calls;
  }

  // 3. Monthly totals
  const tasksMo = p.tasksPerDay * days;
  const llmMo = llmResult.cost * tasksMo;
  const toolsMo = toolsCost * tasksMo;
  const obsMo = p.obsPerTrace * tasksMo;
  const fixedMo = p.vectorFixed + p.saasFixed + p.runtimeFixed;
  const egressMo = Math.max(0, p.egressGB - 100) * p.egressCloud;

  const totalMo = llmMo + toolsMo + obsMo + fixedMo + egressMo;
  const perTask = tasksMo > 0 ? totalMo / tasksMo : 0;
  const perDay = totalMo / days;

  // 4. Self-hosted
  const gpu = dataset.gpus.find(g => g.id === p.gpuId);
  const monthlyFixed = gpu.rate * p.gpuCount * 730;
  const capacityTokens = p.throughput * 3600 * 730 * (p.utilization / 100);
  const perM = capacityTokens > 0 ? monthlyFixed / (capacityTokens / 1e6) : Infinity;
  const monthlyTokens = (llmResult.t.totalInput + llmResult.t.totalOutput) * tasksMo;

  const sh = {
    gpu,
    n: p.gpuCount,
    monthlyFixed,
    capacityTokens,
    perM,
    covered: capacityTokens >= monthlyTokens
  };
  const shTotal = monthlyFixed + toolsMo + obsMo + fixedMo + egressMo;

  return {
    p,
    llm: llmResult,
    tools: toolsCost,
    obs: p.obsPerTrace,
    perTaskVar: llmResult.cost + toolsCost + p.obsPerTrace,
    tasksMo,
    llmMo,
    toolsMo,
    obsMo,
    fixedMo,
    egressMo,
    totalMo,
    perTask,
    perDay,
    monthlyTokens,
    sh,
    shTotal
  };
}

if (typeof module !== "undefined") {
  module.exports = { taskTokens, llmCostPerTask, computeCosts };
}
