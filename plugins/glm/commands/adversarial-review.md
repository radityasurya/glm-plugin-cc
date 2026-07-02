---
name: adversarial-review
description: Run a skeptical design review with GLM-5.2 that challenges the approach, tradeoffs, auth, and reliability of local changes. Append focus text to steer it.
---

# /glm:adversarial-review

Delegates a skeptical, design-level review to GLM-5.2.

## Usage

```
/glm:adversarial-review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [focus ...]
```

GLM runs in plan mode and is instructed to challenge assumptions, surface failure modes, and question tradeoffs. Append focus text after the flags to steer the review.

Behind the scenes this calls:

```
${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs run --kind adversarial-review --prompt-file <rendered>
```
