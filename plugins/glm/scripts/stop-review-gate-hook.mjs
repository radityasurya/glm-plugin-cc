#!/usr/bin/env node
// stop-review-gate-hook.mjs — when the review gate is enabled, runs a GLM review of
// Claude's just-produced response. If GLM finds blocking issues, the stop is denied
// so Claude can address them first.
import { existsSync, readFileSync } from "node:fs";
import { readSettings } from "./config.mjs";
import { runClaude } from "./glm-broker.mjs";

let stdin = "";
for await (const chunk of process.stdin) stdin += chunk;

let payload = {};
try {
  payload = JSON.parse(stdin);
} catch {
  // ignore
}

const settings = readSettings();
if (!settings.reviewGate) {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

const hookEventName = payload.hook_event_name || "";
if (hookEventName && hookEventName !== "Stop") {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

const transcriptPath = payload.transcript_path;
if (!transcriptPath || !existsSync(transcriptPath)) {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

// Read last assistant turn from the transcript.
let lastAssistant = "";
try {
  const lines = readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const evt = JSON.parse(lines[i]);
    if (evt.type === "assistant") {
      const msg = evt.message || evt;
      const text = Array.isArray(msg.content)
        ? msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n")
        : msg.content;
      if (text) {
        lastAssistant = text;
        break;
      }
    }
  }
} catch {
  /* ignore */
}

if (!lastAssistant || lastAssistant.length < 50) {
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
}

const prompt = `You are a review gate. Claude Code just finished a turn. Below is its final response.
Check it for: correctness bugs, security issues, missing error handling, broken assumptions,
or incomplete work. If there are BLOCKING problems that would ship broken code, return JSON
with verdict "block" and a short reason. Otherwise verdict "approve".

Be strict about real bugs but do NOT block on style, nits, or personal preference.
If the response is a question, plan, or explanation (no code change implied), approve.

Respond ONLY with JSON matching this schema:
{"verdict":"approve|block","summary":"...","findings":[{"severity":"...","message":"..."}]}

Claude's response:
"""
${lastAssistant.slice(0, 12000)}
"""`;

try {
  const res = await runClaude({ prompt, readWrite: false });
  const match = res.result.match(/\{[\s\S]*\}/);
  if (match) {
    const parsed = JSON.parse(match[0]);
    if (parsed.verdict === "block") {
      const reason = parsed.summary || parsed.findings?.map((f) => f.message).join("; ") || "GLM flagged blocking issues";
      process.stdout.write(JSON.stringify({
        decision: "block",
        reason: `[GLM review gate] ${reason}`,
      }));
      process.exit(0);
    }
  }
} catch (err) {
  // gate failures should never block the user
  process.stderr.write(`review gate skipped: ${err.message}\n`);
}

process.stdout.write(JSON.stringify({}));
