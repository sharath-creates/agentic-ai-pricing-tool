# AGENTS.md — guide for coding agents (Jules, Claude, others)

## What this project is

A single-file interactive pricing calculator for agentic AI workloads. Users pick a workload
(tasks/day, steps/task, token sizes, cache hit rate), a model, tools/MCP integrations, and
infrastructure options; the tool computes cost per task/day/month, a breakdown chart, a
cross-model comparison, and an API vs self-hosted GPU breakeven.

## Repository layout

```
src/template.html   HTML skeleton with /*__STYLES__*/ and //__SCRIPT__ placeholders
src/styles.css      All CSS
src/data.js         Pricing dataset (DATA), PRESETS, SLIDERS — constants only, no logic
src/app.js          State, math, rendering, UI wiring
build.js            Inlines src/ into the distributable (node build.js)
agentic-ai-pricing-tool.html   BUILD ARTIFACT — never edit by hand
docs/tasks/         Full briefs for GitHub issues
```

## Workflow rules

1. Edit only files under `src/` (plus docs/tests). Then run `node build.js` and commit BOTH
   the changed sources and the regenerated `agentic-ai-pricing-tool.html`.
2. Verify before opening a PR:
   - `node build.js` succeeds
   - extract the inline script and `node --check` it (or open the file and confirm no console errors)
   - the medium preset (Research agent) must total roughly $937/month with the June 2026 dataset.
     If your change intentionally alters math, state the new expected value and why in the PR.
3. One issue = one PR. Keep PRs scoped to the issue's acceptance criteria.

## Cost-math invariants (do not break silently)

- Context grows each step. For N steps, base prompt B = sysTokens + userTokens,
  growth G = outPerStep + toolTokens per step:
  - totalInput  = N*B + G*N*(N-1)/2   (quadratic in N — this is the core insight of the tool)
  - totalOutput = N*outPerStep
- Cache billing: cached share of input bills at `model.cacheRead` × input rate; models with
  `cacheWrite > 1` (Anthropic) add a write premium on newly appended tokens.
- Self-hosted: monthlyFixed = rate × gpuCount × 730 h; capacity = throughput × 3600 × 730 × utilization.
- Egress: first 100 GB/month free, then per-GB rate.

## Dataset rules

- `src/data.js` holds all prices with an as-of date (currently June 12, 2026), also shown in
  the page header badge and footnote. If you update prices, update all three places and cite
  sources in the PR description.
- Prices are user-editable at runtime by design; do not remove the edit panel.

## Constraints

- Output must remain ONE self-contained HTML file. No build-time dependencies beyond Node
  stdlib; no runtime dependencies beyond Chart.js from cdnjs.
- Vanilla JS only. No frameworks, no localStorage/sessionStorage (breaks in some embeds).
- Keep the dark theme CSS-variable system in `:root`.
- No analytics, no external calls other than the Chart.js CDN.
