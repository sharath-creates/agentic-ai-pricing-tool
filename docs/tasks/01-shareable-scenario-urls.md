# Task 01 — Shareable scenario URLs

## Goal

Let a user copy a link that reproduces their exact scenario (all picker state), and have the
tool restore that state on load.

## Scope

- Encode full picker state in the URL: slider values, selected model, route share, tool
  on/off + price + calls, fixed-cost inputs, egress cloud/GB, GPU selection/count/throughput/
  utilization, and active preset.
- Use a compact query string or hash fragment (e.g. `#s=...`). URL must stay under ~2000 chars.
- On page load, if state is present in the URL, apply it instead of the default preset.
- Add a "Copy link" button in the header badge area. On click: write the URL to the clipboard
  via `navigator.clipboard.writeText` and show a brief "copied" confirmation. No localStorage.
- Edited dataset prices (the price-edit panel) are OUT of scope — share picker state only.

## Acceptance criteria

1. Set a custom scenario, copy link, open in a fresh tab: identical KPIs render.
2. A URL with no state loads the medium preset exactly as today.
3. Malformed/partial state in the URL falls back to defaults without console errors.
4. `node build.js` regenerates the artifact; both `src/` and the artifact are committed.
5. Medium preset with no URL state still totals ~$937/month (June 2026 dataset).

## Files you will touch

`src/app.js` (state serialize/restore, button wiring), `src/template.html` (button markup),
`src/styles.css` (button style if needed).
