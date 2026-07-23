# Plan — from single-file calculator to an AI cost-decision platform

Updated July 23, 2026. Supersedes the maintenance-only plan.

## The reframe

Today this repo is a single HTML file that models one scenario well: an agentic loop
hitting an LLM API, with a self-hosted-GPU breakeven. The goal is bigger: **a platform
where a company can figure out what running AI on their actual workloads will cost,
compare models on cost *and* fit, and decide build-vs-buy — across the use cases most
companies really deploy.**

The audience is the broad middle that almost all AI spend comes from — companies that
are neither thin API wrappers nor labs pretraining their own models. They consume
frontier models through APIs, sometimes fine-tune small open models, sometimes rent
GPUs, and they all ask the same three questions:

1. **What will this use case cost us at our volume?**
2. **Which model is the cheapest one that's good enough for this job?**
3. **When (if ever) should we move off the API — to a fine-tuned small model, or
   self-hosted open weights?**

Nothing widely used answers all three in one place. Provider pricing pages answer
none of them. That's the platform.

## What we already have (the seed)

- A cost engine that gets the hard part right: the agent-loop quadratic (context
  regrowth per step), prompt-cache economics including Anthropic's write premium,
  tool/MCP per-call costs, fixed infra, egress tiers, and GPU rental math.
- A June 2026 cross-provider dataset (Anthropic, OpenAI, Google, DeepSeek, hosted
  Llama; H100/H200/B200/A100 across neoclouds and hyperscalers).
- Three finished-but-unmerged PRs: math extracted into a testable library (#5),
  sensitivity/tornado analysis (#4), shareable scenario URLs (#6). All three are
  platform prerequisites, not maintenance chores: #5 is the core engine as a library,
  #4 is a decision feature, #6 is the first sharing/collaboration feature.

Everything below builds on these; nothing is thrown away.

---

## Phase 1 — Harden the engine (1–2 weeks of work, mostly done)

Land the pending PRs in dependency order — #5 (math library + tests), then #4
(tornado, reworked on top of the library), then #6 (shareable URLs) — plus CI that
enforces build/artifact sync and runs the regression suite. Details were in the
previous revision of this plan; the short version: `src/math.js` +
`computeCosts(params, dataset)` becomes **the** engine every platform surface calls,
with the ~$937 medium-preset regression test guarding it.

Exit criterion: a pure, DOM-free, tested cost engine and a datestamped dataset file,
both importable outside this page.

## Phase 2 — Use-case library: model what companies actually run

The current tool models one workload shape (multi-step agent loop). Companies run
maybe a dozen distinct shapes, each with different cost physics. Build each as a
first-class **workload template** — its own math profile, presets, and explainer —
not just a slider preset:

| Use case | What's different about its cost math |
|---|---|
| **Customer support automation** | High volume, short contexts, huge cache hit on system prompt; deflection-rate ROI (cost per resolved ticket vs human cost) |
| **Coding agents / SWE automation** | Deep loops (40–100+ steps), giant contexts, cache-write heavy; cost per merged PR |
| **RAG knowledge assistant** | Embedding + vector store + reranker costs dominate at scale; chunking strategy changes token volume 5–10× |
| **Document intelligence** (contracts, claims, invoices, KYC) | Batch not interactive → batch-API discounts (50%) apply; per-page/per-doc pricing; OCR + long-context tradeoff |
| **Batch classification / extraction / ETL enrichment** | Millions of tiny calls; small-model territory; where fine-tuning pays back fastest |
| **Meeting/call intelligence** | Audio transcription cost + summarization; per-hour-of-audio unit economics |
| **Voice agents** | Realtime/streaming pricing, TTS+STT+LLM stack, latency floors that exclude models regardless of price |
| **Content generation** (marketing, localization) | Output-token dominated — inverts the usual input-heavy math |
| **Computer-use / browser agents** | Screenshot tokens per step (vision input), very long loops, high failure/retry rates baked into cost |
| **Internal copilots** (Slack/email/CRM embedded) | Per-seat SaaS + MCP connector tiers dominate over tokens at low volume |

Each template ships with: editable token/volume profile, the right unit economics
("per resolved ticket", "per document", "per merged PR" — not just per task), and a
comparison across models *for that shape*.

This phase is where "think beyond wrappers" becomes concrete: the templates encode
how real workloads differ, which is exactly what generic pricing pages can't do.

Engine work required: batch-API pricing tiers, per-modality pricing (vision, audio,
realtime), retry/failure-rate multiplier, and pluggable unit-economics denominators.

## Phase 3 — The third option: fine-tuning and small-model routing

The current tool compares API vs self-hosted rented GPUs. The decision most companies
actually face is three-way, and the middle option is missing:

- **Fine-tuned small model** as a use-case-specific alternative: training cost
  (one-off + refresh cadence), hosted-inference price of the tuned model, the
  accuracy-vs-frontier gap, and the volume threshold where it wins.
- **Router/cascade modeling done honestly**: cheap model first, escalate on
  low-confidence — modeled per-step with escalation rates, replacing today's
  whole-task blend (a known weakness of the current `blendedLLM`).
- **Distillation path**: frontier model generates labels → small model serves. This
  is the pattern the "middle" companies increasingly use; nobody prices it end-to-end.

Exit criterion: every use-case template shows a three-way build/buy/tune comparison
with the crossover volumes marked.

## Phase 4 — Comparison beyond price: "cheapest model that's good enough"

Price-per-token comparison is necessary but not sufficient — a model that's 3× cheaper
and can't do the job costs infinitely more. Add a fit layer:

- **Capability data per use case**: curated public benchmark results mapped to each
  template (SWE-bench-class for coding agents, doc-VQA for document intelligence,
  etc.), shown next to cost — producing a cost-per-quality view, not a leaderboard.
- **Operational constraints** that disqualify models before price matters: context
  window vs the template's context profile, latency class (voice needs streaming
  TTFT), rate limits vs required throughput, data-residency/zero-retention options.
- Output: for each use case, a shortlist — "these 3 models clear the bar; here's the
  monthly bill for each at your volume" — which is the actual purchasing decision.

Keep this honest and sourced: public benchmarks with citations and dates, user-editable
like the price dataset. No invented quality scores.

## Phase 5 — Platform mechanics: from page to product

Architecture evolves in steps, keeping the zero-backend property as long as possible:

1. **Static multi-page site** (the calculator becomes one tool among several):
   use-case library, comparison views, and per-model/per-use-case pages that can rank
   on search ("what does an AI support bot cost"). Static-site generator, the vanilla
   JS engine imported everywhere, hosted on Pages/Netlify. The single-file HTML
   remains as a downloadable offline artifact — it's a differentiator, keep it.
2. **Living pricing dataset as the moat**: versioned JSON in-repo, refreshed by a
   scheduled Action that diffs provider pricing pages and opens a PR on change
   (human-reviewed, sources cited — per current AGENTS.md dataset rules). History
   kept, so the site can show **price-over-time charts** and "what did this workload
   cost in January vs now" — data nobody else publishes cleanly.
3. **Sharing → persistence**: URL-encoded scenarios (#6) first; then optional
   accounts (Supabase-class, only when genuinely needed) for saved scenarios, team
   workspaces, and budget tracking against projected spend.
4. **Calibration against reality** (the long-term differentiator): let users import
   actual usage exports/invoices (Anthropic/OpenAI usage CSVs) to calibrate their
   template parameters from real traffic instead of guesses — and to see "your
   effective $/task vs the model you planned." All client-side parsing first; no
   uploaded data leaves the browser until there are accounts and an explicit reason.

## Phase 6 — Reach and feedback loops

- Public read-only **pricing-data API** (the versioned JSON, served statically) — lets
  others build on the dataset and funnels credibility back.
- Exportable outputs: PDF/one-pager per scenario for the "convince my VP" moment;
  CSV of any table.
- Community-contributed workload profiles: real (anonymized) token profiles per use
  case submitted via PR, reviewed like price changes. Real usage shapes are scarce
  and valuable; the repo becomes where they accumulate.

---

## Sequencing summary

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | Tested engine library, CI, pending PRs landed | — |
| 2 | 8–10 use-case templates with per-use-case unit economics | 1 |
| 3 | Three-way API / self-host / fine-tune comparison, honest routing | 1, 2 |
| 4 | Capability + constraint layer ("good enough" shortlists) | 2 |
| 5 | Multi-page site, live dataset pipeline, sharing → accounts | 1–4 incremental |
| 6 | Data API, exports, community profiles | 5 |

Phases 2–4 are the product; 5–6 are distribution. If forced to cut, cut from the
bottom.

## Principles carried forward

- **The engine stays pure and tested.** Every surface calls the same
  `computeCosts`; invariants (agent-loop quadratic, cache math, egress tiers) stay
  regression-tested. No formula ever lives in two places.
- **Every number is dated, sourced, and user-editable.** The tool's credibility is
  that it shows its work; estimates are labeled estimates.
- **Client-side by default.** No backend until a feature is impossible without one;
  no analytics creep; the offline single-file artifact keeps working.
- **Model-vendor neutral.** Cross-provider comparison is the point; nothing in the
  UI privileges a provider beyond what the numbers say.
