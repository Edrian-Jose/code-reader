# Data Model: Code Reader MCP System

**Feature**: 001-mcp-code-reader
**Date**: 2026-02-07
**Database**: MongoDB 6.0+

## Overview

The Code Reader system uses four MongoDB collections to store extraction tasks, processed files, content chunks, and embeddings. All entities are linked via `taskId` to support task versioning and data isolation.

---

## Entity Relationship Diagram

```text
┌─────────────────┐
│      Task       │
│─────────────────│
│ _id             │
│ taskId (unique) │◄──────────────────────────────────────────┐
│ version         │                                           │
│ repositoryPath  │                                           │
│ status          │                                           │
│ progress        │                                           │
│ config          │                                           │
│ timestamps      │                                           │
└────────┬────────┘                                           │
         │ 1:N                                                │
         ▼                                                    │
┌─────────────────┐                                           │
│      File       │                                           │
│─────────────────│                                           │
│ _id             │                                           │
│ taskId ─────────┼───────────────────────────────────────────┤
│ fileId (unique) │◄─────────────────────┐                    │
│ filePath        │                      │                    │
│ relativePath    │                      │                    │
│ language        │                      │                    │
│ hash            │                      │                    │
│ batchNumber     │                      │                    │
└────────┬────────┘                      │                    │
         │ 1:N                           │                    │
         ▼                               │                    │
┌─────────────────┐                      │                    │
│     Chunk       │                      │                    │
│─────────────────│                      │                    │
│ _id             │                      │                    │
│ chunkId (unique)│◄──────────┐          │                    │
│ taskId ─────────┼───────────┼──────────┼────────────────────┤
│ fileId ─────────┼───────────┼──────────┘                    │
│ content         │           │                               │
│ startLine       │           │                               │
│ endLine         │           │                               │
│ tokenCount      │           │                               │
└────────┬────────┘           │                               │
         │ 1:1                │                               │
         ▼                    │                               │
┌─────────────────┐           │                               │
│   Embedding     │           │                               │
│─────────────────│           │                               │
│ _id             │           │                               │
│ chunkId ────────┼───────────┘                               │
│ taskId ─────────┼───────────────────────────────────────────┘
│ vector          │
│ model           │
└─────────────────┘
```

---

## Collection: tasks

Stores extraction task metadata, configuration, and progress.

### Schema

```typescript
interface Task {
  _id: ObjectId;
  taskId: string;           // UUID v4
  version: number;          // Increments per repository
  repositoryPath: string;   // Absolute path to repository
  status: TaskStatus;       // pending | processing | completed | failed
  progress: {
    totalFiles: number;
    processedFiles: number;
    currentBatch: number;
    totalBatches: number;
  };
  config: {
    batchSize: number;      // Default: 50
    chunkSize: number;      // Default: 1000 tokens
    chunkOverlap: number;   // Default: 100 tokens
    embeddingModel: string; // Default: text-embedding-3-small
    extensions: string[];   // Supported file extensions
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  error: string | null;     // Error message if failed
}

type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
```

### MongoDB Document Example

```json
{
  "_id": { "$oid": "65a1b2c3d4e5f6g7h8i9j0k1" },
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "version": 1,
  "repositoryPath": "/home/user/projects/my-app",
  "status": "completed",
  "progress": {
    "totalFiles": 150,
    "processedFiles": 150,
    "currentBatch": 3,
    "totalBatches": 3
  },
  "config": {
    "batchSize": 50,
    "chunkSize": 1000,
    "chunkOverlap": 100,
    "embeddingModel": "text-embedding-3-small",
    "extensions": [".js", ".ts", ".py", ".go", ".md"]
  },
  "createdAt": { "$date": "2026-02-07T10:00:00Z" },
  "updatedAt": { "$date": "2026-02-07T10:15:00Z" },
  "completedAt": { "$date": "2026-02-07T10:15:00Z" },
  "error": null
}
```

### Indexes

```javascript
// Unique task identifier
db.tasks.createIndex({ taskId: 1 }, { unique: true });

// Find tasks by repository for versioning
db.tasks.createIndex({ repositoryPath: 1, version: -1 });

// Find tasks by status
db.tasks.createIndex({ status: 1 });
```

### State Transitions

```text
                    ┌─────────────────┐
                    │     pending     │
                    └────────┬────────┘
                             │ POST /process
                             ▼
                    ┌─────────────────┐
           ┌───────►│   processing    │◄───────┐
           │        └────────┬────────┘        │
           │                 │                 │
           │    ┌────────────┴────────────┐    │
           │    │                         │    │
           │    ▼                         ▼    │
    ┌──────┴────────┐             ┌───────────┴──┐
    │   completed   │             │    failed    │
    └───────────────┘             └──────────────┘
           │                              │
           └──────────────┬───────────────┘
                          │ New extraction
                          ▼
                    ┌─────────────────┐
                    │  pending (v+1)  │
                    └─────────────────┘
```

---

## Collection: files

Stores metadata about processed source files.

### Schema

```typescript
interface ProcessedFile {
  _id: ObjectId;
  fileId: string;         // UUID v4
  taskId: string;         // Reference to parent task
  filePath: string;       // Absolute path
  relativePath: string;   // Path relative to repository root
  language: string;       // Detected from extension
  size: number;           // File size in bytes
  lines: number;          // Line count
  hash: string;           // SHA-256 of content
  batchNumber: number;    // Which batch processed this file
  processedAt: Date;
}
```

### MongoDB Document Example

```json
{
  "_id": { "$oid": "65a1b2c3d4e5f6g7h8i9j0k2" },
  "fileId": "660e8400-e29b-41d4-a716-446655440001",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "filePath": "/home/user/projects/my-app/src/utils/helper.ts",
  "relativePath": "src/utils/helper.ts",
  "language": "typescript",
  "size": 2048,
  "lines": 85,
  "hash": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
  "batchNumber": 1,
  "processedAt": { "$date": "2026-02-07T10:05:00Z" }
}
```

### Indexes

```javascript
// Fast lookup by file ID
db.files.createIndex({ fileId: 1 }, { unique: true });

// Find all files for a task
db.files.createIndex({ taskId: 1 });

// Find file by path within task (for deduplication)
db.files.createIndex({ taskId: 1, filePath: 1 }, { unique: true });

// Find files by batch (for resume)
db.files.createIndex({ taskId: 1, batchNumber: 1 });
```

### Language Detection Map

```typescript
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.md': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};
```

---

## Collection: chunks

Stores content segments extracted from files for embedding.

### Schema

```typescript
interface Chunk {
  _id: ObjectId;
  chunkId: string;        // UUID v4
  taskId: string;         // Reference to parent task
  fileId: string;         // Reference to source file
  filePath: string;       // Denormalized for search results
  content: string;        // The actual text content
  startLine: number;      // First line number (1-indexed)
  endLine: number;        // Last line number (inclusive)
  tokenCount: number;     // Token count using cl100k_base
  createdAt: Date;
}
```

### MongoDB Document Example

```json
{
  "_id": { "$oid": "65a1b2c3d4e5f6g7h8i9j0k3" },
  "chunkId": "770e8400-e29b-41d4-a716-446655440002",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "fileId": "660e8400-e29b-41d4-a716-446655440001",
  "filePath": "src/utils/helper.ts",
  "content": "export function formatDate(date: Date): string {\n  const options: Intl.DateTimeFormatOptions = {\n    year: 'numeric',\n    month: 'long',\n    day: 'numeric'\n  };\n  return date.toLocaleDateString('en-US', options);\n}",
  "startLine": 15,
  "endLine": 23,
  "tokenCount": 87,
  "createdAt": { "$date": "2026-02-07T10:05:01Z" }
}
```

### Indexes

```javascript
// Fast lookup by chunk ID
db.chunks.createIndex({ chunkId: 1 }, { unique: true });

// Find all chunks for a task (for search)
db.chunks.createIndex({ taskId: 1 });

// Find chunks by file (for display)
db.chunks.createIndex({ fileId: 1 });

// Find chunks by file path within task
db.chunks.createIndex({ taskId: 1, filePath: 1 });
```

### Validation Rules

| Field | Rule |
|-------|------|
| content | Non-empty string |
| tokenCount | 1 ≤ count ≤ 1500 |
| startLine | ≥ 1 |
| endLine | ≥ startLine |

---

## Collection: embeddings

Stores vector representations of chunks for semantic search.

### Schema

```typescript
interface Embedding {
  _id: ObjectId;
  chunkId: string;        // Reference to source chunk
  taskId: string;         // Reference to parent task
  vector: number[];       // 1536-dimension float array
  model: string;          // Model used (e.g., text-embedding-3-small)
  createdAt: Date;
}
```

### MongoDB Document Example

```json
{
  "_id": { "$oid": "65a1b2c3d4e5f6g7h8i9j0k4" },
  "chunkId": "770e8400-e29b-41d4-a716-446655440002",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "vector": [0.0123, -0.0456, 0.0789, ...],
  "model": "text-embedding-3-small",
  "createdAt": { "$date": "2026-02-07T10:05:02Z" }
}
```

### Indexes

```javascript
// One embedding per chunk
db.embeddings.createIndex({ chunkId: 1 }, { unique: true });

// Find embeddings by task (for search scope)
db.embeddings.createIndex({ taskId: 1 });

// Vector search index (MongoDB Atlas)
db.embeddings.createSearchIndex({
  name: "vector_index",
  definition: {
    mappings: {
      dynamic: true,
      fields: {
        vector: {
          type: "knnVector",
          dimensions: 1536,
          similarity: "cosine"
        },
        taskId: {
          type: "string"
        }
      }
    }
  }
});
```

### Vector Search Query

```javascript
// MongoDB Atlas Vector Search aggregation
db.embeddings.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "vector",
      queryVector: [0.0123, -0.0456, ...],
      numCandidates: 100,
      limit: 10,
      filter: { taskId: "550e8400-e29b-41d4-a716-446655440000" }
    }
  },
  {
    $project: {
      chunkId: 1,
      score: { $meta: "vectorSearchScore" }
    }
  }
]);
```

---

## Database Initialization Script

```typescript
async function initializeDatabase(db: Db): Promise<void> {
  // Create collections if they don't exist
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  if (!collectionNames.includes('tasks')) {
    await db.createCollection('tasks');
  }
  if (!collectionNames.includes('files')) {
    await db.createCollection('files');
  }
  if (!collectionNames.includes('chunks')) {
    await db.createCollection('chunks');
  }
  if (!collectionNames.includes('embeddings')) {
    await db.createCollection('embeddings');
  }

  // Create indexes
  await db.collection('tasks').createIndex({ taskId: 1 }, { unique: true });
  await db.collection('tasks').createIndex({ repositoryPath: 1, version: -1 });
  await db.collection('tasks').createIndex({ status: 1 });

  await db.collection('files').createIndex({ fileId: 1 }, { unique: true });
  await db.collection('files').createIndex({ taskId: 1 });
  await db.collection('files').createIndex({ taskId: 1, filePath: 1 }, { unique: true });
  await db.collection('files').createIndex({ taskId: 1, batchNumber: 1 });

  await db.collection('chunks').createIndex({ chunkId: 1 }, { unique: true });
  await db.collection('chunks').createIndex({ taskId: 1 });
  await db.collection('chunks').createIndex({ fileId: 1 });

  await db.collection('embeddings').createIndex({ chunkId: 1 }, { unique: true });
  await db.collection('embeddings').createIndex({ taskId: 1 });
}
```

---

## Data Lifecycle

### Task Creation
1. Generate UUID for taskId
2. Check existing tasks for repositoryPath
3. Set version = max(existing versions) + 1 or 1
4. Insert task with status: "pending"

### Batch Processing
1. Read files for current batch
2. Extract content, create chunks
3. Generate embeddings
4. Insert files, chunks, embeddings in transaction
5. Update task progress
6. If error, delete all data for current batch

### Task Deletion (Manual)
1. Delete all embeddings where taskId matches
2. Delete all chunks where taskId matches
3. Delete all files where taskId matches
4. Delete task document

---

## Storage Estimates

| Entity | Est. Size per Record | 10k Files | 50k Files |
|--------|---------------------|-----------|-----------|
| Task | 1 KB | 1 KB | 1 KB |
| File | 500 B | 5 MB | 25 MB |
| Chunk | 2 KB | 40 MB | 200 MB |
| Embedding | 12 KB (1536 × 8 B) | 240 MB | 1.2 GB |
| **Total** | | ~285 MB | ~1.4 GB |

*Assumes average 2 chunks per file*
