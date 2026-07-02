import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync } from "node:fs";
import { JOBS_DIR } from "./config.mjs";

export function ensureDirs() {
  mkdirSync(JOBS_DIR, { recursive: true });
}

export function jobPath(id) {
  return `${JOBS_DIR}/${id}.json`;
}

export function jobStreamPath(id) {
  return `${JOBS_DIR}/${id}.stream.jsonl`;
}

export function createJob({ id, kind, pid, sessionId, prompt, model }) {
  ensureDirs();
  const job = {
    id,
    kind,
    pid: pid ?? null,
    status: "running",
    sessionId: sessionId || null,
    model: model || null,
    prompt,
    createdAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null,
    costUsd: null,
  };
  writeFileSync(jobPath(id), JSON.stringify(job, null, 2));
  return job;
}

function processAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isJobProcessAlive(job) {
  return job.status === "running" && processAlive(job.pid);
}

export function getJob(id) {
  const p = jobPath(id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function listJobs(limit = 20) {
  if (!existsSync(JOBS_DIR)) return [];
  return readdirSync(JOBS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .map((id) => getJob(id))
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function updateJob(id, patch) {
  const job = getJob(id);
  if (!job) return null;
  Object.assign(job, patch);
  writeFileSync(jobPath(id), JSON.stringify(job, null, 2));
  return job;
}

export function appendStream(id, line) {
  ensureDirs();
  appendFileSync(jobStreamPath(id), line + "\n");
}
