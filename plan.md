# Plan — updated July 23, 2026

A re-plan after a full codebase review. Supersedes the implicit plan of "three parallel
issues farmed out on June 12."

## Where things stand (verified today)

- **Sources and artifact are in sync.** `node build.js` on `main` reproduces
  `agentic-ai-pricing-tool.html` byte-identical. The codebase is small and clean:
  ~250 lines of app logic, 57 lines of data, no dependencies beyond Chart.js from CDN.
- **The $937 invariant holds.** Recomputing the medium preset from `src/data.js` gives
  $936.68/month (totalInput 367,500; totalOutput 12,000), matching AGENTS.md.
- **All three work items are done-but-stranded.** Issues #1, #2, #3 each have an open
  Jules PR (#6, #4, #5) from June 12 — six weeks unreviewed. All three branch from the
  same `main` commit and all rewrite `src/app.js`, so they conflict pairwise: at most one
  merges clean, the other two need rework.
- **The pending PRs are individually sound** as far as automated checks go:
  - PR #5 (test harness): 7/7 tests pass under `node --test`, artifact in sync.
  - PR #4 (tornado) and #6 (URLs): artifacts in sync, built inline script passes
    `node --check`. Not yet functionally reviewed in a browser.
- **The dataset is going stale.** Prices are as-of June 12, 2026; it's now July 23.

## What changed in the rethink

The original three issues were written as independent, parallel tasks. They aren't:
issue #3 (extract math into `src/math.js`) restructures the exact code the other two
build on, and issue #2 explicitly requires "no duplicated formulas," which only the
math extraction delivers. Landing order matters. The plan below serializes them,
then adds the guardrails whose absence caused this pile-up (no CI, no artifact-drift
check, review-by-nobody), then a dataset refresh, then a small quality backlog found
during review.

## Phase 1 — Land the test harness (PR #5, closes #3)

First because it is the structural change: pure math moves to `src/math.js` with a
Node-testable `computeCosts(params, dataset)`, and it carries the regression suite the
other two phases need. Rebasing the others onto it is far cheaper than the reverse.

- Review PR #5 against the AGENTS.md invariants and the docs/tasks/03 acceptance
  criteria (tests already pass locally; artifact verified in sync).
- Merge to `main`.

## Phase 2 — Rework and land the tornado panel (PR #4, closes #2)

PR #4 did its own "centralize the compute" refactor of `src/app.js`, which now collides
head-on with Phase 1's `math.js`. Expect a rework, not a mechanical rebase:

- Rebuild the panel on top of `computeCosts(params)` from `src/math.js` — this is what
  finally satisfies the "single source of truth for math" acceptance criterion.
- Side benefit to verify while here: the breakdown doughnut currently re-implements the
  cache-billing formula inline (`render()` in `src/app.js`) — that duplication should
  disappear in this rework.
- Re-check acceptance: steps/task shows top-two impact on the medium preset; total
  still ~$937.

## Phase 3 — Rework and land shareable URLs (PR #6, closes #1)

Smallest conflict surface (state serialize/restore + init sequence + a header button),
so it goes last.

- Rebase onto post-Phase-2 `main`; the init-sequence changes will need re-threading.
- Re-verify the acceptance criteria by hand: copy-link round trip reproduces KPIs,
  bare URL loads the medium preset, malformed hash falls back silently.

## Phase 4 — CI and guardrails (new)

The June pile-up happened because nothing enforced review or verification. Add a
GitHub Actions workflow that runs on every PR:

1. `node build.js && git diff --exit-code` — fails if the committed artifact doesn't
   match `src/` (the "never edit the artifact by hand / always commit both" rule,
   currently enforced only by AGENTS.md prose).
2. `node --check` on the script extracted from the built HTML (catches module syntax
   leaking into the browser build).
3. `node --test` (meaningful from Phase 1 onward, including the ~$937 end-to-end
   regression).

## Phase 5 — Dataset refresh (new)

- Re-collect model, GPU, tool, and egress prices; bump the as-of date in all three
  places (`src/data.js` header comment, page header badge, footnote) per the
  AGENTS.md dataset rule, citing sources in the PR.
- If any price change moves the medium preset off ~$937, update the invariant in
  AGENTS.md, docs/tasks/02 and 03, and the tests in the same PR, and say so
  explicitly.
- Recurring: repeat roughly monthly, or when a major provider reprices.

## Phase 6 — Model-quality backlog (new, in rough priority order)

Findings from the review; each is a small, separable issue.

1. **Breakeven chart ignores capacity limits.** The self-hosted line holds GPU rent
   constant as tasks/day grows, even past the point where the configured GPUs can't
   serve the tokens. Step the line up as additional GPUs become necessary — otherwise
   the crossover point is optimistic.
2. **Routing blend is per-task, not per-step.** "Route easy steps to a cheap model"
   actually blends whole-task costs (`blendedLLM` in `src/app.js`), which ignores that
   cheap-model steps still pay full-context input. Either model it per-step or relabel
   the control honestly ("share of tasks routed to the cheap model").
3. **Self-hosted throughput conflates prefill and decode.** Capacity counts input and
   output tokens against one tokens/sec dial; prefill throughput is orders of magnitude
   higher than decode. A two-dial (or decode-only) model would make the breakeven
   materially more accurate. Document the simplification meanwhile.
4. **Init-wiring cleanup.** The fixed-cost input loop at the bottom of `src/app.js`
   registers five `DOMContentLoaded` listeners and reassigns the `egressCloud` handler
   five times; assign handlers directly (the script already runs at end of body).
5. **Offline story.** The single-file promise breaks without network: Chart.js comes
   from cdnjs, so charts silently vanish offline. Options: inline Chart.js into the
   artifact (~200 KB, needs an AGENTS.md constraint change) or render a text fallback
   when `Chart` is undefined. Decide before doing.

## Out of scope (unchanged constraints)

- Sharing edited dataset prices in URLs (explicitly excluded by task 01).
- localStorage/sessionStorage, frameworks, analytics, any backend — all still banned
  per AGENTS.md.
- The one-file distributable model itself: it's the product, not a limitation.
