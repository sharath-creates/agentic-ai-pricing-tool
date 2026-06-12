# Agentic AI Pricing Tool

Interactive cost model for agentic AI workloads. Pick a workload, model, and toolset; see
cost per task, per day, per month, where the money goes, and the breakeven against
self-hosting open-weight models on rented GPUs.

**Use it:** download [`agentic-ai-pricing-tool.html`](agentic-ai-pricing-tool.html) and open
it in any browser. No install, no backend.

## What it models

- LLM API costs across Anthropic, OpenAI, Google, DeepSeek, and hosted Llama, including
  prompt-cache discounts and cache-write premiums
- The agent-loop multiplier: context grows every step, so input cost scales with steps squared
- Tool and MCP integration costs: web search, page fetch, code sandboxes, vector DBs, embeddings
- Infrastructure: agent runtime hosting, observability per trace, SaaS connector tiers, egress
- Self-hosted GPUs (H100/H200/B200/A100 across neoclouds and hyperscalers) with throughput
  and utilization dials, plus an API-vs-self-hosted breakeven chart

Pricing dataset is dated (June 12, 2026) and editable in the UI.

## Development

Sources live in `src/`; the root HTML file is a build artifact.

```
node build.js   # regenerate agentic-ai-pricing-tool.html from src/
```

See [AGENTS.md](AGENTS.md) for the contributor guide (human or agent), math invariants, and
verification steps. Work items live as GitHub issues; full briefs in [docs/tasks/](docs/tasks/).
