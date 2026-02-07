# Research: Code Reader MCP System

**Feature**: 001-mcp-code-reader
**Date**: 2026-02-07
**Status**: Complete

## Overview

This document captures research findings and technology decisions for the Code Reader MCP system. All "NEEDS CLARIFICATION" items from the Technical Context have been resolved.

---

## Technology Decisions

### 1. Token Counting Library

**Decision**: tiktoken with cl100k_base encoding

**Rationale**:
- tiktoken is OpenAI's official tokenizer library
- cl100k_base encoding matches text-embedding-3-small model
- Accurate token counts ensure chunks stay within embedding limits
- Native Node.js bindings available via @dqbd/tiktoken or tiktoken npm packages

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| gpt-tokenizer | Less accurate for OpenAI models |
| Approximate counting (chars/4) | Too imprecise for chunking boundaries |
| llama-tokenizer | Wrong encoding for OpenAI |

---

### 2. Vector Search Strategy

**Decision**: MongoDB Atlas Vector Search (primary) with in-memory cosine similarity fallback

**Rationale**:
- MongoDB Atlas Vector Search provides native vector indexing
- Scales to 100,000+ embeddings with sub-second queries
- Fallback ensures system works without Atlas (local MongoDB)
- In-memory search acceptable for <10,000 chunks

**Implementation Notes**:
```javascript
// Atlas Vector Search index definition
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "vector": {
        "type": "knnVector",
        "dimensions": 1536,
        "similarity": "cosine"
      }
    }
  }
}
```

**Fallback Strategy**:
1. On startup, detect if vector search index exists
2. If not, use in-memory cosine similarity with all embeddings for taskId
3. Log warning about performance limitations

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Pinecone | External service violates local-only constraint |
| Milvus | Additional infrastructure complexity |
| pgvector | Would require PostgreSQL instead of MongoDB |
| Chroma | Additional process to manage |

---

### 3. Background Processing Architecture

**Decision**: In-process async with setImmediate() for batch boundaries

**Rationale**:
- Simplest architecture that meets requirements
- No additional process management needed
- Batch boundaries provide natural yield points
- Progress updates via MongoDB polling work well

**Implementation Pattern**:
```typescript
async function processTask(taskId: string): Promise<void> {
  const task = await getTask(taskId);
  const batches = divideBatches(task.files, task.config.batchSize);

  for (let i = task.progress.currentBatch; i < batches.length; i++) {
    await processBatch(taskId, batches[i], i);
    await updateProgress(taskId, i + 1, batches.length);

    // Yield to event loop between batches
    await new Promise(resolve => setImmediate(resolve));
  }
}
```

**Alternatives Considered**:
| Alternative | Why Rejected |
|-------------|--------------|
| Worker threads | Added complexity, shared state issues |
| Child process | IPC overhead, harder debugging |
| External queue (Redis) | External dependency violates local-only |
| BullMQ | Requires Redis |

---

### 4. Chunking Strategy

**Decision**: Hybrid line-based with syntax boundary detection

**Rationale**:
- Pure syntax parsing is complex and language-dependent
- Line-based chunking is simple but loses context
- Hybrid approach: chunk by lines, but try to break at function/class boundaries
- Use regex patterns for common boundary markers

**Boundary Detection Patterns**:
```typescript
const BOUNDARY_PATTERNS = {
  typescript: /^(export\s+)?(async\s+)?(function|class|interface|type|const|let)\s+/,
  python: /^(def|class|async def)\s+/,
  go: /^(func|type)\s+/,
  rust: /^(fn|struct|impl|trait|enum)\s+/,
  java: /^(public|private|protected)?\s*(static)?\s*(class|interface|void|int|String)/,
};
```

**Algorithm**:
1. Split file into lines
2. Count tokens for each line
3. Group lines until approaching chunk limit
4. Look backward for boundary pattern to split at
5. If no boundary found within 20 lines, split at token limit
6. Add overlap from end of previous chunk

---

### 5. File Hash Algorithm

**Decision**: SHA-256

**Rationale**:
- Standard cryptographic hash with negligible collision probability
- Built into Node.js crypto module
- Sufficient for change detection (not security-critical)
- Consistent with industry practices

**Implementation**:
```typescript
import { createHash } from 'crypto';

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
```

---

### 6. Configuration Management

**Decision**: JSON config file with environment variable overrides

**Rationale**:
- JSON is simple and widely understood
- Environment variables allow secret injection (API key)
- No runtime config changes needed
- Schema validation prevents misconfiguration

**Config Priority** (highest to lowest):
1. Environment variables (OPENAI_API_KEY, CODE_READER_PORT)
2. config.json in project root
3. Default values in code

**Schema Validation**:
- Use Zod for runtime type checking
- Fail fast on invalid configuration
- Clear error messages for missing required values

---

### 7. Error Handling Strategy

**Decision**: Structured error types with JSON:API error format

**Rationale**:
- Constitution requires JSON:API format
- Structured errors enable programmatic handling
- Error codes allow client-side localization
- Stack traces in development only

**Error Format**:
```json
{
  "errors": [{
    "status": "404",
    "code": "TASK_NOT_FOUND",
    "title": "Task Not Found",
    "detail": "No task exists with ID abc-123",
    "meta": {
      "taskId": "abc-123"
    }
  }]
}
```

**Error Codes**:
| Code | HTTP Status | Description |
|------|-------------|-------------|
| TASK_NOT_FOUND | 404 | Task ID does not exist |
| INVALID_PATH | 400 | Repository path invalid or inaccessible |
| PROCESSING_FAILED | 500 | Batch processing error |
| OPENAI_ERROR | 502 | OpenAI API error |
| DB_ERROR | 503 | MongoDB connection/operation error |

---

### 8. Logging Strategy

**Decision**: Structured JSON logging with Winston

**Rationale**:
- JSON format enables log aggregation
- Winston is mature and configurable
- Log levels allow filtering (debug in dev, info in prod)
- File and console transports

**Log Levels**:
- error: Processing failures, API errors
- warn: Skipped files, rate limiting
- info: Batch completion, task status changes
- debug: Individual file processing, timing

---

## Dependencies Research

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.18.0 | HTTP server |
| mongodb | ^6.0.0 | Database driver |
| openai | ^4.0.0 | Embeddings API |
| glob | ^10.0.0 | File pattern matching |
| tiktoken | ^1.0.0 | Token counting |
| uuid | ^9.0.0 | Task ID generation |
| zod | ^3.22.0 | Schema validation |
| winston | ^3.11.0 | Logging |
| dotenv | ^16.0.0 | Environment loading |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.3.0 | Language |
| @types/express | ^4.17.0 | Type definitions |
| @types/node | ^20.0.0 | Type definitions |
| jest | ^29.0.0 | Testing framework |
| ts-jest | ^29.0.0 | TypeScript Jest |
| @types/jest | ^29.0.0 | Type definitions |
| tsx | ^4.0.0 | TypeScript execution |

---

## Best Practices Applied

### MongoDB

1. **Connection Pooling**: Use single MongoClient instance
2. **Index Design**: Create indexes before production use
3. **Error Handling**: Wrap operations in try/catch with retries
4. **Cleanup**: Close connections on process exit

### OpenAI API

1. **Batching**: Send up to 20 texts per request
2. **Rate Limiting**: Implement exponential backoff
3. **Timeouts**: Set reasonable request timeouts (60s)
4. **Error Codes**: Handle 429 (rate limit), 500/503 (server errors)

### Express Server

1. **Security**: Bind to localhost only
2. **Body Limits**: Set JSON body size limit (1MB)
3. **Error Middleware**: Catch-all error handler
4. **Graceful Shutdown**: Handle SIGTERM/SIGINT

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| How to handle very large files? | Skip files > 1MB, log warning |
| What token encoding to use? | cl100k_base (matches embedding model) |
| How to detect binary files? | Check for null bytes in first 8KB |
| How to handle circular symlinks? | Track visited paths, skip revisits |
| What batch size for embeddings? | 20 per request (OpenAI guidance) |

---

## Next Steps

Research phase complete. Proceed to Phase 1:
1. Generate data-model.md with MongoDB schemas
2. Generate API contracts in OpenAPI format
3. Create quickstart.md with setup instructions
