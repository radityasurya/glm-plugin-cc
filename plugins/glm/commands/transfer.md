---
name: transfer
description: Hand the current Claude Code session off to a resumable GLM-5.2 thread. Renders a prior Claude transcript and starts a GLM session continuing that work.
---

# /glm:transfer

Transfers context from a prior Claude Code transcript into a fresh GLM-5.2 session you can resume later with `/glm:rescue`.

## Usage

```
/glm:transfer [--source <claude-jsonl>]
```

`--source` must point at a Claude transcript jsonl (typically under `~/.claude/projects`). The tool renders user/assistant turns into a continuation prompt and starts GLM-5.2 against it.

Behind the scenes this calls:

```
${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs transfer --source <path>
```
