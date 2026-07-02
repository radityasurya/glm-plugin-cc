---
name: result
description: Fetch the result (and metadata) of a GLM job. Pass a job id, or omit for the most recent job.
---

# /glm:result

Retrieves the output of a delegated GLM job as JSON (id, status, result, sessionId, costUsd, error).

## Usage

```
/glm:result [job-id]
```

Behind the scenes this calls:

```
${CLAUDE_PLUGIN_ROOT}/scripts/glm-broker.mjs result [job-id]
```
