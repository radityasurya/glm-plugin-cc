# Stop Review Gate

Reference note. The actual logic lives in `plugins/glm/hooks/stop-review-gate-hook.mjs`, wired into the Claude Code `Stop` event via `hooks/hooks.json`.

## Behavior

When the review gate is enabled (`/glm:setup --enable-review-gate`), the Stop hook runs at the end of every Claude turn. It captures what Claude produced, hands it to GLM-5.2 for a quick challenge pass, and surfaces objections before the turn is allowed to end — so broken code, weak design assumptions, or missed edge cases do not reach the user unvetted.

Disable with `/glm:setup --disable-review-gate`. Check current state with `/glm:setup --check`.

This file documents intent only. Do not edit it to change gate behavior — edit the hook script.
