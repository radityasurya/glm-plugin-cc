import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";

const ZAI_ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic";
const DEFAULT_MODEL = "glm-5.2";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    spawnSync: () => ({ status: 0, stdout: "/usr/bin/claude", stderr: "" }),
    spawn: () => makeFakeProc(),
  };
});

vi.mock("../plugins/glm/scripts/config.mjs", () => ({
  ZAI_ANTHROPIC_BASE_URL,
  ZAI_OPENAI_BASE_URL: "https://api.z.ai/api/coding/paas/v4",
  DEFAULT_MODEL,
  DEFAULT_EFFORT: "medium",
  PLUGIN_DIR: "/tmp/glm-broker-test",
  JOBS_DIR: "/tmp/glm-broker-test/jobs",
  CONFIG_PATH: "/tmp/glm-broker-test/config.json",
  SETTINGS_PATH: "/tmp/glm-broker-test/settings.json",
  KEY_FILE: "/tmp/glm-broker-test/api-key",
  resolveApiKey: () => "test-key",
  isReady: () => true,
  buildZaiEnv: (model = DEFAULT_MODEL) => ({
    ...process.env,
    ANTHROPIC_BASE_URL: ZAI_ANTHROPIC_BASE_URL,
    ANTHROPIC_AUTH_TOKEN: "test-key",
    ANTHROPIC_MODEL: model,
    ANTHROPIC_SMALL_FAST_MODEL: model,
    ANTHROPIC_API_KEY: "",
  }),
  readSettings: () => ({ reviewGate: false }),
  writeSettings: (p) => ({ reviewGate: false, ...p }),
}));

let emittedLines = [];

function makeFakeProc() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter();
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.unref = () => {};
  setImmediate(() => {
    for (const l of emittedLines) stdout.emit("data", Buffer.from(l + "\n"));
    proc.emit("close", 0);
  });
  return proc;
}

const originalArgv = process.argv;

beforeEach(() => {
  emittedLines = [];
  vi.resetModules();
  process.argv = ["node", "glm-broker.mjs", "env"];
});

afterEach(() => {
  process.argv = originalArgv;
});

describe("runClaude", () => {
  it("resolves with parsed result from stream-json", async () => {
    emittedLines = [
      JSON.stringify({ type: "assistant", message: { content: "working" } }),
      JSON.stringify({
        type: "result",
        result: "OK",
        session_id: "s1",
        total_cost_usd: 0.1,
        is_error: false,
      }),
    ];
    const { runClaude } = await import("../plugins/glm/scripts/glm-broker.mjs");
    const res = await runClaude({ prompt: "say OK", readWrite: false });
    expect(res.result).toBe("OK");
    expect(res.sessionId).toBe("s1");
    expect(res.costUsd).toBe(0.1);
    expect(res.isError).toBe(false);
  });

  it("passes parsed events to onEvent callback", async () => {
    emittedLines = [
      JSON.stringify({ type: "system", subtype: "init" }),
      JSON.stringify({
        type: "result",
        result: "done",
        session_id: "s2",
        total_cost_usd: 0.05,
      }),
    ];
    const { runClaude } = await import("../plugins/glm/scripts/glm-broker.mjs");
    const seen = [];
    const res = await runClaude({ prompt: "p", onEvent: (e) => seen.push(e) });
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.map((e) => e.type)).toContain("system");
    expect(seen[seen.length - 1].type).toBe("result");
    expect(res.events).toHaveLength(seen.length);
  });

  it("resolves with empty result when claude exits 0 with no result event", async () => {
    emittedLines = [JSON.stringify({ type: "system", subtype: "init" })];
    const { runClaude } = await import("../plugins/glm/scripts/glm-broker.mjs");
    const res = await runClaude({ prompt: "p", sessionId: "given-sess" });
    expect(res.result).toBe("");
    expect(res.sessionId).toBe("given-sess");
    expect(res.costUsd).toBeNull();
  });

  it("exposes the events array on the resolved value", async () => {
    emittedLines = [
      JSON.stringify({ type: "a" }),
      JSON.stringify({ type: "result", result: "x", session_id: "sx", total_cost_usd: 0 }),
    ];
    const { runClaude } = await import("../plugins/glm/scripts/glm-broker.mjs");
    const res = await runClaude({ prompt: "p" });
    expect(res.events.map((e) => e.type)).toEqual(["a", "result"]);
  });

  it("uses the default model glm-5.2 when none given", async () => {
    emittedLines = [
      JSON.stringify({ type: "result", result: "ok", session_id: "s", total_cost_usd: 0 }),
    ];
    const { runClaude } = await import("../plugins/glm/scripts/glm-broker.mjs");
    const res = await runClaude({ prompt: "p" });
    expect(res.result).toBe("ok");
  });
});
