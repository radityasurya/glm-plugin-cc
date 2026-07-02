# Development

## Setup

```sh
git clone <your-fork>/glm-plugin-cc
cd glm-plugin-cc
pnpm install
```

You need a z.ai key for live testing (tests themselves never hit the network):

```sh
export ZAI_API_KEY=...
# or
mkdir -p ~/.config/zai && echo -n 'YOUR_KEY' > ~/.config/zai/api-key
```

## Tests

```sh
pnpm test           # run once
pnpm test:watch     # watch mode
```

Tests live in `tests/`:

| File | Covers |
|---|---|
| `config.test.mjs` | auth resolution, env building, settings roundtrip |
| `state.test.mjs` | job create/get/update/list, stream append (tmp `PLUGIN_DIR`) |
| `broker-endpoint.test.mjs` | `runClaude` with mocked `spawn` emitting fake stream-json |
| `commands.test.mjs` | every command `.md` has frontmatter + broker reference |

All external surfaces (`spawn`, `spawnSync`, `node:fs`, `node:child_process`) are stubbed. No network. No real `claude` invocation.

## Live end-to-end checks

These do hit z.ai and consume your plan balance:

```sh
# readiness
node plugins/glm/scripts/glm-broker.mjs setup --check

# foreground review (needs a git repo with a diff)
node plugins/glm/scripts/glm-broker.mjs run --kind review --prompt-file <(git diff) --wait

# background + status + result
OUT=$(node plugins/glm/scripts/glm-broker.mjs run --kind review --background --prompt-file <(git diff))
ID=$(echo "$OUT" | node -pe "JSON.parse(require('fs').readFileSync(0)).id")
node plugins/glm/scripts/glm-broker.mjs status "$ID"
node plugins/glm/scripts/glm-broker.mjs result "$ID"

# rescue (read-write — GLM will edit files)
node plugins/glm/scripts/glm-broker.mjs run --kind rescue --prompt "fix the bug in foo.py" --wait
```

## Layout conventions

- Scripts are ESM (`.mjs`), node >=18.18.
- The broker (`glm-broker.mjs`) is both a library (exports `runClaude`) and a CLI. The CLI dispatch is guarded by a main-module check so the gate hook can import `runClaude` without triggering CLI behavior.
- Job state is JSON + JSONL on disk — no native deps (no `better-sqlite3`). This keeps the plugin dependency-free.
- Command `.md` files instruct the **primary Claude** on what to do; they are not executed directly. Keep their prose operational and reference `${CLAUDE_PLUGIN_ROOT}` and `$ARGUMENTS` exactly.

## Adding a command

1. Add `plugins/glm/commands/<name>.md` with frontmatter (`description`, `argument-hint`, `disable-model-invocation: true`, `allowed-tools`).
2. If it needs broker support beyond the existing subcommands, extend `glm-broker.mjs` and add a `cmds.<name>` entry.
3. Add a smoke assertion in `tests/commands.test.mjs`.
4. Document it in `README.md`.

## Releasing

Bump `version` in `package.json` and `plugins/glm/CHANGELOG.md` (or root CHANGELOG), tag, push. Users update via `/plugin marketplace update`.

## Relationship to codex-plugin-cc

Layout, command surface, and hook patterns intentionally mirror `openai/codex-plugin-cc`. If you've contributed to that repo, the structure here will be familiar. The divergence is entirely in `scripts/` — our broker spawns `claude` at z.ai instead of wrapping the Codex app-server. When porting a future upstream change from codex-plugin-cc, the command/agent/prompt files map 1:1; only the script invocations need translating.
