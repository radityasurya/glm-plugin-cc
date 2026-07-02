---
name: glm-rescue
description: Subagent that delegates active debugging, multi-file refactors, or implementation loops to GLM-5.2 via the glm plugin's broker. Use for tasks you want to run against GLM rather than the primary model.
tools: Bash, Read, Grep, Glob
---

# glm-rescue subagent

This subagent shells out to the GLM-5.2 broker to run a delegated task. It exists so that other agents and workflows can hand work off to GLM through the same code path as the `/glm:rescue` command.

## What it does

1. Renders the task into a prompt file.
2. Invokes `${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs run --kind rescue --prompt-file <path>` (foreground `--wait` by default).
3. Streams the result back to the caller.

## When to use it

- Long-running refactors where GLM-5.2's thoroughness is an asset.
- Batch/mechanical implementation work you want off the primary model.
- Tasks with a concrete definition of done.

## What NOT to use it for

- Read-only reviews — use `/glm:review` or `/glm:adversarial-review` instead.
- Anything requiring Claude-specific features (artifacts, computer use).

The broker manages job state under `~/.glm-plugin/jobs/`; resume prior sessions with `--resume <session-id>`.
