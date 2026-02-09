# Code Reader MCP API Documentation

**Version:** 2.0.0
**Base URL:** `http://localhost:3100`
**Format:** JSON:API

> **🎉 VERSION 2.0 RELEASED!** See [API-CHANGELOG.md](API-CHANGELOG.md) for complete list of changes.
>
> **Key Enhancements:**
> - **AI-Friendly Identifiers**: Use "my-app" instead of UUIDs
> - **Token Budget Control**: `fileLimit` parameter for cost management
> - **Smart Filtering**: `minScore` threshold (default 0.7) removes irrelevant results
> - **Graceful Stop**: New `/process/stop` endpoint
> - **File Count**: Immediate feedback on repository size
> - **Recommendations**: Auto-calculated file limits (~200k tokens)
>
> **Quick Links:**
> - [USAGE-GUIDE.md](USAGE-GUIDE.md) - Complete workflows and AI agent patterns
> - [API-CHANGELOG.md](API-CHANGELOG.md) - Detailed migration guide
> - [ATLAS-SETUP.md](ATLAS-SETUP.md) - Vector search performance optimization

This document provides comprehensive documentation for the Code Reader MCP API, including endpoint descriptions, request/response examples, and common workflows.

---

## Table of Contents

- [Quick Start](#quick-start)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [Create Task](#create-task)
  - [Get Task Status](#get-task-status)
  - [Start Processing](#start-processing)
  - [Search Code](#search-code)
  - [Create Documentation Plan](#create-documentation-plan)
  - [Execute Documentation Task](#execute-documentation-task)
  - [Get Plan Status](#get-plan-status)
  - [Get Documentation Artifact](#get-documentation-artifact)
  - [Export Documentation to Files](#export-documentation-to-files)
- [Common Workflows](#common-workflows)
- [Error Handling](#error-handling)
- [OpenAPI Specification](#openapi-specification)

---

## Quick Start

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Check server health:**
   ```bash
   curl http://localhost:3100/health
   ```

3. **Create task with identifier:**
   ```bash
   curl -X POST http://localhost:3100/task \
     -H "Content-Type: application/json" \
     -d '{
       "repositoryPath": "/path/to/your/repo",
       "identifier": "my-app"
     }'
   ```

4. **Start processing with file limit:**
   ```bash
   curl -X POST http://localhost:3100/process \
     -H "Content-Type: application/json" \
     -d '{
       "identifier": "my-app",
       "fileLimit": 133
     }'
   ```

5. **Search by identifier:**
   ```bash
   curl -X POST http://localhost:3100/search_code \
     -H "Content-Type: application/json" \
     -d '{
       "identifier": "my-app",
       "query": "authentication"
     }'
   ```

---

## API Endpoints

### Health Check

**Endpoint:** `GET /health`

Check if the server is running and healthy.

#### Request

```bash
curl http://localhost:3100/health
```

#### Response (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2026-02-07T12:00:00.000Z"
}
```

---

### Create Task

**Endpoint:** `POST /task`

Create a new extraction task with a user-friendly identifier. The system scans the repository immediately and returns total file count and recommended file limit for budget planning.

> **💡 NEW in v2.0:** Now requires `identifier` field and returns `totalFiles` + `recommendedFileLimit`

#### Request

```bash
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/home/user/projects/my-app",
    "identifier": "my-app",
    "config": {
      "batchSize": 50,
      "chunkSize": 1000,
      "chunkOverlap": 100
    }
  }'
```

#### Request Body Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `repositoryPath` | string | **Yes** | - | Absolute path to the repository |
| **`identifier`** | **string** | **Yes** | - | **User-friendly identifier (2-100 chars, alphanumeric + hyphens/underscores)** |
| `config` | object | No | See below | Task configuration |
| `config.batchSize` | integer | No | 50 | Files per batch (1-500) |
| `config.chunkSize` | integer | No | 1000 | Target tokens per chunk (500-1500) |
| `config.chunkOverlap` | integer | No | 100 | Token overlap between chunks (0-500) |
| `config.embeddingModel` | string | No | text-embedding-3-small | OpenAI embedding model |
| `config.extensions` | array | No | [".js", ".ts", ...] | File extensions to process |

**Identifier Rules:**
- Length: 2-100 characters
- Allowed: letters, numbers, hyphens (-), underscores (_)
- Examples: "my-app", "auth-service", "frontend_v2"
- Not allowed: spaces, special characters

#### Response (201 Created)

```json
{
  "data": {
    "type": "task",
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "attributes": {
      "taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "identifier": "my-app",
      "version": 1,
      "repositoryPath": "/home/user/projects/my-app",
      "status": "pending",
      "progress": {
        "totalFiles": 450,
        "processedFiles": 0,
        "currentBatch": 0,
        "totalBatches": 0
      },
      "recommendedFileLimit": 133,
      "config": {...}
    }
  }
}
```

**New Fields in Response:**
- `identifier`: The user-friendly identifier you provided
- `progress.totalFiles`: Total files found (scanned immediately)
- `recommendedFileLimit`: Suggested files per session for ~200k tokens

#### Error Response (400 Bad Request)

```json
{
  "errors": [{
    "status": "400",
    "code": "VALIDATION_ERROR",
    "title": "Validation Error",
    "detail": "Validation failed: repositoryPath: Repository path is required"
  }]
}
```

---

### Get Task Status

**Endpoint:** `GET /task/{taskId}` (backward compatibility)

Retrieve task status by UUID.

> **💡 TIP:** Use `GET /task/by-identifier/{identifier}` for AI-friendly queries

#### Request

```bash
curl http://localhost:3100/task/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | UUID | **Yes** | UUID of the task |

#### Response (200 OK)

```json
{
  "data": {
    "type": "task",
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "attributes": {
      "taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "identifier": "my-app",
      "version": 1,
      "repositoryPath": "/home/user/projects/my-app",
      "status": "processing",
      "progress": {
        "totalFiles": 450,
        "processedFiles": 225,
        "currentBatch": 2,
        "totalBatches": 4,
        "percentComplete": 50.0
      },
      "config": {...},
      "recommendedFileLimit": 133,
      "createdAt": "2026-02-07T12:00:00.000Z",
      "updatedAt": "2026-02-07T12:05:00.000Z",
      "completedAt": null,
      "error": null
    }
  }
}
```

#### Task Status Values

| Status | Description |
|--------|-------------|
| `pending` | Task created but processing not started |
| `processing` | Currently extracting and embedding files |
| `completed` | All files successfully processed |
| `failed` | Processing failed with error |

#### Error Response (404 Not Found)

```json
{
  "errors": [{
    "status": "404",
    "code": "TASK_NOT_FOUND",
    "title": "Task Not Found",
    "detail": "No task exists with ID a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }]
}
```

---

### Get Task by Identifier

**Endpoint:** `GET /task/by-identifier/{identifier}` ⭐ NEW

Retrieve task status by user-friendly identifier (returns latest version). Recommended for AI agents.

#### Request

```bash
curl http://localhost:3100/task/by-identifier/my-app
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `identifier` | string | **Yes** | User-friendly identifier |

#### Response

Same as `GET /task/{taskId}` - returns latest version automatically.

**Benefits:**
- No UUID required
- AI agents can infer from context
- Always returns latest version
- Natural for human users

---

### Start Processing

**Endpoint:** `POST /process`

Trigger background processing for a task with optional file limit for budget control. Returns immediately; poll `GET /task/{id}` for progress.

> **💡 NEW in v2.0:** Accepts `identifier`, supports `fileLimit` for token budget control

#### Request

```bash
# By identifier with file limit (recommended)
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "fileLimit": 133
  }'

# By UUID (backward compatible)
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{"taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'

# Process all files (no limit)
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-app"}'
```

#### Request Body Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `taskId` | UUID | **One of taskId or identifier** | - | UUID of the task |
| **`identifier`** | **string** | **One of taskId or identifier** | - | **Identifier of the task** |
| **`fileLimit`** | **integer** | No | unlimited | **Max files to process (~133 for 200k tokens)** |

**Budget Control with fileLimit:**
- Specify max files to process before stopping
- Task returns to "pending" when limit reached
- Resume later with another fileLimit call
- Useful for daily token budget management

#### Response (202 Accepted)

```json
{
  "data": {
    "type": "process",
    "attributes": {
      "status": "processing",
      "message": "Processing started (max 133 files)",
      "taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "identifier": "my-app",
      "fileLimit": 133,
      "queuePosition": 0
    }
  }
}
```

**New Fields in Response:**
- `identifier`: Task identifier
- `fileLimit`: File limit for this session (null if unlimited)
- Enhanced `message` when limit is active

#### Error Response (400 Bad Request - Invalid State)

```json
{
  "errors": [{
    "status": "400",
    "code": "INVALID_STATUS",
    "title": "Invalid Task Status",
    "detail": "Task must be in 'pending' status to start processing. Current status: completed"
  }]
}
```

---

### Stop Processing

**Endpoint:** `POST /process/stop` ⭐ NEW

Stop ongoing processing gracefully after the current batch completes. All progress is saved and the task can be resumed later.

#### Request

```bash
# Stop by identifier (recommended)
curl -X POST http://localhost:3100/process/stop \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-app"}'

# Stop by UUID
curl -X POST http://localhost:3100/process/stop \
  -H "Content-Type: application/json" \
  -d '{"taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}'
```

#### Request Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | UUID | **One of taskId or identifier** | UUID of the task to stop |
| `identifier` | string | **One of taskId or identifier** | Identifier of the task to stop |

#### Response (200 OK)

```json
{
  "data": {
    "type": "process",
    "attributes": {
      "status": "stopped",
      "message": "Processing will stop after current batch completes",
      "taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "identifier": "my-app"
    }
  }
}
```

**How It Works:**
- Current batch completes atomically (no partial data)
- Task status changes to "pending"
- Progress is fully saved to database
- Resume anytime with `POST /process`

#### Error Response (400 Bad Request)

```json
{
  "errors": [{
    "status": "400",
    "code": "VALIDATION_ERROR",
    "title": "Validation Error",
    "detail": "Task is not currently being processed"
  }]
}
```

---

### Search Code

**Endpoint:** `POST /search_code`

Perform semantic search over embedded code chunks using natural language queries. Results are filtered by similarity score to ensure relevance.

> **💡 NEW in v2.0:** Accepts `identifier`, supports `minScore` threshold (default 0.7)

#### Request

```bash
# By identifier with score filtering (recommended)
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "query": "authentication middleware",
    "limit": 5,
    "minScore": 0.7
  }'

# Strict filtering for precise results
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "query": "JWT token validation",
    "minScore": 0.85
  }'

# By UUID (backward compatible)
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "query": "error handling"
  }'
```

#### Request Body Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | **Yes** | - | Natural language search query |
| `taskId` | UUID | **One of taskId or identifier** | - | UUID of the task to search |
| **`identifier`** | **string** | **One of taskId or identifier** | - | **Identifier of the task (AI-friendly!)** |
| `limit` | integer | No | 10 | Max results to return (1-100) |
| **`minScore`** | **float** | No | **0.7** | **Minimum similarity score (0-1)** |

**minScore Guidelines:**
- **0.9+**: Extremely precise (exact matches only)
- **0.8-0.89**: Highly relevant results
- **0.7-0.79**: Balanced (default - good for most queries)
- **0.6-0.69**: Permissive (exploratory search)
- **0.5-0.59**: Very broad (uncertain queries)
- **<0.5**: Too noisy (not recommended)

#### Response (200 OK)

```json
{
  "data": {
    "type": "search_results",
    "attributes": {
      "query": "authentication middleware",
      "taskId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "identifier": "my-app",
      "minScore": 0.7,
      "resultCount": 2,
      "results": [
        {
          "filePath": "src/auth/handler.ts",
          "content": "export async function authenticateUser(credentials: UserCredentials): Promise<AuthResult> {\n  // Authentication logic\n}",
          "startLine": 15,
          "endLine": 25,
          "score": 0.92
        },
        {
          "filePath": "src/middleware/auth.ts",
          "content": "export function requireAuth(req: Request, res: Response, next: NextFunction) {\n  // Middleware logic\n}",
          "startLine": 8,
          "endLine": 20,
          "score": 0.87
        }
      ]
    }
  }
}
```

**New Fields in Response:**
- `identifier`: Task identifier
- `minScore`: Threshold used for filtering
- `resultCount`: Only includes results above minScore
- All results have `score >= minScore`

#### Result Fields

| Field | Type | Description |
|-------|------|-------------|
| `filePath` | string | Relative path to the file |
| `content` | string | Code content of the matching chunk |
| `startLine` | integer | First line number (1-indexed) |
| `endLine` | integer | Last line number (inclusive) |
| `score` | float | Cosine similarity score (0-1, higher is better) |

#### Error Response (404 Not Found)

```json
{
  "errors": [{
    "status": "404",
    "code": "TASK_NOT_FOUND",
    "title": "Task Not Found",
    "detail": "No task exists with ID a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }]
}
```

---

### Create Documentation Plan

**Endpoint:** `POST /documentation/plan`

Generate reconstruction-grade system documentation from an existing code repository using **GPT-4 AI analysis**.

**How It Works:**
1. Analyzes CLAUDE.md to understand system architecture
2. Searches code to identify domains and bounded contexts
3. Creates prioritized documentation tasks (FoundationalFirst heuristic)
4. Uses GPT-4 to analyze code and generate detailed explanations (not just file paths)

**Prerequisites:**
- Repository must be extracted first (see [Create Task](#create-task))
- OpenAI API key must be configured (`OPENAI_API_KEY` environment variable)
- GPT-4 access enabled on your OpenAI account

#### Request

```bash
curl -X POST http://localhost:3100/documentation/plan \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryIdentifier": "my-app",
    "identifier": "my-app-docs"
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `repositoryIdentifier` | string | Yes | Identifier of extracted code repository |
| `identifier` | string | Yes | User-friendly name for this documentation plan (2-100 chars, alphanumeric + hyphens/underscores) |
| `heuristicVersion` | string | No | Prioritization heuristic version (default: "FoundationalFirst-v1") - see [Task Prioritization](#task-prioritization-heuristics) below |
| `externalSources` | object | No | External documentation source configuration (e.g., Confluence) |

#### Task Prioritization Heuristics

The system uses sophisticated heuristics to order documentation tasks, ensuring foundational knowledge (architecture, core concepts) is documented before feature-specific details. This produces more coherent documentation and unlocks dependent tasks efficiently.

**Available Heuristics:**

**`FoundationalFirst-v1`** (Default - Recommended)

This heuristic prioritizes tasks based on five factors, producing scores that determine execution order (higher score = executed earlier):

1. **Foundational Knowledge First** (+100 points)
   - Tasks that establish system architecture, design philosophy, and core vocabulary get highest priority
   - Examples: "System Architecture", "Core Domain Models", "Design Principles"
   - Rationale: Other documentation depends on understanding the big picture first

2. **Dependency Awareness** (+50 points per dependent task)
   - Tasks that unlock many other tasks score higher
   - Example: Documenting "Authentication Framework" before "Login Feature" or "Password Reset"
   - Rationale: Maximizes parallelization opportunities for future tasks

3. **Information Gain** (+30 points if multiple sources)
   - Tasks that combine 2+ sources (CLAUDE.md + code + Confluence) score higher
   - Rationale: Multi-source synthesis produces more comprehensive documentation

4. **Cross-Source Reinforcement** (+20 points)
   - Tasks that validate across all three sources (CLAUDE.md + code + Confluence) get bonus
   - Rationale: Cross-validation improves documentation accuracy

5. **Chunk Size Control** (penalty for high complexity)
   - Tasks with estimatedComplexity > 10 receive penalty proportional to complexity
   - Rationale: Prevents tasks from becoming too large, maintains 2-minute average execution time

**Scoring Example:**

```
Task: "System Architecture" (foundational)
  + 100 (foundational)
  + 100 (unlocks 2 tasks × 50)
  + 30  (uses CLAUDE.md + code)
  = 230 points (executed first)

Task: "User Authentication" (domain)
  + 0   (not foundational)
  + 50  (unlocks 1 task)
  + 30  (uses CLAUDE.md + code)
  = 80 points (executed after architecture)

Task: "Password Reset" (feature)
  + 0   (not foundational)
  + 0   (unlocks nothing)
  + 0   (code only, no CLAUDE.md)
  = 0 points (executed last)
```

**Heuristic Parameters (FoundationalFirst-v1):**

```json
{
  "name": "FoundationalFirst-v1",
  "version": "1.0.0",
  "parameters": {
    "foundationalWeight": 100,
    "dependencyWeight": 50,
    "informationGainWeight": 30,
    "crossSourceWeight": 20,
    "complexityPenalty": 1
  }
}
```

**When to Use Default:**

The `FoundationalFirst-v1` heuristic works well for:
- Most repositories with clear architectural layers
- Systems with CLAUDE.md files describing bounded contexts
- Codebases where core infrastructure should be documented first

**When to Customize:**

Consider specifying a different heuristic (when available) if:
- Your codebase has unusual dependency patterns (no clear foundation)
- You want to prioritize specific domains regardless of dependencies
- Documentation tasks have significantly different complexity distributions
- You're experimenting with different documentation ordering strategies

**Future Heuristics** (not yet implemented):
- `BreadthFirst-v1`: Document all domains at high level before diving deep into any one
- `UserJourneyFirst-v1`: Prioritize user-facing features over internal infrastructure
- `HighRiskFirst-v1`: Prioritize complex/critical domains identified by code metrics

**How Heuristic Selection Works:**

1. When you create a plan, optionally specify `heuristicVersion`
2. System validates the heuristic exists (returns error if not found)
3. Heuristic parameters are stored with the plan for reproducibility
4. Same heuristic is used consistently throughout plan execution
5. Plan response includes heuristic details for transparency

**Example with Custom Heuristic** (when available):

```bash
curl -X POST http://localhost:3100/documentation/plan \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryIdentifier": "my-app",
    "identifier": "my-app-docs",
    "heuristicVersion": "BreadthFirst-v1"
  }'
```

#### Response (201 Created)

```json
{
  "data": {
    "type": "documentation_plan",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "attributes": {
      "planId": "550e8400-e29b-41d4-a716-446655440000",
      "identifier": "my-app-docs",
      "version": 1,
      "repositoryIdentifier": "my-app",
      "status": "executing",
      "progress": {
        "totalTasks": 5,
        "completedTasks": 0,
        "failedTasks": 0,
        "currentTask": null
      },
      "heuristic": {
        "name": "FoundationalFirst-v1",
        "version": "1.0.0"
      },
      "createdAt": "2026-02-09T12:00:00Z",
      "updatedAt": "2026-02-09T12:00:00Z"
    }
  },
  "meta": {
    "estimatedDuration": "10 minutes (5 tasks × 2 min avg)"
  }
}
```

---

### Execute Documentation Task

**Endpoint:** `POST /documentation/execute`

Execute the next ready documentation task in the plan (highest priority with satisfied dependencies).

**⚠️ Important:** Each task uses **GPT-4** for code analysis and takes **30-60 seconds** to complete (not instant). The endpoint will wait for the analysis to finish before responding.

**What Happens:**
1. Selects highest-priority ready task (dependencies satisfied)
2. Gathers 20-50 relevant code chunks via semantic search
3. Retrieves CLAUDE.md context for system understanding
4. **Sends code to GPT-4** for intelligent analysis (~30-60 seconds)
5. GPT-4 explains business rules, program flows, domain models, contracts
6. Validates quality (section completeness, no implementation details)
7. Persists artifact with quality score
8. Returns task completion status

**Cost per Task:** ~$0.15-0.30 (GPT-4 token usage: ~10k input + ~2k output tokens)

#### Request

```bash
curl -X POST http://localhost:3100/documentation/execute \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-app-docs"}'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identifier` | string | Yes | Plan identifier |

#### Response (200 OK)

```json
{
  "data": {
    "type": "documentation_task",
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "attributes": {
      "taskId": "660e8400-e29b-41d4-a716-446655440001",
      "domain": "User Authentication",
      "status": "completed",
      "priorityScore": 150,
      "sourcesRequired": ["claude_md", "code_chunks"],
      "artifactRef": "770e8400-e29b-41d4-a716-446655440002",
      "startedAt": "2026-02-09T12:00:00Z",
      "completedAt": "2026-02-09T12:02:00Z"
    }
  },
  "meta": {
    "planProgress": {
      "completed": 1,
      "remaining": 4,
      "percentComplete": 20
    },
    "message": "Task execution completed for domain: User Authentication"
  }
}
```

#### Error Response (400 Bad Request - No Ready Tasks)

```json
{
  "errors": [{
    "status": "400",
    "code": "NO_READY_TASKS",
    "title": "No Ready Tasks",
    "detail": "All tasks are either completed, failed, or have unsatisfied dependencies"
  }]
}
```

---

### Get Plan Status

**Endpoint:** `GET /documentation/plan/:identifier`

Retrieve documentation plan status with complete task list.

#### Request

```bash
curl http://localhost:3100/documentation/plan/my-app-docs
```

#### Response (200 OK)

```json
{
  "data": {
    "type": "documentation_plan",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "attributes": {
      "planId": "550e8400-e29b-41d4-a716-446655440000",
      "identifier": "my-app-docs",
      "version": 1,
      "repositoryIdentifier": "my-app",
      "status": "executing",
      "progress": {
        "totalTasks": 5,
        "completedTasks": 2,
        "failedTasks": 0,
        "currentTask": null
      },
      "createdAt": "2026-02-09T12:00:00Z",
      "updatedAt": "2026-02-09T12:05:00Z"
    },
    "relationships": {
      "tasks": {
        "data": [
          {
            "type": "documentation_task",
            "id": "task-1-id",
            "attributes": {
              "domain": "System Architecture",
              "status": "completed",
              "priorityScore": 200,
              "artifactRef": "artifact-1-id"
            }
          },
          {
            "type": "documentation_task",
            "id": "task-2-id",
            "attributes": {
              "domain": "User Authentication",
              "status": "completed",
              "priorityScore": 150,
              "artifactRef": "artifact-2-id"
            }
          },
          {
            "type": "documentation_task",
            "id": "task-3-id",
            "attributes": {
              "domain": "Payment Processing",
              "status": "pending",
              "priorityScore": 100,
              "artifactRef": null
            }
          }
        ]
      }
    }
  }
}
```

---

### Get Documentation Artifact

**Endpoint:** `GET /documentation/artifact/:artifactId`

Retrieve generated documentation artifact with content negotiation support.

#### Request (JSON Response)

```bash
curl http://localhost:3100/documentation/artifact/770e8400-e29b-41d4-a716-446655440002
```

#### Request (Markdown Response)

```bash
curl http://localhost:3100/documentation/artifact/770e8400-e29b-41d4-a716-446655440002 \
  -H "Accept: text/markdown"
```

#### Response (200 OK - JSON)

```json
{
  "data": {
    "type": "documentation_artifact",
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "attributes": {
      "artifactId": "770e8400-e29b-41d4-a716-446655440002",
      "domainName": "User Authentication",
      "sections": {
        "businessRules": [
          {
            "name": "Session Expiration",
            "description": "User sessions expire after 24 hours of inactivity",
            "rationale": "Security requirement to minimize attack window",
            "sources": ["code_chunks"]
          }
        ],
        "programFlows": [],
        "domainModels": [],
        "contracts": [],
        "userStories": [],
        "invariants": []
      },
      "citations": [
        {
          "source": "code_chunks",
          "reference": "Semantic search results for User Authentication",
          "retrievedAt": "2026-02-09T12:02:00Z"
        }
      ],
      "markdownContent": "# Domain: User Authentication\n\n...",
      "qualityScore": 75,
      "generatedAt": "2026-02-09T12:02:00Z"
    }
  }
}
```

#### Response (200 OK - Markdown)

```markdown
# Domain: User Authentication

**Sources**: code_chunks
**Generated**: 2026-02-09T12:02:00Z

---

## Business Rules

### Session Expiration

User sessions expire after 24 hours of inactivity

**Rationale**: Security requirement to minimize attack window

**Sources**: code_chunks

---

## Source Citations

- **code_chunks**: Semantic search results for User Authentication (retrieved 2026-02-09T12:02:00Z)
```

---

### Export Documentation to Files

**Endpoint:** `POST /documentation/export`

Export all generated documentation artifacts as markdown files to the repository's `/docs` folder.

**Purpose**: Automatically creates/updates markdown files in the repository being documented, making the documentation part of the codebase itself.

#### Request

```bash
curl -X POST http://localhost:3100/documentation/export \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-app-docs"}'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `identifier` | string | Yes | Plan identifier |

#### Response (200 OK)

```json
{
  "data": {
    "type": "export_result",
    "attributes": {
      "planId": "550e8400-e29b-41d4-a716-446655440000",
      "identifier": "my-app-docs",
      "exportedCount": 8,
      "docsDirectory": "/path/to/repo/docs",
      "files": [
        "system-architecture.md",
        "task-management.md",
        "batch-processing.md",
        "embedding-generation.md",
        "search-service.md",
        "database-layer.md",
        "api-layer.md",
        "configuration.md"
      ]
    }
  },
  "meta": {
    "message": "Exported 8 documentation artifacts to /path/to/repo/docs"
  }
}
```

#### What Happens

1. Retrieves all completed documentation artifacts for the plan
2. Gets the repository path from the extraction task
3. Creates `/docs` directory if it doesn't exist
4. Writes each artifact as `{domain-name}.md` (lowercase, spaces → hyphens)
5. Overwrites existing files if they exist (updates documentation)
6. Returns list of created/updated files

#### File Naming

Domain names are converted to filenames:
- "System Architecture" → `system-architecture.md`
- "Task Management" → `task-management.md`
- "User Authentication" → `user-authentication.md`

#### Error Response (400 Bad Request - No Artifacts)

```json
{
  "errors": [{
    "status": "400",
    "code": "NO_ARTIFACTS",
    "title": "No Artifacts to Export",
    "detail": "No completed documentation tasks found. Execute tasks before exporting."
  }]
}
```

---

<!--
CONFLUENCE INTEGRATION FEATURE - DEFERRED (Not production ready)

This feature has been deferred due to complexity in CQL query construction and relevance filtering.
Code exists in commented-out sections but is not accessible via API.

See docs/confluence-setup-guide.md and scripts/poc-confluence-enrichment.ts for POC implementation.
-->

---

## Common Workflows

### 1. Extract and Index a New Repository

```bash
# Step 1: Create extraction task
TASK_RESPONSE=$(curl -s -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{"repositoryPath": "/path/to/repo"}')

# Extract task ID from response
TASK_ID=$(echo $TASK_RESPONSE | jq -r '.data.id')
echo "Created task: $TASK_ID"

# Step 2: Start processing
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d "{\"taskId\": \"$TASK_ID\"}"

# Step 3: Poll for progress
while true; do
  STATUS=$(curl -s http://localhost:3100/task/$TASK_ID | jq -r '.data.attributes.status')
  PROGRESS=$(curl -s http://localhost:3100/task/$TASK_ID | jq -r '.data.attributes.progress.percentComplete')

  echo "Status: $STATUS, Progress: $PROGRESS%"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi

  sleep 5
done

# Step 4: Search the indexed code
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"error handling middleware\",
    \"taskId\": \"$TASK_ID\",
    \"limit\": 5
  }" | jq '.'
```

### 2. Re-index an Updated Repository

```bash
# Create a new version for the same repository path
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{"repositoryPath": "/path/to/repo"}' | jq '.'

# The system automatically:
# - Increments the version number
# - Retains the last 3 versions
# - Deletes older versions automatically
```

### 3. Custom Configuration

```bash
# Create task with custom settings
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/path/to/repo",
    "config": {
      "batchSize": 100,
      "chunkSize": 1200,
      "chunkOverlap": 150,
      "extensions": [".ts", ".tsx", ".js", ".jsx"],
      "embeddingModel": "text-embedding-3-small"
    }
  }' | jq '.'
```

### 4. Generate Reconstruction-Grade Documentation

```bash
# Step 1: Ensure repository is extracted
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{"repositoryPath": "/path/to/repo", "identifier": "my-app"}'

curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-app", "fileLimit": 200}'

# Step 2: Create documentation plan
PLAN_RESPONSE=$(curl -s -X POST http://localhost:3100/documentation/plan \
  -H "Content-Type: application/json" \
  -d '{"repositoryIdentifier": "my-app", "identifier": "my-app-docs"}')

TASK_COUNT=$(echo $PLAN_RESPONSE | jq -r '.data.attributes.progress.totalTasks')
echo "Plan created with $TASK_COUNT tasks"

# Step 3: Execute all documentation tasks
for i in $(seq 1 $TASK_COUNT); do
  echo "Executing task $i/$TASK_COUNT..."

  TASK_RESULT=$(curl -s -X POST http://localhost:3100/documentation/execute \
    -H "Content-Type: application/json" \
    -d '{"identifier": "my-app-docs"}')

  DOMAIN=$(echo $TASK_RESULT | jq -r '.data.attributes.domain')
  STATUS=$(echo $TASK_RESULT | jq -r '.data.attributes.status')

  echo "Completed: $DOMAIN ($STATUS)"

  sleep 2
done

# Step 4: Check final status
curl http://localhost:3100/documentation/plan/my-app-docs | jq '.'

# Step 5: Download artifacts as Markdown
PLAN_STATUS=$(curl -s http://localhost:3100/documentation/plan/my-app-docs)
ARTIFACT_IDS=$(echo $PLAN_STATUS | jq -r '.data.relationships.tasks.data[] | select(.attributes.status=="completed") | .attributes.artifactRef')

mkdir -p documentation_output

for ARTIFACT_ID in $ARTIFACT_IDS; do
  DOMAIN=$(curl -s http://localhost:3100/documentation/artifact/$ARTIFACT_ID | jq -r '.data.attributes.domainName')
  FILENAME=$(echo "$DOMAIN" | tr ' ' '-' | tr '[:upper:]' '[:lower:]').md

  curl -s http://localhost:3100/documentation/artifact/$ARTIFACT_ID \
    -H "Accept: text/markdown" > "documentation_output/$FILENAME"

  echo "Downloaded: $FILENAME"
done

echo "All artifacts saved to documentation_output/"
```

---

## Error Handling

All API errors follow the JSON:API error format:

```json
{
  "errors": [
    {
      "status": "400",
      "code": "ERROR_CODE",
      "title": "Error Title",
      "detail": "Detailed error message",
      "meta": {
        "additionalInfo": "value"
      }
    }
  ]
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 400 | `INVALID_STATUS` | Task not in required status |
| 404 | `TASK_NOT_FOUND` | Task does not exist |
| 404 | `NOT_FOUND` | Resource not found |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `DATABASE_ERROR` | Database connection failed |

---

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

- **File:** `openapi.yaml` (in project root)
- **URL (when running):** http://localhost:3100/openapi.yaml

You can use this specification with:

- **Swagger Editor:** https://editor.swagger.io/ (paste the YAML content)
- **Postman:** Import the OpenAPI file to auto-generate requests
- **Swagger UI:** Host locally with `npx serve-swagger openapi.yaml`
- **VS Code:** Use REST Client or Thunder Client extensions

### View with Swagger UI

```bash
# Install Swagger UI CLI globally
npm install -g swagger-ui-cli

# Serve the documentation
swagger-ui-cli --open openapi.yaml
```

---

## Rate Limits & Performance

- **OpenAI API:** Subject to your OpenAI account rate limits
  - Default: 20 embeddings per batch
  - Exponential backoff on rate limit (429) errors
  - 3 retry attempts with increasing delays

- **Processing Speed:**
  - Typical: 1000 files in <10 minutes (excluding API time)
  - Dependent on file size, content complexity, and OpenAI response time

- **Search Performance:**
  - Target: <3 seconds for 100,000 chunks
  - Uses MongoDB Atlas vector search or in-memory cosine similarity fallback

---

## Support & Troubleshooting

### Server Won't Start

```bash
# Check prerequisites
npm run prereqs

# Verify MongoDB is running
mongod --version

# Check port availability
lsof -i :3100  # Unix/Linux
netstat -ano | findstr :3100  # Windows
```

### Processing Stuck

```bash
# Check task status
curl http://localhost:3100/task/{taskId} | jq '.data.attributes.status'

# View server logs
tail -f logs/combined.log

# Resume processing (if interrupted)
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{"taskId": "your-task-id"}'
```

### Database Issues

```bash
# Initialize/reset database
npm run db:init

# Check MongoDB connection
mongo --eval "db.adminCommand('ping')"
```

### OpenAI Configuration

**Using Custom Endpoints:**

The system supports custom OpenAI-compatible endpoints via the `OPENAI_BASE_URL` environment variable.

```bash
# Azure OpenAI
export OPENAI_BASE_URL=https://your-resource.openai.azure.com

# Local proxy
export OPENAI_BASE_URL=https://your-proxy.com/v1

# Custom endpoint
export OPENAI_BASE_URL=https://api.your-service.com/v1
```

**Or in `.env` file:**
```
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://your-resource.openai.azure.com
```

**Or in `config.json`:**
```json
{
  "openai": {
    "embeddingModel": "text-embedding-3-small",
    "baseURL": "https://your-resource.openai.azure.com"
  }
}
```

**Common Use Cases:**
- **Azure OpenAI**: Use your Azure deployment instead of OpenAI directly
- **Proxy**: Route requests through a corporate proxy or rate limiter
- **Local Models**: Use OpenAI-compatible local embedding services
- **Cost Tracking**: Route through a monitoring/billing proxy

---

## Examples in Different Languages

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function extractRepository(repoPath) {
  // Create task
  const taskResponse = await axios.post('http://localhost:3100/task', {
    repositoryPath: repoPath
  });

  const taskId = taskResponse.data.data.id;
  console.log('Task created:', taskId);

  // Start processing
  await axios.post('http://localhost:3100/process', { taskId });

  // Poll for completion
  let status = 'processing';
  while (status === 'processing') {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await axios.get(`http://localhost:3100/task/${taskId}`);
    status = statusResponse.data.data.attributes.status;
    const progress = statusResponse.data.data.attributes.progress?.percentComplete || 0;

    console.log(`Status: ${status}, Progress: ${progress}%`);
  }

  return taskId;
}

async function searchCode(taskId, query) {
  const response = await axios.post('http://localhost:3100/search_code', {
    query,
    taskId,
    limit: 5
  });

  return response.data.data.attributes.results;
}

// Usage
(async () => {
  const taskId = await extractRepository('/path/to/repo');
  const results = await searchCode(taskId, 'authentication handler');
  console.log(JSON.stringify(results, null, 2));
})();
```

### Python

```python
import requests
import time

def extract_repository(repo_path):
    # Create task
    response = requests.post('http://localhost:3100/task', json={
        'repositoryPath': repo_path
    })
    task_id = response.json()['data']['id']
    print(f'Task created: {task_id}')

    # Start processing
    requests.post('http://localhost:3100/process', json={'taskId': task_id})

    # Poll for completion
    while True:
        response = requests.get(f'http://localhost:3100/task/{task_id}')
        data = response.json()['data']['attributes']
        status = data['status']
        progress = data.get('progress', {}).get('percentComplete', 0)

        print(f'Status: {status}, Progress: {progress}%')

        if status in ['completed', 'failed']:
            break

        time.sleep(5)

    return task_id

def search_code(task_id, query):
    response = requests.post('http://localhost:3100/search_code', json={
        'query': query,
        'taskId': task_id,
        'limit': 5
    })
    return response.json()['data']['attributes']['results']

# Usage
task_id = extract_repository('/path/to/repo')
results = search_code(task_id, 'authentication handler')
print(results)
```

---

## License

MIT License - See LICENSE file for details
