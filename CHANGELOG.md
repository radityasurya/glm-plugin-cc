# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-02

### Added

- Initial release of `glm-plugin-cc`.
- `/glm:review` — read-only GLM-5.2 code review of local git state.
- `/glm:adversarial-review` — steerable, skeptical design review.
- `/glm:rescue` — delegate bugs/refactors/implementation to GLM with full edit permissions; supports `--background`, `--wait`, `--resume`, `--fresh`, `--model`.
- `/glm:transfer` — seed a GLM session from the current Claude transcript.
- `/glm:status`, `/glm:result`, `/glm:cancel` — background-job lifecycle.
- `/glm:setup` — readiness check and review-gate toggle.
- `glm:glm-rescue` subagent.
- `glm-5-2-prompting` skill with review and rescue prompt templates.
- Optional Stop-hook review gate (`/glm:setup --enable-review-gate`).
- JSON job store at `~/.glm-plugin/jobs/`.
- Project layout, command surface, and review-gate design adapted from `openai/codex-plugin-cc`.

### Verified

- Phase 0 spike: headless `claude -p` against `https://api.z.ai/api/anthropic` handles chat, streaming, and tool use against GLM-5.2.
- End-to-end: foreground review, background review + status/result/cancel, read-write rescue with autonomous file edits, transfer pipeline, gate hook no-op behavior.

[Unreleased]: https://github.com/radityasurya/glm-plugin-cc/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/radityasurya/glm-plugin-cc/releases/tag/v0.1.0
