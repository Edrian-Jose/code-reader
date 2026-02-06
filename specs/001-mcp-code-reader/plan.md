# Implementation Plan: Code Reader MCP System

**Branch**: `001-mcp-code-reader` | **Date**: 2026-02-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-mcp-code-reader/spec.md`

## Summary

Build a local-first MCP (Model Context Protocol) system that extracts code from repositories, generates embeddings using OpenAI's API, stores everything in MongoDB with resume capability, and exposes search functionality via a localhost server. The system processes files in atomic batches, supports task versioning for multiple extraction runs, and enables semantic code search for AI-assisted development workflows.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: express, mongodb, openai, glob, tiktoken, uuid
**Storage**: MongoDB 6.0+ (localhost:27017)
**Testing**: Jest with ts-jest for unit/integration tests
**Target Platform**: Local development machine (Windows/macOS/Linux)
**Project Type**: Single project (CLI + server)
**Performance Goals**: 1000 files in <10 min (excluding API time), search <3s for 100k chunks
**Constraints**: <100MB memory per batch, localhost-only network binding
**Scale/Scope**: Repositories up to 50,000 files, 100,000 chunks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Batch Processing | PASS | Files processed in configurable batches (default 50), atomic batch operations with rollback |
| II. Resume Capability | PASS | Progress persisted after each batch, resume from last completed batch on restart |
| III. Local-Only Execution | PASS | MongoDB on localhost:27017, server binds to localhost:3100, only OpenAI API external |
| IV. Task Versioning | PASS | UUID task IDs, version numbers per repository, old versions retained |
| V. Incremental Development | PASS | 15-step implementation plan, each step independently testable |

**MCP Server Compliance**:
- POST /task - Task creation endpoint
- POST /process - Background processing trigger
- GET /task/{id} - Status and progress reporting
- POST /search_code - Semantic code search

**Technical Constraints Compliance**:
- 1MB max file size with skip and log
- Supported extensions list implemented
- 500-1500 token chunks with configurable overlap
- text-embedding-3-small default with retry/backoff

## Project Structure

### Documentation (this feature)

```text
specs/001-mcp-code-reader/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── config/
│   ├── index.ts         # Config loader
│   └── schema.ts        # Config validation
├── db/
│   ├── client.ts        # MongoDB connection
│   ├── collections.ts   # Collection definitions
│   └── indexes.ts       # Index creation
├── models/
│   ├── task.ts          # Task entity
│   ├── file.ts          # File entity
│   ├── chunk.ts         # Chunk entity
│   └── embedding.ts     # Embedding entity
├── services/
│   ├── scanner.ts       # File scanner service
│   ├── extractor.ts     # Content extractor
│   ├── chunker.ts       # Chunking logic
│   ├── embedder.ts      # OpenAI integration
│   ├── processor.ts     # Batch orchestrator
│   └── search.ts        # Vector search
├── server/
│   ├── app.ts           # Express application
│   ├── routes/
│   │   ├── task.ts      # Task endpoints
│   │   ├── process.ts   # Process endpoint
│   │   └── search.ts    # Search endpoint
│   └── middleware/
│       ├── error.ts     # Error handling
│       └── validation.ts # Input validation
└── index.ts             # Entry point

tests/
├── unit/
│   ├── scanner.test.ts
│   ├── chunker.test.ts
│   └── embedder.test.ts
├── integration/
│   ├── db.test.ts
│   ├── processor.test.ts
│   └── api.test.ts
└── fixtures/
    └── sample-repo/     # Test repository

scripts/
└── install.sh           # Setup script

config.json              # Default configuration
package.json
tsconfig.json
jest.config.js
```

**Structure Decision**: Single project structure selected. The Code Reader is a self-contained local tool without frontend/backend separation. All components (config, database, extraction pipeline, server) reside in a single `src/` directory with clear module boundaries.

## Implementation Phases

### Phase 1: Foundation (Steps 1-3)

#### Step 1: Project Setup
- Initialize npm project with TypeScript configuration
- Install dependencies: express, mongodb, openai, glob, tiktoken, uuid, dotenv
- Create config loader with JSON schema validation
- Setup tsconfig.json and jest.config.js
- **Test**: Config loads correctly, TypeScript compiles, dependencies resolve

#### Step 2: MongoDB Connection
- Create database client module with connection pooling
- Implement connection with retry logic (3 attempts, exponential backoff)
- Create collections: tasks, files, chunks, embeddings
- Create indexes on: taskId, batchNumber, filePath
- **Test**: Connect to MongoDB, create and read a test document, verify indexes exist

#### Step 3: Task Management
- Implement task creation (generates UUID, sets version, validates path)
- Implement task status updates (pending → processing → completed/failed)
- Implement task retrieval with progress calculation
- **Test**: Create task, update status, retrieve task with correct version increment

### Phase 2: Extraction Pipeline (Steps 4-6)

#### Step 4: File Scanner
- Implement recursive directory scanning using glob
- Filter by configured extensions (.js, .ts, .py, etc.)
- Exclude directories: node_modules, .git, dist, build
- Skip files exceeding 1MB with logged warning
- Return file list with path, relativePath, size metadata
- **Test**: Scan test directory, verify correct files returned, oversized files skipped

#### Step 5: Content Extractor
- Read file contents as UTF-8
- Detect language from file extension mapping
- Calculate SHA-256 hash for change detection
- Handle encoding errors gracefully (skip file, log warning)
- **Test**: Extract content from .ts, .py, .md files, verify hash computation

#### Step 6: Chunking Logic
- Implement token counter using tiktoken (cl100k_base encoding)
- Split content by logical boundaries (function/class detection, line groups)
- Add configurable overlap between chunks (default 100 tokens)
- Preserve metadata: file path, start line, end line, token count
- **Test**: Chunk 5000-line file, verify token counts within limits, overlaps correct

### Phase 3: Embeddings (Steps 7-8)

#### Step 7: OpenAI Integration
- Create OpenAI client wrapper with API key from config
- Implement batch embedding calls (max 20 texts per request)
- Add rate limit handling with exponential backoff (1s initial, 60s max)
- Handle API errors: retry up to 3 times, then fail batch
- **Test**: Generate embeddings for 50 test chunks, verify 1536-dimension vectors

#### Step 8: Embedding Storage
- Store embeddings in MongoDB with chunk linkage
- Create vector index for similarity search
- Implement cosine similarity search function
- Link embeddings to chunks and tasks via IDs
- **Test**: Store 100 embeddings, perform similarity search, verify ranking

### Phase 4: Batch Processing (Steps 9-10)

#### Step 9: Batch Orchestrator
- Divide file list into batches of configurable size (default 50)
- Process each batch atomically: scan → extract → chunk → embed → persist
- Rollback batch on any failure (delete partial data)
- Update task progress after each successful batch
- Implement resume: read last completed batch, continue from next
- **Test**: Process 3 batches, simulate interrupt after batch 2, resume correctly

#### Step 10: Progress Tracking
- Track per batch: files processed, chunks created, embeddings generated
- Calculate completion percentage: (completedBatches / totalBatches) * 100
- Store timing information: batch start/end, total elapsed
- Handle partial batch recovery: detect incomplete batch, restart it
- **Test**: Verify progress updates match actual state, timing accurate

### Phase 5: MCP Server (Steps 11-14)

#### Step 11: Express Server Setup
- Create Express application with JSON body parsing
- Add error handling middleware (JSON error responses)
- Add request logging middleware
- Bind to localhost only (127.0.0.1:3100)
- Add health check endpoint: GET /health
- **Test**: Server starts, health check returns 200, rejects non-localhost

#### Step 12: POST /task Endpoint
- Validate input: repositoryPath required, config optional
- Verify repository path exists on filesystem
- Create new task in MongoDB with version increment
- Return: taskId, version, status: "pending"
- **Test**: Create task via API, verify stored in MongoDB with correct version

#### Step 13: POST /process and GET /task/{id} Endpoints
- POST /process: Validate taskId, trigger background processing, return immediately
- Background worker: process batches sequentially, update progress
- GET /task/{id}: Return status, progress (files, batches, percentage), error if failed
- Handle "task not found": return 404 with clear message
- **Test**: Start processing, poll progress, verify counts match

#### Step 14: POST /search_code Endpoint
- Accept: query (string), taskId (string), limit (number, default 10)
- Generate embedding for query using same model
- Perform vector similarity search scoped to taskId
- Return ranked results: filePath, content, startLine, endLine, score
- **Test**: Search processed repository, verify relevant results in top 5

### Phase 6: Integration (Step 15)

#### Step 15: End-to-End Testing
- Create test repository with known content (20 files, various languages)
- Run full pipeline: create task → process → search
- Verify all documents in MongoDB match expectations
- Test edge cases: oversized file, empty file, binary content
- Test resume: interrupt mid-processing, restart, verify completion
- Document any discovered edge cases
- **Test**: Full workflow completes, search returns expected results

## Complexity Tracking

> No constitution violations identified. All implementations follow the five core principles.

| Aspect | Approach | Justification |
|--------|----------|---------------|
| Batch atomicity | Full rollback on failure | Constitution Principle I requires atomic batches |
| Resume state | MongoDB-persisted | Constitution Principle II requires persistence |
| Vector search | MongoDB native or in-memory fallback | Local-only constraint from Principle III |

## Long-Running Task Handling

1. `POST /process` returns immediately with `{ status: "processing" }`
2. Background worker spawned via `setImmediate()` or worker thread
3. Worker processes batches sequentially, updating MongoDB after each
4. Client polls `GET /task/{id}` for progress updates
5. On crash: restart reads last completed batch from MongoDB
6. Task marked `completed` or `failed` when all batches done

## Dependencies Between Steps

```text
Step 1 (Setup) ──────────────────────────────────────────────────┐
       │                                                         │
       ▼                                                         │
Step 2 (MongoDB) ────────────────────────────────────┐           │
       │                                             │           │
       ▼                                             │           │
Step 3 (Task CRUD) ──────────────────────────────────┤           │
       │                                             │           │
       ▼                                             │           │
Step 4 (Scanner) ────────────────────────────────────┤           │
       │                                             │           │
       ▼                                             │           │
Step 5 (Extractor) ──────────────────────────────────┤           │
       │                                             │           │
       ▼                                             │           │
Step 6 (Chunker) ────────────────────────────────────┤           │
       │                                             │           │
       ▼                                             │           │
Step 7 (OpenAI) ─────────────────────────────────────┤           │
       │                                             │           │
       ▼                                             │           │
Step 8 (Storage) ────────────────────────────────────┘           │
       │                                                         │
       ▼                                                         │
Step 9 (Orchestrator) ◀──────────────────────────────────────────┘
       │
       ▼
Step 10 (Progress) ──────────────────────────────────┐
       │                                             │
       ▼                                             │
Step 11 (Server) ────────────────────────────────────┤
       │                                             │
       ▼                                             │
Steps 12-14 (Endpoints) ─────────────────────────────┘
       │
       ▼
Step 15 (E2E Tests)
```

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OpenAI API rate limits | Exponential backoff with configurable max wait |
| Large repository memory | Batch processing prevents loading all files |
| MongoDB unavailable | Retry connection with clear error messages |
| Interrupted processing | Resume capability restores from last batch |
| Invalid repository path | Validation before task creation |
