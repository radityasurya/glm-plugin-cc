---
description: Run a GLM-5.2 code review against local git state (read-only)
argument-hint: '[--wait|--background] [--base <ref>]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), Bash(mktemp:*), AskUserQuestion
---

Run a GLM-5.2 review of the current work through the glm broker. Return GLM's output verbatim.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraints:
- This command is review-only. Do not fix issues or apply patches.
- Your only job is to run the review and return GLM's output verbatim.

Execution mode rules:
- If args include `--wait`, run in the foreground without asking.
- If args include `--background`, run in a Claude background task without asking.
- Otherwise estimate the review size before asking:
  - Run `git status --short --untracked-files=all`, `git diff --shortstat`, and `git diff --shortstat --cached`.
  - If `--base <ref>` is given, use `git diff --shortstat <base>...HEAD` instead.
  - Treat untracked files as reviewable.
  - Recommend `Wait` only when clearly tiny (1-2 files); otherwise recommend `Background`.
  - Use `AskUserQuestion` exactly once with two options, recommended first: `Wait for results` / `Run in background`.

Gather the diff:
- Working-tree review (default): `git diff HEAD` plus untracked file contents.
- Branch review (`--base <ref>`): `git diff <base>...HEAD`.
- Write the full prompt to a temp file: `PROMPT=$(mktemp)` then write a review request containing the diff to that file.

Foreground flow:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs" run --kind review --prompt-file "$PROMPT" --wait
```
Return the command's stdout verbatim, exactly as-is. Do not paraphrase, summarize, or add commentary.

Background flow:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs" run --kind review --prompt-file "$PROMPT" --background`,
  description: "GLM review",
  run_in_background: true
})
```
After launching, tell the user: "GLM review started in the background. Check `/glm:status` for progress, then `/glm:result`."
