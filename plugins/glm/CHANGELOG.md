---
description: How glm-plugin-cc is built, tested, and released.
---

# GLM Plugin — Development

See [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md) for the full guide.

Quick reference:

- Tests: `pnpm test` (no network).
- Live check: `node plugins/glm/scripts/glm-broker.mjs setup --check`.
- Plugin scripts are ESM (`.mjs`), node >=18.18.
- The broker is both a library (`runClaude`) and a CLI; CLI dispatch is main-module-guarded.
- Job state is JSON/JSONL on disk under `~/.glm-plugin/jobs/` — no native deps.
- Layout, command surface, and review-gate design mirror `openai/codex-plugin-cc`.
