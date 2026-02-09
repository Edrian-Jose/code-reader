# API Contracts: Reconstruction-Grade Documentation Generator

**Feature**: 003-reconstruction-docs
**Date**: 2026-02-07
**Protocol**: REST over HTTP (localhost-only)

## Overview

This feature adds 5 new endpoints to the Code Reader MCP server for documentation generation. All endpoints follow the existing JSON:API response format and localhost-only binding established by the base system.

---

## Endpoint Summary

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| POST | `/documentation/plan` | Create documentation plan | Repository identifier, optional config | Plan details with task count |
| POST | `/documentation/execute` | Execute next documentation task | Plan identifier | Task execution status |
| GET | `/documentation/plan/:identifier` | Get plan status | N/A (query param) | Plan progress and task list |
| POST | `/documentation/source/configure` | Configure external source | Plan identifier, source config | Configuration confirmation |
| GET | `/documentation/artifact/:artifactId` | Retrieve generated documentation | N/A (path param) | Markdown content + metadata |

---

## Contract Details

### 1. Create Documentation Plan

**Endpoint**: `POST /documentation/plan`

**Purpose**: Initiate documentation generation for a repository by creating a plan with decomposed tasks.

**Request**:
```json
{
  "repositoryIdentifier": "my-repo",
  "identifier": "my-repo-docs",
  "heuristicVersion": "FoundationalFirst-v1",
  "externalSources": {
    "confluence": {
      "enabled": true,
      "cloudId": "abc123def456"
    }
  }
}
```

**Response** (201 Created):
```json
{
  "data": {
    "type": "documentation_plan",
    "id": "770f9500-e29b-41d4-a716-446655440100",
    "attributes": {
      "identifier": "my-repo-docs",
      "version": 1,
      "repositoryIdentifier": "my-repo",
      "status": "planning",
      "progress": {
        "totalTasks": 25,
        "completedTasks": 0,
        "failedTasks": 0,
        "currentTask": null
      },
      "heuristic": {
        "name": "FoundationalFirst-v1",
        "version": "1.0.0"
      },
      "createdAt": "2026-02-07T12:00:00Z"
    },
    "meta": {
      "estimatedDuration": "30-60 minutes (25 tasks × 2 min avg)"
    }
  }
}
```

**Errors**:
- `400 Bad Request`: Invalid identifier format, repository not found in code extraction index
- `409 Conflict`: Plan with same identifier and version already exists
- `500 Internal Server Error`: Plan creation or task decomposition failed

**Stability Guarantees**:
- `repositoryIdentifier` required (backward compatible - can add optional params)
- `identifier` optional (defaults to generated UUID if not provided)
- Response structure stable (may add meta fields)

---

### 2. Execute Documentation Task

**Endpoint**: `POST /documentation/execute`

**Purpose**: Execute the next ready documentation task in the plan (highest priority with dependencies satisfied).

**Request**:
```json
{
  "identifier": "my-repo-docs"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "type": "documentation_task",
    "id": "880f9500-e29b-41d4-a716-446655440101",
    "attributes": {
      "domain": "User Authentication",
      "status": "in_progress",
      "priorityScore": 150,
      "sourcesRequired": ["claude_md", "code_chunks", "confluence"],
      "startedAt": "2026-02-07T12:15:00Z"
    }
  },
  "meta": {
    "planProgress": {
      "completed": 10,
      "remaining": 15,
      "percentComplete": 40
    },
    "message": "Task execution started for domain: User Authentication"
  }
}
```

**Long-Running Operation**: This endpoint may take up to 2 minutes to complete. Consider implementing:
- Server-Sent Events (SSE) for progress updates
- Webhook callback when task completes
- Polling `/documentation/plan/:identifier` for status

**Errors**:
- `400 Bad Request`: Plan not in "executing" status, no ready tasks available
- `404 Not Found`: Plan identifier not found
- `500 Internal Server Error`: Task execution failed (task marked as failed, plan continues)

**Idempotency**: Safe to retry - if task already in progress, returns current status without re-executing.

---

### 3. Get Plan Status

**Endpoint**: `GET /documentation/plan/:identifier`

**Purpose**: Retrieve current plan status, task progress, and list of completed/pending tasks.

**Response** (200 OK):
```json
{
  "data": {
    "type": "documentation_plan",
    "id": "770f9500-e29b-41d4-a716-446655440100",
    "attributes": {
      "identifier": "my-repo-docs",
      "version": 1,
      "status": "executing",
      "progress": {
        "totalTasks": 25,
        "completedTasks": 10,
        "failedTasks": 0,
        "currentTask": "880f9500-e29b-41d4-a716-446655440101"
      },
      "createdAt": "2026-02-07T12:00:00Z",
      "updatedAt": "2026-02-07T12:30:00Z"
    },
    "relationships": {
      "tasks": {
        "data": [
          {
            "type": "documentation_task",
            "id": "880f9500-e29b-41d4-a716-446655440099",
            "attributes": {
              "domain": "System Architecture",
              "status": "completed",
              "artifactRef": "990f9500-e29b-41d4-a716-446655440200"
            }
          },
          {
            "type": "documentation_task",
            "id": "880f9500-e29b-41d4-a716-446655440101",
            "attributes": {
              "domain": "User Authentication",
              "status": "in_progress"
            }
          }
        ]
      }
    }
  }
}
```

**Errors**:
- `404 Not Found`: Plan identifier not found

---

### 4. Configure External Source

**Endpoint**: `POST /documentation/source/configure`

**Purpose**: Configure external documentation sources (e.g., Confluence) for enrichment during task execution.

**Request**:
```json
{
  "planIdentifier": "my-repo-docs",
  "sourceType": "confluence",
  "enabled": true,
  "connectionParams": {
    "cloudId": "abc123def456"
  }
}
```

**Response** (201 Created):
```json
{
  "data": {
    "type": "external_source_config",
    "id": "aa0f9500-e29b-41d4-a716-446655440103",
    "attributes": {
      "planId": "770f9500-e29b-41d4-a716-446655440100",
      "sourceType": "confluence",
      "enabled": true,
      "authDelegation": {
        "protocol": "mcp",
        "upstreamServer": "atlassian"
      }
    },
    "meta": {
      "message": "External source configured. Authentication will be handled by MCP client."
    }
  }
}
```

**Security Note**: This endpoint does NOT accept credentials. Authentication is delegated to the MCP client environment per constitutional requirement FR-022.

**Errors**:
- `400 Bad Request`: Invalid source type, missing connection params, plan not found
- `409 Conflict`: External source already configured for this plan

---

### 5. Get Documentation Artifact

**Endpoint**: `GET /documentation/artifact/:artifactId`

**Purpose**: Retrieve generated documentation content for a completed task.

**Response** (200 OK):
```json
{
  "data": {
    "type": "documentation_artifact",
    "id": "990f9500-e29b-41d4-a716-446655440102",
    "attributes": {
      "domainName": "User Authentication",
      "markdownContent": "# Domain: User Authentication\n\n## Business Rules\n\n...",
      "sections": {
        "businessRules": [...],
        "programFlows": [...],
        "domainModels": [...],
        "userStories": [...]
      },
      "citations": [
        {
          "source": "claude_md",
          "reference": "CLAUDE.md (lines 45-67)"
        },
        {
          "source": "confluence",
          "reference": "Confluence page AUTH-001"
        }
      ],
      "generatedAt": "2026-02-07T12:17:00Z"
    }
  }
}
```

**Content Negotiation**:
- `Accept: application/json` → Returns full JSON structure (default)
- `Accept: text/markdown` → Returns only markdownContent as plain text

**Errors**:
- `404 Not Found`: Artifact ID not found

---

## Workflow Examples

### End-to-End Documentation Generation

```bash
# Step 1: Create documentation plan
curl -X POST http://localhost:3100/documentation/plan \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryIdentifier": "my-repo",
    "identifier": "my-repo-docs"
  }'

# Response: { "data": { "id": "plan-uuid", "attributes": { "status": "planning" } } }

# Step 2: Execute tasks incrementally (call multiple times)
curl -X POST http://localhost:3100/documentation/execute \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-repo-docs"}'

# Repeat Step 2 until plan status is "completed"

# Step 3: Check progress
curl http://localhost:3100/documentation/plan/my-repo-docs

# Step 4: Retrieve artifacts
curl http://localhost:3100/documentation/artifact/990f9500-e29b-41d4-a716-446655440102 \
  -H "Accept: text/markdown" > user-authentication.md
```

### With External Source Configuration

```bash
# Step 1: Create plan
curl -X POST http://localhost:3100/documentation/plan \
  -d '{"repositoryIdentifier": "my-repo", "identifier": "my-repo-docs"}'

# Step 2: Configure Confluence enrichment
curl -X POST http://localhost:3100/documentation/source/configure \
  -d '{
    "planIdentifier": "my-repo-docs",
    "sourceType": "confluence",
    "enabled": true,
    "connectionParams": {"cloudId": "abc123"}
  }'

# Step 3: Execute tasks (Confluence will be queried automatically)
curl -X POST http://localhost:3100/documentation/execute \
  -d '{"identifier": "my-repo-docs"}'
```

---

## Contract Versioning & Evolution

**Current Version**: v1.0

**Allowed Changes** (backward compatible):
- Adding optional request fields
- Adding response metadata fields
- Introducing new endpoints

**Restricted Changes** (require major version):
- Removing required request fields
- Changing response structure fundamentally
- Removing endpoints

**Deprecation Policy**: If an endpoint needs to be replaced, it will be marked as deprecated for at least 3 months before removal, with migration path documented.

---

## Error Response Format

All errors follow JSON:API error format:

```json
{
  "errors": [
    {
      "status": "400",
      "code": "INVALID_IDENTIFIER",
      "title": "Invalid Plan Identifier",
      "detail": "Identifier must be 2-100 characters, alphanumeric with hyphens/underscores only",
      "source": {
        "parameter": "identifier"
      }
    }
  ]
}
```

**Standard Error Codes**:
- `INVALID_IDENTIFIER`: Identifier format validation failed
- `PLAN_NOT_FOUND`: Plan identifier does not exist
- `NO_READY_TASKS`: All tasks are either completed, failed, or have unsatisfied dependencies
- `EXTERNAL_SOURCE_UNAVAILABLE`: Confluence or other external source could not be reached
- `TASK_EXECUTION_FAILED`: Documentation synthesis or artifact generation failed

---

**Contracts Complete**: 2026-02-07

**Next Steps**: Generate quickstart.md with end-to-end usage examples and update agent context.
