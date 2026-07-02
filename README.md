# glm-plugin-cc

Use GLM-5.2 (z.ai) from inside Claude Code for code reviews or to delegate tasks.

This plugin spawns headless `claude -p` pointed at z.ai's Anthropic-compatible endpoint, so your primary Claude session stays on Anthropic while GLM-5.2 handles the delegated work.

## What you get

| Command | What it does |
|---|---|
| `/glm:review` | Read-only, non-destructive code-quality review of local git state. |
| `/glm:adversarial-review` | Skeptical design review that challenges the approach, tradeoffs, auth, and reliability. |
| `/glm:rescue` | Delegate active debugging, multi-file refactors, or implementation loops to GLM with full edit/test permissions. |
| `/glm:transfer` | Hand the current Claude Code session off to a resumable GLM thread. |
| `/glm:status` | Check the status of a GLM job (or list recent jobs). |
| `/glm:result` | Fetch the result of a GLM job. |
| `/glm:cancel` | Abort a running GLM job. |
| `/glm:setup` | Check readiness and toggle the review gate. |

## Requirements

- A **z.ai GLM Coding Plan** OR a **z.ai API key**.
- **Node.js 18.18+**.
- The **`claude` CLI** installed and logged in normally (used for your primary Claude session; the plugin reuses the binary headless against z.ai).

## Auth setup

GLM needs an API key. Provide it via either:

- an environment variable:

  ```sh
  export ZAI_API_KEY=...
  ```

  (or `ZA_API_KEY`, checked as a fallback), **or**

- a key file:

  ```sh
  mkdir -p ~/.config/zai && echo -n 'YOUR_KEY' > ~/.config/zai/api-key
  ```

Run `/glm:setup` after install to verify the key is found.

## Install

> Replace `YOUR_GITHUB_USER/glm-plugin-cc` with your marketplace URL.

```text
/plugin marketplace add YOUR_GITHUB_USER/glm-plugin-cc
/plugin install glm@glm
/reload-plugins
/glm:setup
```

`/glm:setup` prints whether the key and `claude` binary were found, and runs a tiny readiness probe if you want.

## How it works

The plugin does **not** call the z.ai API directly. Instead, `glm-broker.mjs` spawns a headless `claude -p` subprocess with the environment redirected to z.ai's Anthropic-compatible endpoint:

- `ANTHROPIC_BASE_URL` → `https://api.z.ai/api/anthropic`
- `ANTHROPIC_AUTH_TOKEN` → your z.ai key
- `ANTHROPIC_MODEL` → `glm-5.2`
- `ANTHROPIC_API_KEY` → cleared (so Claude uses the auth token)

Your primary Claude session keeps running against Anthropic; only the delegated subprocess talks to z.ai. Reviews run in plan mode (read-only). `/glm:rescue` runs with full permissions so GLM can edit, run tests, and run lint.

## Usage examples

### Code review before shipping

```text
/glm:review --wait --scope working-tree
```

GLM inspects the current diff and returns findings. No edits are made.

### Adversarial design review

```text
/glm:adversarial-review --base main "focus on auth and rate limiting"
```

GLM challenges the approach against the base branch, with the appended focus text steering it.

### Delegate a refactor (background)

```text
/glm:rescue --background "extract the retry logic in src/client.rs into a RetryPolicy struct"
```

Returns a job id immediately. Check on it with `/glm:status <job-id>` and fetch output with `/glm:result <job-id>`.

### Continue a prior rescue session

```text
/glm:rescue --resume <session-id> "now add tests for RetryPolicy"
```

By default `/glm:rescue` continues the most recent finished rescue session for the current repo; pass `--fresh` to start clean.

### Transfer a Claude session into GLM

```text
/glm:transfer --source ~/.claude/projects/<proj>/<session>.jsonl
```

Renders the transcript into a continuation prompt and starts a GLM session. Resume it later with `/glm:rescue --resume <session-id>`.

## Review gate

`/glm:setup --enable-review-gate` installs a **Stop hook** that has GLM review Claude's output before each stop, so broken code or weak design assumptions get challenged before the turn ends.

```text
/glm:setup --enable-review-gate
```

Disable with `/glm:setup --disable-review-gate`.

> **Warning: feedback loops.** The review gate runs GLM at every stop. If GLM repeatedly asks for changes, Claude will keep iterating and the loop can run for many turns and rack up z.ai cost. The gate is off by default. Turn it on only when you want strong quality enforcement, and keep an eye on the first few stops to confirm the two models converge rather than argue.

## Config

- **Model** defaults to `glm-5.2`. Override per call with `--model <id>` on `/glm:rescue` and `/glm:review`.
- Job state lives under `~/.glm-plugin/jobs/`.
- Settings live in `~/.glm-plugin/settings.json`.

## License

Apache-2.0. See [LICENSE](LICENSE).
