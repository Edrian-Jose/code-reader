<!--
SYNC IMPACT REPORT
==================
Version change: N/A -> 1.0.0 (Initial constitution)
Modified principles: N/A (new document)
Added sections:
  - Core Principles (5 principles: Batch Processing, Resume Capability, Local-Only Execution, Task Versioning, Incremental Development)
  - MCP Server Responsibilities
  - Technical Constraints
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ No updates needed (generic)
  - .specify/templates/spec-template.md: ✅ No updates needed (generic)
  - .specify/templates/tasks-template.md: ✅ No updates needed (generic)
Follow-up TODOs: None
-->

# Code Reader Constitution

## Core Principles

### I. Batch Processing

All code extraction MUST happen in configurable batches to ensure predictable resource usage and atomic operations.

- Default batch size: 50 files per batch (configurable)
- Each batch is an atomic unit - either fully processed or not at all
- Batches are numbered sequentially starting from 1
- A batch includes: file discovery, content extraction, chunking, and embedding generation
- Partial batch failures MUST result in complete batch rollback

**Rationale**: Batch processing prevents memory exhaustion on large codebases, enables progress tracking, and ensures data consistency through atomic operations.

### II. Resume Capability

The system MUST be resumable at any point without data loss or duplication.

- Progress state is persisted in MongoDB after each batch completes successfully
- On restart, the system reads the last completed batch and continues from there
- Partial batches are discarded and reprocessed from the beginning
- Resume state MUST include: task ID, last completed batch number, file cursor position
- No batch may be marked complete until all its data is persisted

**Rationale**: Long-running extraction jobs may be interrupted by system restarts, network issues, or user intervention. Resume capability prevents wasted computation and ensures eventual completion.

### III. Local-Only Execution

All processing runs locally except OpenAI API calls for embeddings.

- MongoDB runs locally (localhost:27017 by default)
- MCP server binds to localhost only (no external network exposure)
- No external services beyond OpenAI embeddings API
- File system access is restricted to the target repository path
- No telemetry or analytics sent to external services

**Rationale**: Local-first design ensures data privacy, reduces external dependencies, enables offline development (except embedding generation), and simplifies deployment.

### IV. Task Versioning

Each extraction run creates a new "task" with a unique ID and version.

- Tasks are versioned (v1, v2, etc.) for the same repository path
- Task ID format: `{repo_hash}_{version}_{timestamp}`
- All outputs (embeddings, chunks, metadata) are linked to their task version
- Old versions MUST be retained for comparison and rollback
- Version cleanup is explicit (never automatic)

**Rationale**: Versioning enables safe re-extraction after codebase changes, A/B comparison of different extraction strategies, and rollback if issues are discovered post-extraction.

### V. Incremental Development

All features are implemented as small, testable increments following a defined sequence.

Implementation order:
1. Setup MongoDB connection and verify connectivity
2. Scan directory for files matching supported extensions
3. Extract file content with size filtering
4. Chunk content into embeddable segments
5. Generate embeddings via OpenAI API
6. Store results in MongoDB with task linking
7. Expose via MCP server endpoints

- Each increment MUST be independently testable
- Each increment MUST have defined success criteria
- Integration tests verify increment boundaries

**Rationale**: Incremental development reduces risk, enables early validation, and ensures each component works before building dependencies on it.

## MCP Server Responsibilities

The MCP server provides the external interface for task management and code search.

**Endpoints**:
- `POST /task` - Accept new extraction tasks with repository path and configuration
- `POST /process` - Trigger background processing for a pending task
- `GET /task/{id}` - Report task status (pending, processing, completed, failed)
- `POST /search_code` - Search embedded code using semantic similarity

**Protocol Requirements**:
- All responses MUST follow JSON:API format
- Error responses MUST include error code, message, and remediation hint
- Background processing MUST NOT block request handling
- Status endpoint MUST return current batch progress during processing

## Technical Constraints

**File Processing**:
- Maximum file size: 1MB (larger files are skipped with warning logged)
- Supported extensions: `.js`, `.ts`, `.py`, `.go`, `.rs`, `.java`, `.cpp`, `.c`, `.h`, `.md`, `.json`, `.yaml`, `.yml`
- Binary files are detected and skipped automatically

**Chunking**:
- Chunk size: 500-1500 tokens (configurable)
- Chunks MUST preserve semantic boundaries (functions, classes, paragraphs)
- Overlap between chunks: 10% (configurable)

**Embedding**:
- Default model: `text-embedding-3-small`
- Model is configurable per task
- Rate limiting MUST respect OpenAI API limits
- Failed embedding requests MUST be retried with exponential backoff

**Storage**:
- MongoDB collections: `tasks`, `batches`, `chunks`, `embeddings`
- Indexes required on: task_id, batch_number, file_path, embedding vector
- Vector search uses MongoDB Atlas Vector Search or compatible alternative

## Governance

This constitution defines the non-negotiable rules for the Code Reader system.

**Amendment Process**:
1. Propose change with rationale in writing
2. Assess impact on existing features and data
3. Document migration plan if breaking changes involved
4. Update version according to semantic versioning rules
5. Update all dependent templates and documentation

**Compliance**:
- All PRs MUST verify compliance with these principles
- Complexity additions MUST be justified against principles
- Principle violations require explicit exception documentation

**Versioning Policy**:
- MAJOR: Backward incompatible changes to principles or data model
- MINOR: New principles or sections added
- PATCH: Clarifications and non-semantic refinements

**Version**: 1.0.0 | **Ratified**: 2026-02-07 | **Last Amended**: 2026-02-07
