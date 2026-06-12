# Task 03 — Node test harness for the cost math

## Goal

Make the math testable outside the browser and add a regression suite runnable with
`node --test`.

## Scope

- Extract the pure math from `src/app.js` into `src/math.js`: `taskTokens`, `llmCostPerTask`,
  and a DOM-free `computeCosts(params, dataset)` covering tool costs, fixed costs, egress
  (100 GB free tier), and self-hosted capacity/effective-rate math.
- `src/math.js` must work both inlined in the browser build (no module syntax in the built
  file — build.js concatenates plain scripts) and under Node tests. Pattern: plain
  function/const declarations plus a guarded `if (typeof module !== "undefined") module.exports = {...}` at the bottom.
- Update `build.js` to inline `src/math.js` before `src/app.js`; remove the now-duplicated
  functions from `src/app.js`.
- Add `tests/math.test.js` using `node:test` + `node:assert`. Cover at minimum:
  - token totals for N=1 (no growth term) and N=15 medium preset (totalInput 367,500;
    totalOutput 12,000)
  - cache math: hit rate 0 vs 0.7 vs cacheRead=1.0 model (no discount)
  - Anthropic cache-write premium applied only when cacheWrite > 1 and hit rate > 0
  - egress free tier boundary (100 GB → $0; 120 GB on AWS → $1.80)
  - self-hosted: 1× $2.69/hr GPU, 1200 tok/s, 50% util → monthlyFixed ≈ $1,963.70,
    capacity ≈ 1.577B tokens/mo
  - medium-preset end-to-end monthly total ≈ $937 (±$1)

## Acceptance criteria

1. `node --test tests/` passes.
2. `node build.js` output is functionally unchanged: UI behaves identically, medium preset
   still ~$937/month.
3. No module syntax leaks into the built HTML (no `require`/`export` errors in browser console).
4. Both `src/` and the regenerated artifact are committed.

## Files you will touch

`src/math.js` (new), `src/app.js`, `build.js`, `tests/math.test.js` (new).
