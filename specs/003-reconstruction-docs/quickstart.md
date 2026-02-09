# Quick Start: Reconstruction-Grade Documentation Generator

**Feature**: 003-reconstruction-docs
**Date**: 2026-02-07
**Audience**: Developers and AI agents using the Code Reader MCP system

## Overview

This guide walks through generating reconstruction-grade documentation for a repository from start to finish. By the end, you'll have comprehensive, technology-agnostic documentation suitable for system reconstruction (v2) and governance tool input.

---

## Prerequisites

Before starting, ensure:

1. **Code Reader MCP Server Running**
   ```bash
   npm run dev  # Development mode
   # OR
   npm start    # Production mode
   ```
   Server should be accessible at `http://localhost:3100`

2. **Repository Already Extracted**
   Your target repository must have been processed by the Code Reader system (code chunks and embeddings created). If not:
   ```bash
   curl -X POST http://localhost:3100/task \
     -d '{"repositoryPath": "/path/to/repo", "identifier": "my-repo"}'

   curl -X POST http://localhost:3100/process \
     -d '{"identifier": "my-repo", "fileLimit": 200}'
   ```

3. **MongoDB Running**
   MongoDB 6.0+ on localhost:27017 with `code_reader` database

4. **(Optional) Confluence Access**
   If enriching with Confluence, ensure MCP client has Atlassian authentication configured

---

## Step 1: Create Documentation Plan

Initiate documentation generation for your repository:

```bash
curl -X POST http://localhost:3100/documentation/plan \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryIdentifier": "my-repo",
    "identifier": "my-repo-docs"
  }'
```

**Response**:
```json
{
  "data": {
    "type": "documentation_plan",
    "id": "770f9500-e29b-41d4-a716-446655440100",
    "attributes": {
      "identifier": "my-repo-docs",
      "version": 1,
      "status": "planning",
      "progress": {
        "totalTasks": 25,
        "completedTasks": 0
      }
    },
    "meta": {
      "estimatedDuration": "30-60 minutes"
    }
  }
}
```

**What Happens**:
- System analyzes CLAUDE.md (if present) to understand architecture
- Queries code chunks via `/search_code` to identify domains and features
- Decomposes documentation work into 25 atomic tasks
- Assigns priorities using FoundationalFirst heuristic (architecture → domains → features)
- Persists plan with status "planning" → "executing"

---

## Step 2: (Optional) Configure External Sources

If you want to enrich documentation with Confluence:

```bash
curl -X POST http://localhost:3100/documentation/source/configure \
  -H "Content-Type: application/json" \
  -d '{
    "planIdentifier": "my-repo-docs",
    "sourceType": "confluence",
    "enabled": true,
    "connectionParams": {
      "cloudId": "your-confluence-cloud-id"
    }
  }'
```

**Important**: This does NOT require Confluence credentials. Authentication is handled by your MCP client (e.g., Claude Desktop). The server only stores the cloud ID.

---

## Step 3: Execute Documentation Tasks

Execute tasks incrementally (one at a time):

```bash
# Execute next task
curl -X POST http://localhost:3100/documentation/execute \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-repo-docs"}'
```

**Response**:
```json
{
  "data": {
    "type": "documentation_task",
    "id": "880f9500-e29b-41d4-a716-446655440101",
    "attributes": {
      "domain": "User Authentication",
      "status": "in_progress",
      "priorityScore": 150
    }
  },
  "meta": {
    "planProgress": {
      "completed": 1,
      "remaining": 24,
      "percentComplete": 4
    }
  }
}
```

**What Happens**:
1. System selects highest-priority ready task (dependencies satisfied)
2. Synthesizes documentation from:
   - CLAUDE.md (if available)
   - Code chunks via semantic search
   - Confluence (if configured)
3. Generates structured documentation artifact using Handlebars templates
4. Persists artifact and updates task status to "completed"
5. Returns task details and plan progress

**Task Duration**: Each task takes ~2 minutes average. For a plan with 25 tasks, expect ~50 minutes total (can be interrupted and resumed).

---

## Step 4: Monitor Progress

Check plan status anytime:

```bash
curl http://localhost:3100/documentation/plan/my-repo-docs
```

**Response**:
```json
{
  "data": {
    "attributes": {
      "status": "executing",
      "progress": {
        "totalTasks": 25,
        "completedTasks": 10,
        "failedTasks": 0,
        "currentTask": "880f9500-e29b-41d4-a716-446655440105"
      }
    },
    "relationships": {
      "tasks": [
        {
          "id": "task-1",
          "attributes": {
            "domain": "System Architecture",
            "status": "completed",
            "artifactRef": "artifact-1"
          }
        },
        {
          "id": "task-2",
          "attributes": {
            "domain": "User Authentication",
            "status": "in_progress"
          }
        }
      ]
    }
  }
}
```

**Interpretation**:
- `status: "executing"` → Tasks in progress
- `status: "completed"` → All tasks done, artifacts ready
- `status: "failed"` → At least one task failed (check error details)

---

## Step 5: Retrieve Documentation Artifacts

Once a task completes, retrieve its generated documentation:

```bash
# Get artifact as JSON (full structure)
curl http://localhost:3100/documentation/artifact/artifact-id \
  -H "Accept: application/json"

# Get artifact as Markdown (for file export)
curl http://localhost:3100/documentation/artifact/artifact-id \
  -H "Accept: text/markdown" > user-authentication.md
```

**Artifact Content** (Markdown):
```markdown
# Domain: User Authentication

**Sources**: CLAUDE.md, code chunks (auth-service.ts), Confluence (AUTH-001)
**Generated**: 2026-02-07T12:17:00Z

## Business Rules

- **Session Expiration**: User sessions expire after 24 hours of inactivity
  - Rationale: Security requirement to minimize attack window
  - Sources: CLAUDE.md, code chunks

- **Email Verification**: Users must verify email before login
  - Rationale: Prevent spam accounts and ensure contact validity
  - Sources: code chunks, Confluence

## Program Flows

### Login Flow

User authentication with JWT token generation.

**Steps**:
1. User submits credentials (email + password)
2. System validates against database
3. System generates JWT with user claims (userId, email, roles)
4. System returns token to client (24h expiration)
5. Client includes token in subsequent requests

**Sources**: code chunks (auth-service.ts), Confluence (AUTH-001)

## Domain Models

### User

Represents an authenticated user account.

**Attributes**:
- `userId`: UUID - Unique identifier
- `email`: string - User email address (unique)
- `passwordHash`: string - Bcrypt-hashed password
- `emailVerified`: boolean - Email verification status
- `createdAt`: Date - Account creation timestamp

**Sources**: code chunks (user-model.ts)

## User Stories

### Authenticate User

User provides credentials and receives authentication token for API access.

**Acceptance Criteria**:
- Valid credentials return JWT token with 24h expiration
- Invalid credentials return 401 Unauthorized
- Unverified email returns 403 Forbidden with verification link
- System logs all authentication attempts (success and failure)

**Sources**: Confluence (US-001)

---

**Sources**:
- CLAUDE.md: Lines 45-67
- code chunks: src/services/auth-service.ts (lines 120-145)
- Confluence: Page AUTH-001 (retrieved 2026-02-07T12:16:30Z)
```

---

## Step 6: Resume After Interruption

If execution is interrupted (server restart, stop signal, etc.), resume without reprocessing:

```bash
# Check status first
curl http://localhost:3100/documentation/plan/my-repo-docs

# If status is "executing" and currentTask is not null, resume:
curl -X POST http://localhost:3100/documentation/execute \
  -d '{"identifier": "my-repo-docs"}'
```

**What Happens**:
- System loads plan state from MongoDB
- Skips all completed tasks
- Continues from next ready task
- Zero data loss, zero duplicate work

---

## Full Automation Script

For automated documentation generation (e.g., CI/CD, scheduled jobs):

```bash
#!/bin/bash

# Configuration
REPO_ID="my-repo"
DOCS_ID="my-repo-docs"
API_BASE="http://localhost:3100"

# Step 1: Create plan
echo "Creating documentation plan..."
curl -X POST $API_BASE/documentation/plan \
  -H "Content-Type: application/json" \
  -d "{\"repositoryIdentifier\": \"$REPO_ID\", \"identifier\": \"$DOCS_ID\"}" \
  | jq '.data.attributes.progress.totalTasks' > total_tasks.txt

TOTAL_TASKS=$(cat total_tasks.txt)
echo "Plan created with $TOTAL_TASKS tasks"

# Step 2: Execute all tasks
COMPLETED=0
while [ $COMPLETED -lt $TOTAL_TASKS ]; do
  echo "Executing task $((COMPLETED + 1))/$TOTAL_TASKS..."

  curl -X POST $API_BASE/documentation/execute \
    -H "Content-Type: application/json" \
    -d "{\"identifier\": \"$DOCS_ID\"}" \
    -s | jq -r '.meta.planProgress.completed' > progress.txt

  COMPLETED=$(cat progress.txt)

  # Check for failures
  STATUS=$(curl -s $API_BASE/documentation/plan/$DOCS_ID | jq -r '.data.attributes.status')

  if [ "$STATUS" == "failed" ]; then
    echo "Error: Documentation generation failed"
    exit 1
  fi

  # Brief pause between tasks (optional)
  sleep 2
done

echo "Documentation generation complete!"

# Step 3: Download all artifacts
echo "Downloading artifacts..."
ARTIFACT_IDS=$(curl -s $API_BASE/documentation/plan/$DOCS_ID \
  | jq -r '.data.relationships.tasks[] | select(.attributes.status=="completed") | .attributes.artifactRef')

mkdir -p documentation_output

for ARTIFACT_ID in $ARTIFACT_IDS; do
  DOMAIN=$(curl -s $API_BASE/documentation/artifact/$ARTIFACT_ID \
    | jq -r '.data.attributes.domainName')

  FILENAME=$(echo "$DOMAIN" | tr ' ' '-' | tr '[:upper:]' '[:lower:]').md

  curl -s $API_BASE/documentation/artifact/$ARTIFACT_ID \
    -H "Accept: text/markdown" > "documentation_output/$FILENAME"

  echo "Downloaded: $FILENAME"
done

echo "All artifacts saved to documentation_output/"
```

---

## Troubleshooting

### Issue: "No ready tasks available"

**Cause**: All tasks have unsatisfied dependencies (cyclic dependency detected during planning).

**Solution**:
```bash
# Check plan details
curl http://localhost:3100/documentation/plan/my-repo-docs \
  | jq '.data.relationships.tasks[] | select(.attributes.status=="pending") | {domain, dependencies}'

# If cyclic dependencies exist, delete plan and recreate with simpler decomposition
```

### Issue: "Task execution failed - Confluence unavailable"

**Cause**: Confluence external source configured but unreachable (network issue, auth expired).

**Solution**:
```bash
# Option 1: Disable Confluence and retry task
curl -X POST $API_BASE/documentation/source/configure \
  -d '{"planIdentifier": "my-repo-docs", "sourceType": "confluence", "enabled": false}'

curl -X POST $API_BASE/documentation/execute -d '{"identifier": "my-repo-docs"}'

# Option 2: Refresh MCP client authentication and retry
# (Refresh Atlassian credentials in Claude Desktop/IDE, then retry)
```

### Issue: "Documentation lacks detail - too generic"

**Cause**: CLAUDE.md missing or insufficient code chunk coverage.

**Solution**:
```bash
# Check if CLAUDE.md exists in repository
curl -X POST $API_BASE/search_code \
  -d '{"identifier": "my-repo", "query": "CLAUDE.md", "limit": 5}'

# If missing, add CLAUDE.md to repository with architecture overview
# If insufficient code chunks, increase extraction file limit
curl -X POST $API_BASE/process \
  -d '{"identifier": "my-repo", "fileLimit": 500}'  # Process more files
```

---

## Next Steps

After generating documentation:

1. **Review Artifacts**: Manually review generated markdown for accuracy (especially [CODE DISCREPANCY] and [NEEDS MANUAL REVIEW] markers)

2. **Use in Governance**: Feed artifacts into Speckit tools:
   ```bash
   # Use artifact as input for /constitution command
   cat user-authentication.md | speckit constitution

   # Use artifact as input for /specify command
   cat payment-processing.md | speckit specify
   ```

3. **Re-Documentation**: When code changes significantly, create new version:
   ```bash
   curl -X POST $API_BASE/documentation/plan \
     -d '{"repositoryIdentifier": "my-repo", "identifier": "my-repo-docs"}'
   # Automatically creates v2, retains v1 for comparison
   ```

4. **Export**: Commit artifacts to repository or documentation portal:
   ```bash
   mkdir -p docs/reconstruction
   cp documentation_output/*.md docs/reconstruction/
   git add docs/reconstruction
   git commit -m "docs: add reconstruction-grade documentation v1"
   ```

---

## Performance Tips

- **Parallel Execution**: Currently serial (constitutional requirement). For faster generation, consider running multiple plans in parallel for different repositories.

- **Selective Re-Documentation**: Only re-document changed domains by creating targeted plans with fewer tasks.

- **Caching**: System automatically caches code chunk queries - subsequent documentation generations for similar repositories will be faster.

---

## API Integration Examples

### Node.js

```typescript
import axios from 'axios';

async function generateDocumentation(repoId: string, docsId: string) {
  const api = axios.create({ baseURL: 'http://localhost:3100' });

  // Create plan
  const { data: plan } = await api.post('/documentation/plan', {
    repositoryIdentifier: repoId,
    identifier: docsId
  });

  const totalTasks = plan.data.attributes.progress.totalTasks;
  console.log(`Executing ${totalTasks} tasks...`);

  // Execute all tasks
  for (let i = 0; i < totalTasks; i++) {
    const { data: taskResult } = await api.post('/documentation/execute', {
      identifier: docsId
    });

    console.log(`Completed: ${taskResult.data.attributes.domain}`);
  }

  // Retrieve artifacts
  const { data: finalPlan } = await api.get(`/documentation/plan/${docsId}`);
  const artifacts = finalPlan.data.relationships.tasks
    .filter(t => t.attributes.status === 'completed')
    .map(t => t.attributes.artifactRef);

  return artifacts;
}
```

### Python

```python
import requests
import time

def generate_documentation(repo_id: str, docs_id: str):
    base_url = "http://localhost:3100"

    # Create plan
    plan_resp = requests.post(f"{base_url}/documentation/plan", json={
        "repositoryIdentifier": repo_id,
        "identifier": docs_id
    })
    plan = plan_resp.json()
    total_tasks = plan["data"]["attributes"]["progress"]["totalTasks"]

    print(f"Executing {total_tasks} tasks...")

    # Execute all tasks
    for i in range(total_tasks):
        task_resp = requests.post(f"{base_url}/documentation/execute", json={
            "identifier": docs_id
        })
        task = task_resp.json()
        print(f"Completed: {task['data']['attributes']['domain']}")
        time.sleep(1)  # Brief pause

    # Retrieve plan with artifacts
    final_plan = requests.get(f"{base_url}/documentation/plan/{docs_id}").json()
    artifacts = [
        t["attributes"]["artifactRef"]
        for t in final_plan["data"]["relationships"]["tasks"]
        if t["attributes"]["status"] == "completed"
    ]

    return artifacts
```

---

**Quick Start Complete**: 2026-02-07

You're now ready to generate reconstruction-grade documentation for your repositories!
