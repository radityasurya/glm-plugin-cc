---
name: status
description: Check the status of GLM jobs. Pass a job id for one job, or omit to list recent jobs.
---

# /glm:status

Reports the state of delegated GLM work.

## Usage

```
/glm:status [job-id]
```

With a job id: prints that job's status, model, session, cost, and error. Without: lists the most recent 20 jobs (newest first).

Behind the scenes this calls:

```
${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs status [job-id]
```
