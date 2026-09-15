# Architecture

## Goal

Delegate work from Claude Code (primary session on Anthropic) to GLM-5.2 (z.ai), without writing a custom agent runtime.

## The key trick

z.ai exposes an **Anthropic-Messages-compatible** endpoint at `https://api.z.ai/api/anthropic`. Claude Code's own CLI, run headless (`claude -p`), is an Anthropic-Messages client. So instead of building a broker that reimplements the agent loop, tool calling, and session management, `glm-plugin-cc` just spawns `claude -p` with its environment redirected:

```
ANTHROPIC_BASE_URL         = https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN       = <z.ai key>
ANTHROPIC_MODEL            = glm-5.2
ANTHROPIC_SMALL_FAST_MODEL = glm-5.2
ANTHROPIC_API_KEY          = ""   (cleared so the token wins)
```

These vars are set **only on the subprocess**; the primary Claude session is untouched.

This is the GLM analog of how `codex-plugin-cc` wraps the Codex CLI. Codex ships its own CLI + app-server; GLM ships no CLI, so we reuse the `claude` CLI the user already has.

## Component layout

```
plugins/glm/
├── commands/*.md        Slash commands (instructions for the primary Claude)
├── agents/glm-rescue.md Subagent definition
├── prompts/*.md         Review/adversarial prompt templates
├── schemas/             JSON schema for structured review output
├── hooks/hooks.json     SessionStart + Stop hook wiring
├── scripts/
│   ├── glm-broker.mjs            ← the broker (CLI + runClaude)
│   ├── config.mjs                ← auth resolution + z.ai env builder
│   ├── state.mjs                 ← job store (~/.glm-plugin/jobs/)
│   ├── session-lifecycle-hook.mjs← captures transcript path on SessionStart
│   └── stop-review-gate-hook.mjs ← optional Stop-hook GLM review
└── skills/glm-5-2-prompting/     Prompting guidance loaded on demand
```

## Request flow

### Foreground review

```
/glm:review --wait
  → primary Claude gathers git diff (per command .md instructions)
  → writes prompt to $TMPFILE
  → Bash: node glm-broker.mjs run --kind review --prompt-file $TMPFILE --wait
      → broker builds z.ai env (config.mjs)
      → spawns: claude -p <prompt> --output-format stream-json --verbose --permission-mode plan
      → streams events to ~/.glm-plugin/jobs/<id>.stream.jsonl
      → parses final {"type":"result"} → extracts result + session_id + cost
      → updates job.json
  → broker prints result to stdout
  → primary Claude returns it verbatim
```

### Background rescue

```
/glm:rescue --background "<task>"
  → broker createJob(id, kind=rescue)
  → spawn(detached) node glm-broker.mjs _worker <id> <promptfile> <opts>
  → parent unref()s and prints {"id","pid","background":true}
  → worker (continues after parent exits):
      → runClaude(--dangerously-skip-permissions)   # full edit/bash
      → appendStream each event
      → on completion, updateJob(status=finished, result, sessionId, cost)
```

### Stop review gate

```
Claude finishes a turn → Stop hook fires
  → stop-review-gate-hook.mjs reads ~/.glm-plugin/settings.json
  → if reviewGate disabled → exit 0 (no-op)
  → else read last assistant message from transcript
  → runClaude(prompt="is this blocking?", plan mode)
  → if GLM returns {"verdict":"block"} → exit with {decision:"block", reason}
      → Claude Code denies the stop, Claude must iterate
  → else → exit 0
```

## Job state

Jobs live in `~/.glm-plugin/jobs/`:

- `<id>.json` — job record: `{id, kind, pid, childPid, status, sessionId, model, cwd, prompt, createdAt, finishedAt, result, error, costUsd}`
- `<id>.stream.jsonl` — raw stream-json events from the `claude -p` run

`pid` is the worker (or the foreground broker); `childPid` is the `claude -p` process it spawned. `cwd` is the repo the job ran in.

The worker is **authoritative** for status transitions, with one exception: `cancel` sets `cancelled` before it stops the processes, and the worker never overwrites a `cancelled` status. `getJob` does not optimistically mark a job finished based on pid liveness (an earlier version did, and it raced the worker). `status` shows an advisory `(not responding)` line if a running job's pid is not alive, so crashed workers are visible without false positives.

## Cancel model

`claude -p` starts each Bash tool shell as its own session leader, so the shells, and the test runs or dev servers inside them, are not in the worker's process group. `cancel` therefore snapshots the process table with `ps`, collects every descendant of `pid` and `childPid` by parent pid, sends `SIGTERM`, and sends `SIGKILL` to anything still alive after 3 seconds. `childPid` is a separate root because a killed worker leaves its `claude` child re-parented to init. The worker also traps `SIGTERM`/`SIGINT` and stops its own child tree, so a plain `kill` of the worker does not orphan claude either.

A process that daemonized before the cancel (re-parented to init) cannot be traced and is not stopped.

## Resume model

`claude -p --resume <session-id>` continues a prior session by its UUID. The broker captures the session id from each run's stream result and stores it on the job. `/glm:rescue --resume <id>` passes it through.

When neither `--resume` nor `--fresh` is given for a rescue, the broker auto-continues the newest finished rescue job that has the same `cwd`, the same model, and a `finishedAt` within the last 6 hours (`RESUME_MAX_AGE_MS`). Jobs recorded before `cwd` was stored never match. If `claude` reports `No conversation found with session ID` for the resumed id, the worker notes it in the stream and runs the prompt again as a fresh session.

## Auth resolution order

1. `ZAI_API_KEY` env var
2. `ZA_API_KEY` env var (fallback alias)
3. `~/.config/zai/api-key` file
4. error → tell the user to run `/glm:setup`

## Why not call the z.ai API directly?

It's an option (Path B in the original design doc). It would mean reimplementing, in the broker:

- The Anthropic Messages request/response loop
- Tool-call dispatch (read/write/edit/bash/grep/glob)
- Permission gating
- Streaming parse
- Session persistence

All of that already exists inside `claude`. Reusing it cost ~150 LOC instead of ~1000, and inherited Claude Code's tool ecosystem for free. The trade-off: a hard dependency on the `claude` binary. If you want a standalone runtime, that's the Path B fork.

## Verification (Phase 0 spike)

Before building, we confirmed against live GLM-5.2:

- plain chat: ✅
- `--output-format stream-json`: ✅
- tool use (`tool_use` → `tool_result` → continuation): ✅
- multi-turn: ✅
- resumable `session_id`: ✅

These five passing are what de-risked the whole approach.
