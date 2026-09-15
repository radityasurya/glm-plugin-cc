---
name: cancel
description: Abort a running GLM job by id (or the most recent job if no id is given). Stops the worker, its claude process, and everything claude started, then marks the job cancelled.
---

# /glm:cancel

Stops a background or in-flight GLM job.

## Usage

```
/glm:cancel [job-id]
```

Marks the job `cancelled`, then sends `SIGTERM` to the worker, its `claude -p` process, and every process that claude started (tool shells, test runs, dev servers). Anything still running after 3 seconds gets `SIGKILL`. If a process survives both, the command lists its pid and exits non-zero.

A job that is not running is left unchanged.

Behind the scenes this calls:

```
${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs cancel [job-id]
```
