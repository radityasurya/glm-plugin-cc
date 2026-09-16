import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { makeTempPluginDir, clearDir, mockConfig } from "./helpers.mjs";

let tmpDir;

beforeEach(() => {
  tmpDir = makeTempPluginDir();
  vi.resetModules();
  vi.doMock("../plugins/glm/scripts/config.mjs", () => ({
    default: {},
    ...mockConfig(tmpDir),
  }));
});

afterEach(async () => {
  vi.doUnmock("../plugins/glm/scripts/config.mjs");
  vi.resetModules();
  await clearDir(tmpDir);
});

async function loadState() {
  return import("../plugins/glm/scripts/state.mjs");
}

describe("state", () => {
  it("createJob writes a job file with status running and returns the job", async () => {
    const state = await loadState();
    const job = state.createJob({
      id: "job-1",
      kind: "rescue",
      prompt: "fix the bug",
      model: "glm-5.3",
    });
    expect(job.id).toBe("job-1");
    expect(job.status).toBe("running");
    expect(job.prompt).toBe("fix the bug");
    expect(existsSync(state.jobPath("job-1"))).toBe(true);
  });

  it("getJob reads the job back from disk", async () => {
    const state = await loadState();
    state.createJob({ id: "job-2", kind: "rescue", prompt: "p" });
    const job = state.getJob("job-2");
    expect(job).not.toBeNull();
    expect(job.id).toBe("job-2");
  });

  it("getJob returns null for missing job", async () => {
    const state = await loadState();
    expect(state.getJob("nope")).toBeNull();
  });

  it("updateJob patches fields and persists", async () => {
    const state = await loadState();
    state.createJob({ id: "job-3", kind: "rescue", prompt: "p" });
    const updated = state.updateJob("job-3", { status: "finished", result: "done" });
    expect(updated.status).toBe("finished");
    expect(updated.result).toBe("done");
    const reread = JSON.parse(readFileSync(state.jobPath("job-3"), "utf8"));
    expect(reread.status).toBe("finished");
    expect(reread.result).toBe("done");
  });

  it("updateJob returns null for missing job", async () => {
    const state = await loadState();
    expect(state.updateJob("missing", { status: "x" })).toBeNull();
  });

  it("listJobs returns jobs sorted by createdAt desc", async () => {
    const state = await loadState();
    state.createJob({ id: "old", kind: "rescue", prompt: "p" });
    await new Promise((r) => setTimeout(r, 5));
    state.createJob({ id: "new", kind: "rescue", prompt: "p" });
    const jobs = state.listJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs[0].id).toBe("new");
    expect(jobs[1].id).toBe("old");
  });

  it("listJobs respects limit", async () => {
    const state = await loadState();
    for (let i = 0; i < 5; i++) {
      state.createJob({ id: `j${i}`, kind: "rescue", prompt: "p" });
      await new Promise((r) => setTimeout(r, 2));
    }
    expect(state.listJobs(2)).toHaveLength(2);
  });

  it("appendStream appends lines to the stream file", async () => {
    const state = await loadState();
    state.appendStream("job-s", JSON.stringify({ type: "a" }));
    state.appendStream("job-s", JSON.stringify({ type: "b" }));
    const content = readFileSync(state.jobStreamPath("job-s"), "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).type).toBe("a");
    expect(JSON.parse(lines[1]).type).toBe("b");
  });

  it("ensureDirs creates the jobs directory", async () => {
    const state = await loadState();
    state.ensureDirs();
    expect(existsSync(join(tmpDir, "jobs"))).toBe(true);
  });

  it("jobPath and jobStreamPath are rooted under JOBS_DIR", async () => {
    const state = await loadState();
    expect(state.jobPath("xyz")).toContain(join(tmpDir, "jobs", "xyz.json"));
    expect(state.jobStreamPath("xyz")).toContain(
      join(tmpDir, "jobs", "xyz.stream.jsonl")
    );
  });

  it("createJob records the cwd, and childPid starts empty", async () => {
    const state = await loadState();
    const job = state.createJob({ id: "job-cwd", kind: "rescue", prompt: "p", cwd: "/repo" });
    expect(job.cwd).toBe("/repo");
    expect(state.getJob("job-cwd").childPid).toBeNull();
  });
});

describe("process tree", () => {
  it("processTree follows every generation and skips unrelated or missing pids", async () => {
    const state = await loadState();
    const table = new Map([
      [10, { ppid: 1 }],
      [11, { ppid: 10 }],
      [12, { ppid: 11 }],
      [13, { ppid: 10 }],
      [20, { ppid: 1 }],
    ]);
    expect(state.processTree(table, [10]).sort((a, b) => a - b)).toEqual([10, 11, 12, 13]);
    expect(state.processTree(table, [99])).toEqual([]);
  });

  it("killTree also stops a descendant that runs in its own session", async () => {
    const state = await loadState();
    const { spawn } = await import("node:child_process");
    // Same shape as claude -p: its Bash tool shells are session leaders, so killing
    // the worker's process group would leave them running.
    const parent = spawn(
      process.execPath,
      [
        "-e",
        [
          'const { spawn } = require("node:child_process");',
          'const g = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });',
          "console.log(g.pid);",
          "setInterval(() => {}, 1000);",
        ].join("\n"),
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    const grandchild = await new Promise((resolve) =>
      parent.stdout.once("data", (d) => resolve(Number(String(d).trim())))
    );

    expect(await state.killTree([parent.pid], { graceMs: 2000 })).toEqual([]);
    const table = state.processTable();
    expect(table.has(grandchild) && !table.get(grandchild).zombie).toBe(false);
  });
});
