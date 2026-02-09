# Data Model: Reconstruction-Grade Documentation Generator

**Feature**: 003-reconstruction-docs
**Date**: 2026-02-07
**Database**: MongoDB 6.0+

## Overview

The Reconstruction-Grade Documentation Generator extends the Code Reader MCP system with four new MongoDB collections to store documentation plans, tasks, generated artifacts, and external source configurations. All entities follow the same lifecycle patterns established by existing code extraction entities (Task, File, Chunk, Embedding), ensuring constitutional compliance.

---

## Entity Relationship Diagram

```text
┌──────────────────────┐
│  DocumentationPlan   │
│──────────────────────│
│ _id                  │
│ planId (unique)      │◄────────────────────────────────────┐
│ identifier           │                                     │
│ version              │                                     │
│ repositoryIdentifier │                                     │
│ status               │                                     │
│ progress             │                                     │
│ heuristic            │                                     │
│ timestamps           │                                     │
└──────────┬───────────┘                                     │
           │ 1:N                                             │
           ▼                                                 │
┌──────────────────────┐                                     │
│  DocumentationTask   │                                     │
│──────────────────────│                                     │
│ _id                  │                                     │
│ taskId (unique)      │◄──────────────────┐                 │
│ planId ──────────────┼───────────────────┼─────────────────┤
│ domain               │                   │                 │
│ description          │                   │                 │
│ priorityScore        │                   │                 │
│ dependencies         │                   │                 │
│ sourcesRequired      │                   │                 │
│ status               │                   │                 │
│ artifactRef          │                   │                 │
│ error                │                   │                 │
└──────────┬───────────┘                   │                 │
           │ 1:1                           │                 │
           ▼                               │                 │
┌──────────────────────┐                   │                 │
│ DocumentationArtifact│                   │                 │
│──────────────────────│                   │                 │
│ _id                  │                   │                 │
│ artifactId (unique)  │                   │                 │
│ taskId ──────────────┼───────────────────┘                 │
│ planId ──────────────┼─────────────────────────────────────┤
│ domainName           │                                     │
│ sections             │                                     │
│ citations            │                                     │
│ generatedAt          │                                     │
└──────────────────────┘                                     │
                                                             │
┌──────────────────────┐                                     │
│ ExternalSourceConfig │                                     │
│──────────────────────│                                     │
│ _id                  │                                     │
│ configId (unique)    │                                     │
│ planId ──────────────┼─────────────────────────────────────┘
│ sourceType           │
│ enabled              │
│ connectionParams     │
│ timestamps           │
└──────────────────────┘
```

---

## Collection: documentation_plans

Stores documentation generation plans with task decomposition and progress tracking.

### Schema

```typescript
interface DocumentationPlan {
  _id: ObjectId;
  planId: string;               // UUID v4
  identifier: string;           // User-friendly name (e.g., "my-repo")
  version: number;              // Sequential version starting from 1
  repositoryIdentifier: string; // Links to code extraction task identifier
  status: PlanStatus;           // planning | executing | completed | failed
  progress: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    currentTask: string | null; // TaskId of currently executing task
  };
  heuristic: {
    name: string;               // e.g., "FoundationalFirst-v1"
    version: string;            // Heuristic version for reproducibility
    parameters: Record<string, any>; // Heuristic config (weights, thresholds)
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  error: string | null;         // Error message if failed
}

type PlanStatus = 'planning' | 'executing' | 'completed' | 'failed';
```

### MongoDB Document Example

```json
{
  "_id": { "$oid": "65b1c2d3e4f5g6h7i8j9k0l1" },
  "planId": "770f9500-e29b-41d4-a716-446655440100",
  "identifier": "my-repo-docs",
  "version": 1,
  "repositoryIdentifier": "my-repo",
  "status": "executing",
  "progress": {
    "totalTasks": 25,
    "completedTasks": 10,
    "failedTasks": 0,
    "currentTask": "880f9500-e29b-41d4-a716-446655440101"
  },
  "heuristic": {
    "name": "FoundationalFirst-v1",
    "version": "1.0.0",
    "parameters": {
      "foundationalWeight": 100,
      "dependencyWeight": 50,
      "informationGainWeight": 30
    }
  },
  "createdAt": { "$date": "2026-02-07T12:00:00Z" },
  "updatedAt": { "$date": "2026-02-07T12:30:00Z" },
  "completedAt": null,
  "error": null
}
```

### Indexes

```javascript
// Unique plan identifier
db.documentation_plans.createIndex({ planId: 1 }, { unique: true });

// Find plans by repository identifier for versioning
db.documentation_plans.createIndex({ identifier: 1, version: -1 });

// Find plans by status
db.documentation_plans.createIndex({ status: 1 });

// Link to code extraction task
db.documentation_plans.createIndex({ repositoryIdentifier: 1 });
```

### State Transitions

```text
                 ┌─────────────┐
                 │   planning  │ (task decomposition in progress)
                 └──────┬──────┘
                        │ Plan persisted
                        ▼
                 ┌─────────────┐
         ┌──────►│  executing  │◄──────┐ (tasks being processed)
         │       └──────┬──────┘       │
         │              │              │
         │    ┌─────────┴─────────┐    │
         │    │                   │    │
         │    ▼                   ▼    │
  ┌──────┴────────┐       ┌───────────┴──┐
  │   completed   │       │    failed    │
  └───────────────┘       └──────────────┘
         │                       │
         └───────────┬───────────┘
                     │ New documentation generation
                     ▼
              ┌─────────────┐
              │ planning(v+1)│
              └─────────────┘
```

---

## Collection: documentation_tasks

Stores atomic documentation tasks within a plan, each covering a single domain/feature.

### Schema

```typescript
interface DocumentationTask {
  _id: ObjectId;
  taskId: string;               // UUID v4
  planId: string;               // Reference to parent plan
  domain: string;               // Domain/feature name (e.g., "User Authentication")
  description: string;          // What this task documents
  priorityScore: number;        // Calculated by heuristic (higher = earlier)
  dependencies: string[];       // TaskIds that must complete first
  sourcesRequired: SourceType[]; // Which sources needed
  isFoundational: boolean;      // Establishes architecture/vocabulary
  estimatedComplexity: number;  // 1-10 scale for chunk size control
  status: TaskStatus;           // pending | in_progress | completed | failed | blocked
  artifactRef: string | null;   // ArtifactId when completed
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;         // Error details if failed
  createdAt: Date;
}

type SourceType = 'claude_md' | 'code_chunks' | 'confluence';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
```

### MongoDB Document Example

```json
{
  "_id": { "$oid": "65b1c2d3e4f5g6h7i8j9k0l2" },
  "taskId": "880f9500-e29b-41d4-a716-446655440101",
  "planId": "770f9500-e29b-41d4-a716-446655440100",
  "domain": "User Authentication",
  "description": "Document authentication business rules, JWT flow, and user lifecycle",
  "priorityScore": 150,
  "dependencies": ["880f9500-e29b-41d4-a716-446655440099"],
  "sourcesRequired": ["claude_md", "code_chunks", "confluence"],
  "isFoundational": true,
  "estimatedComplexity": 6,
  "status": "completed",
  "artifactRef": "990f9500-e29b-41d4-a716-446655440102",
  "startedAt": { "$date": "2026-02-07T12:15:00Z" },
  "completedAt": { "$date": "2026-02-07T12:17:00Z" },
  "error": null,
  "createdAt": { "$date": "2026-02-07T12:00:00Z" }
}
```

### Indexes

```javascript
// Fast lookup by task ID
db.documentation_tasks.createIndex({ taskId: 1 }, { unique: true });

// Find all tasks for a plan
db.documentation_tasks.createIndex({ planId: 1 });

// Find tasks by status within plan (for resume)
db.documentation_tasks.createIndex({ planId: 1, status: 1 });

// Priority-based task selection
db.documentation_tasks.createIndex({ planId: 1, priorityScore: -1 });
```

### Validation Rules

| Field | Rule |
|-------|------|
| domain | Non-empty string, max 200 chars |
| priorityScore | Numeric, typically 0-300 range |
| dependencies | Array of valid taskIds (must exist in same plan) |
| sourcesRequired | At least one source type |
| estimatedComplexity | Integer 1-10 |

---

## Collection: documentation_artifacts

Stores generated documentation output, structured by domain/feature.

### Schema

```typescript
interface DocumentationArtifact {
  _id: ObjectId;
  artifactId: string;        // UUID v4
  taskId: string;            // Reference to source task
  planId: string;            // Reference to parent plan
  domainName: string;        // Domain/feature documented
  sections: {
    businessRules: BusinessRule[];
    programFlows: ProgramFlow[];
    domainModels: DomainModel[];
    contracts: Contract[];
    userStories: UserStory[];
    invariants: string[];
  };
  citations: Citation[];     // Source attributions
  markdownContent: string;   // Rendered markdown
  generatedAt: Date;
}

interface BusinessRule {
  name: string;
  description: string;
  rationale: string;
  sources: SourceType[];
}

interface ProgramFlow {
  name: string;
  description: string;
  steps: string[];
  sources: SourceType[];
}

interface DomainModel {
  name: string;
  description: string;
  attributes: { name: string; type: string; description: string }[];
  sources: SourceType[];
}

interface Contract {
  name: string;
  purpose: string;
  inputs: { name: string; type: string; required: boolean }[];
  outputs: { name: string; type: string }[];
  sources: SourceType[];
}

interface UserStory {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  sources: SourceType[];
}

interface Citation {
  source: SourceType;
  reference: string; // File path, Confluence page ID, etc.
  retrievedAt: Date;
}
```

### MongoDB Document Example

```json
{
  "_id": { "$oid": "65b1c2d3e4f5g6h7i8j9k0l3" },
  "artifactId": "990f9500-e29b-41d4-a716-446655440102",
  "taskId": "880f9500-e29b-41d4-a716-446655440101",
  "planId": "770f9500-e29b-41d4-a716-446655440100",
  "domainName": "User Authentication",
  "sections": {
    "businessRules": [
      {
        "name": "Session Expiration",
        "description": "User sessions expire after 24 hours of inactivity",
        "rationale": "Security requirement to minimize attack window",
        "sources": ["claude_md", "code_chunks"]
      }
    ],
    "programFlows": [
      {
        "name": "Login Flow",
        "description": "User authentication with JWT token generation",
        "steps": [
          "User submits credentials",
          "System validates against database",
          "System generates JWT with user claims",
          "System returns token to client"
        ],
        "sources": ["code_chunks", "confluence"]
      }
    ],
    "domainModels": [
      {
        "name": "User",
        "description": "Represents an authenticated user account",
        "attributes": [
          { "name": "userId", "type": "UUID", "description": "Unique identifier" },
          { "name": "email", "type": "string", "description": "User email address" }
        ],
        "sources": ["code_chunks"]
      }
    ],
    "contracts": [],
    "userStories": [],
    "invariants": ["Users must verify email before login"]
  },
  "citations": [
    {
      "source": "claude_md",
      "reference": "CLAUDE.md (lines 45-67)",
      "retrievedAt": { "$date": "2026-02-07T12:15:30Z" }
    },
    {
      "source": "code_chunks",
      "reference": "src/services/auth-service.ts (lines 120-145)",
      "retrievedAt": { "$date": "2026-02-07T12:16:00Z" }
    },
    {
      "source": "confluence",
      "reference": "Confluence page AUTH-001",
      "retrievedAt": { "$date": "2026-02-07T12:16:30Z" }
    }
  ],
  "markdownContent": "# Domain: User Authentication\n\n## Business Rules\n\n...",
  "generatedAt": { "$date": "2026-02-07T12:17:00Z" }
}
```

### Indexes

```javascript
// Fast lookup by artifact ID
db.documentation_artifacts.createIndex({ artifactId: 1 }, { unique: true });

// Find artifacts by plan
db.documentation_artifacts.createIndex({ planId: 1 });

// Find artifact by task
db.documentation_artifacts.createIndex({ taskId: 1 });

// Search artifacts by domain name
db.documentation_artifacts.createIndex({ domainName: 1 });
```

---

## Collection: external_source_configs

Stores configuration for optional external documentation sources (e.g., Confluence).

### Schema

```typescript
interface ExternalSourceConfig {
  _id: ObjectId;
  configId: string;          // UUID v4
  planId: string;            // Link to documentation plan
  sourceType: 'confluence';  // Extensible to other sources
  enabled: boolean;
  connectionParams: {
    cloudId: string;         // Confluence cloud instance ID (NOT credentials)
    // Additional non-credential params can be added
  };
  authDelegation: {
    protocol: 'mcp';         // Authentication handled by MCP client
    upstreamServer: 'atlassian'; // MCP server name
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### MongoDB Document Example

```json
{
  "_id": { "$oid": "65b1c2d3e4f5g6h7i8j9k0l4" },
  "configId": "aa0f9500-e29b-41d4-a716-446655440103",
  "planId": "770f9500-e29b-41d4-a716-446655440100",
  "sourceType": "confluence",
  "enabled": true,
  "connectionParams": {
    "cloudId": "abc123def456"
  },
  "authDelegation": {
    "protocol": "mcp",
    "upstreamServer": "atlassian"
  },
  "createdAt": { "$date": "2026-02-07T12:00:00Z" },
  "updatedAt": { "$date": "2026-02-07T12:00:00Z" }
}
```

### Indexes

```javascript
// Fast lookup by config ID
db.external_source_configs.createIndex({ configId: 1 }, { unique: true });

// Find configs by plan
db.external_source_configs.createIndex({ planId: 1 });

// Find enabled configs by plan and source type
db.external_source_configs.createIndex({ planId: 1, sourceType: 1, enabled: 1 });
```

---

## Database Initialization Script

```typescript
async function initializeDocumentationCollections(db: Db): Promise<void> {
  // Create collections if they don't exist
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  const requiredCollections = [
    'documentation_plans',
    'documentation_tasks',
    'documentation_artifacts',
    'external_source_configs'
  ];

  for (const collectionName of requiredCollections) {
    if (!collectionNames.includes(collectionName)) {
      await db.createCollection(collectionName);
    }
  }

  // Create indexes
  await db.collection('documentation_plans').createIndex({ planId: 1 }, { unique: true });
  await db.collection('documentation_plans').createIndex({ identifier: 1, version: -1 });
  await db.collection('documentation_plans').createIndex({ status: 1 });
  await db.collection('documentation_plans').createIndex({ repositoryIdentifier: 1 });

  await db.collection('documentation_tasks').createIndex({ taskId: 1 }, { unique: true });
  await db.collection('documentation_tasks').createIndex({ planId: 1 });
  await db.collection('documentation_tasks').createIndex({ planId: 1, status: 1 });
  await db.collection('documentation_tasks').createIndex({ planId: 1, priorityScore: -1 });

  await db.collection('documentation_artifacts').createIndex({ artifactId: 1 }, { unique: true });
  await db.collection('documentation_artifacts').createIndex({ planId: 1 });
  await db.collection('documentation_artifacts').createIndex({ taskId: 1 });
  await db.collection('documentation_artifacts').createIndex({ domainName: 1 });

  await db.collection('external_source_configs').createIndex({ configId: 1 }, { unique: true });
  await db.collection('external_source_configs').createIndex({ planId: 1 });
  await db.collection('external_source_configs').createIndex({ planId: 1, sourceType: 1, enabled: 1 });
}
```

---

## Data Lifecycle

### Plan Creation
1. Generate UUID for planId
2. Check existing plans for identifier
3. Set version = max(existing versions for identifier) + 1 or 1
4. Insert plan with status: "planning"
5. Decompose into tasks, persist tasks
6. Update plan status: "planning" → "executing"

### Task Execution
1. Select next ready task (highest priority, all dependencies complete)
2. Update task status: "pending" → "in_progress"
3. Synthesize documentation from sources (CLAUDE.md, code chunks, Confluence)
4. Generate artifact using template
5. Persist artifact
6. Update task: status → "completed", set artifactRef
7. Update plan progress counters
8. If all tasks complete: plan status → "completed"

### Plan Deletion (Manual)
1. Delete all artifacts where planId matches
2. Delete all tasks where planId matches
3. Delete all external source configs where planId matches
4. Delete plan document

---

## Storage Estimates

| Entity | Est. Size per Record | 25 Tasks | 100 Tasks |
|--------|---------------------|----------|-----------|
| Plan | 2 KB | 2 KB | 2 KB |
| Task | 1 KB | 25 KB | 100 KB |
| Artifact | 50 KB (avg) | 1.25 MB | 5 MB |
| External Config | 500 B | 500 B | 500 B |
| **Total** | | ~1.3 MB | ~5.1 MB |

*Assumes average artifact size of 50KB (comprehensive domain documentation)*

---

**Data Model Complete**: 2026-02-07
