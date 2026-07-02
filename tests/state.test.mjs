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
      model: "glm-5.2",
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
});
