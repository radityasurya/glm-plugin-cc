#!/usr/bin/env node
// session-lifecycle-hook.mjs — captures the current transcript path so /glm:transfer
// can replay the session into a GLM-backed claude subprocess.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { PLUGIN_DIR } from "./config.mjs";

const out = { sessionContext: {} };

let stdin = "";
for await (const chunk of process.stdin) stdin += chunk;

let payload = {};
try {
  payload = JSON.parse(stdin);
} catch {
  // no payload, nothing to do
}

const transcriptPath =
  payload.transcript_path || payload.transcriptPath || process.env.CLAUDE_TRANSCRIPT_PATH;

if (transcriptPath) {
  const stateDir = `${PLUGIN_DIR}/state`;
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(`${stateDir}/current-transcript.json`, JSON.stringify({
    transcriptPath,
    capturedAt: Date.now(),
    cwd: payload.cwd || process.cwd(),
    sessionId: payload.session_id || payload.sessionId || null,
  }, null, 2));
  out.sessionContext.transcriptPath = transcriptPath;
}

process.stdout.write(JSON.stringify(out));
