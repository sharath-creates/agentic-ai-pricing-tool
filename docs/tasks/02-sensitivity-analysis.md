# Task 02 — Sensitivity (tornado) analysis panel

## Goal

Show which dials move the monthly bill most: a horizontal tornado chart of the change in
total monthly cost when each input shifts ±20%.

## Scope

- Inputs to perturb: steps/task, output tokens/step, tool result tokens/step, system+tool-def
  tokens, cache hit rate (clamp 0–95%), tasks/day.
- For each input, recompute total monthly cost at 0.8× and 1.2× the current value (others
  fixed) and plot the low/high deltas as a horizontal bar pair, sorted by impact.
- Render as a new panel under "Where the money goes", using Chart.js (already loaded) —
  a horizontal bar chart with two datasets (−20%, +20%) is fine.
- Reuse the existing math functions; do NOT duplicate the cost formulas. Refactor
  `compute()` in `src/app.js` if needed so it can run on a passed parameter object without
  reading the DOM (e.g. `compute(params)` with a DOM-reading wrapper).
- Panel updates live whenever any input changes, like the other charts.

## Acceptance criteria

1. Tornado chart renders for all presets and updates on any input change.
2. With the medium preset, perturbing steps/task shows the largest or second-largest impact
   (expected, given quadratic context growth).
3. No duplicated cost formulas — single source of truth for math.
4. `node build.js` regenerates the artifact; both `src/` and the artifact are committed.
5. Baseline medium preset total still ~$937/month.

## Files you will touch

`src/app.js`, `src/template.html`, `src/styles.css`.
