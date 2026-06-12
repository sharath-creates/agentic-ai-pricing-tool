const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load data and math as plain JS (not modules)
// Hack: replace 'const DATA =' with 'var DATA =' so it becomes a property of the vm context
const dataJs = fs.readFileSync(path.join(__dirname, '../src/data.js'), 'utf8')
  .replace('const DATA =', 'var DATA =');
const mathJs = fs.readFileSync(path.join(__dirname, '../src/math.js'), 'utf8');

const context = { module: { exports: {} } };
vm.createContext(context);
vm.runInContext(dataJs, context);
vm.runInContext(mathJs, context);

const DATA = context.DATA;
const math = context.module.exports;

test('taskTokens: N=1 (no growth)', () => {
  const p = { steps: 1, sysTokens: 1000, userTokens: 500, outPerStep: 100, toolTokens: 200 };
  const t = math.taskTokens(p);
  assert.strictEqual(t.totalInput, 1500);
  assert.strictEqual(t.totalOutput, 100);
  assert.strictEqual(t.newTokens, 300);
});

test('taskTokens: N=15 medium preset', () => {
  const p = { steps: 15, sysTokens: 8000, userTokens: 400, outPerStep: 800, toolTokens: 1500 };
  const t = math.taskTokens(p);
  assert.strictEqual(t.totalInput, 367500);
  assert.strictEqual(t.totalOutput, 12000);
});

test('llmCostPerTask: cache hit rate 0 vs 0.7', () => {
  const p = { steps: 10, sysTokens: 1000, userTokens: 0, outPerStep: 100, toolTokens: 0, cacheHit: 0 };
  const model = { inP: 10, outP: 20, cacheRead: 0.1, cacheWrite: 1.0 };

  const cost0 = math.llmCostPerTask(p, model).cost;
  assert.strictEqual(cost0, 0.165);

  const p70 = { ...p, cacheHit: 70 };
  const cost70 = math.llmCostPerTask(p70, model).cost;
  assert.ok(Math.abs(cost70 - 0.07365) < 1e-10);
});

test('llmCostPerTask: Anthropic cache-write premium', () => {
  const p = { steps: 10, sysTokens: 1000, userTokens: 0, outPerStep: 100, toolTokens: 0, cacheHit: 70 };
  const model = { inP: 10, outP: 20, cacheRead: 0.1, cacheWrite: 1.25 };

  const res = math.llmCostPerTask(p, model);
  assert.ok(Math.abs(res.cost - 0.07615) < 1e-10);
});

test('egress costs and free tier', () => {
  const baseParams = {
    tasksPerDay: 0, steps: 1, sysTokens: 0, userTokens: 0, outPerStep: 0, toolTokens: 0,
    route: 0, modelId: 'sonnet46', gpuId: 'h100_neo', gpuCount: 1, throughput: 1000, utilization: 50,
    vectorFixed: 0, saasFixed: 0, runtimeFixed: 0, obsPerTrace: 0, tools: {},
    egressCloud: 0.09, cacheHit: 0
  };

  const res100 = math.computeCosts({ ...baseParams, egressGB: 100 }, DATA);
  assert.strictEqual(res100.egressMo, 0);

  const res120 = math.computeCosts({ ...baseParams, egressGB: 120 }, DATA);
  assert.ok(Math.abs(res120.egressMo - 1.80) < 1e-10);
});

test('self-hosted math', () => {
  const p = {
    tasksPerDay: 50, steps: 15, sysTokens: 8000, userTokens: 400, outPerStep: 800, toolTokens: 1500,
    route: 0, modelId: 'sonnet46', gpuId: 'h100_neo', gpuCount: 1, throughput: 1200, utilization: 50,
    vectorFixed: 0, saasFixed: 0, runtimeFixed: 0, obsPerTrace: 0, tools: {},
    egressGB: 0, egressCloud: 0.09, cacheHit: 70
  };

  const res = math.computeCosts(p, DATA);
  assert.strictEqual(res.sh.monthlyFixed, 1963.7);
  assert.strictEqual(res.sh.capacityTokens, 1576800000);
  assert.ok(Math.abs(res.sh.perM - 1.24537037) < 1e-6);
});

test('medium preset end-to-end', () => {
  const p = {
    tasksPerDay: 50, steps: 15, sysTokens: 8000, userTokens: 400, outPerStep: 800, toolTokens: 1500,
    route: 20, modelId: 'sonnet46', gpuId: 'h100_neo', gpuCount: 1, throughput: 1200, utilization: 50,
    vectorFixed: 25, saasFixed: 50, runtimeFixed: 30, obsPerTrace: 0.0005,
    egressGB: 20, egressCloud: 0.09, cacheHit: 70,
    tools: { search: 6, fetch: 8, vector: 3, embed: 2, searchP: 0, sandbox: 0 }
  };

  const res = math.computeCosts(p, DATA);
  console.log('Medium preset totalMo:', res.totalMo);
  assert.ok(res.totalMo > 930 && res.totalMo < 945);
});
