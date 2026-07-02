---
name: cancel
description: Abort a running GLM job by id (or the most recent job if no id is given). Kills the worker process and marks the job cancelled.
---

# /glm:cancel

Stops a background or in-flight GLM job.

## Usage

```
/glm:cancel [job-id]
```

Sends `SIGTERM` to the worker process and marks the job `cancelled`.

Behind the scenes this calls:

```
${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs cancel [job-id]
```
