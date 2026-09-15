import { spawnSync } from "node:child_process";
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

export function createJob({ id, kind, pid, sessionId, prompt, model, cwd }) {
  ensureDirs();
  const job = {
    id,
    kind,
    pid: pid ?? null,
    childPid: null,
    status: "running",
    sessionId: sessionId || null,
    model: model || null,
    cwd: cwd || null,
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

// pid -> { ppid, zombie } for every process, from one `ps` snapshot (Linux and macOS).
export function processTable() {
  const r = spawnSync("ps", ["-A", "-o", "pid=,ppid=,stat="], { encoding: "utf8" });
  const table = new Map();
  for (const line of (r.stdout || "").split("\n")) {
    const [pid, ppid, stat] = line.trim().split(/\s+/);
    if (pid) table.set(Number(pid), { ppid: Number(ppid), zombie: (stat || "").startsWith("Z") });
  }
  return table;
}

// The roots that exist plus all their descendants, traced by parent pid. Collect
// before killing anything: once a parent dies, its children are re-parented to
// init and can no longer be traced back.
export function processTree(table, roots) {
  const tree = new Set(roots.filter((pid) => table.has(pid)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [pid, { ppid }] of table) {
      if (!tree.has(pid) && tree.has(ppid)) {
        tree.add(pid);
        grew = true;
      }
    }
  }
  return [...tree];
}

// SIGTERM every process in the roots' trees, SIGKILL whatever is still running after
// graceMs, and return the pids that survived both. A job's tree cannot be stopped as a
// process group: claude runs each Bash tool shell as its own session leader.
// ponytail: a descendant that already daemonized (re-parented to init) is not traced.
export async function killTree(roots, { graceMs = 3000 } = {}) {
  const wanted = roots.filter((pid) => pid && pid !== process.pid);
  const pids = processTree(processTable(), wanted);
  const signal = (list, sig) => {
    for (const pid of list) {
      try {
        process.kill(pid, sig);
      } catch {
        /* already gone */
      }
    }
  };
  const alive = () => {
    const table = processTable();
    return pids.filter((pid) => table.has(pid) && !table.get(pid).zombie);
  };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  signal(pids, "SIGTERM");
  const deadline = Date.now() + graceMs;
  while (alive().length && Date.now() < deadline) await pause(100);
  signal(alive(), "SIGKILL");
  await pause(100);
  return alive();
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
