# Feature Specification: Code Reader MCP System

**Feature Branch**: `001-mcp-code-reader`
**Created**: 2026-02-07
**Status**: Draft
**Input**: User description: "Code Reader MCP system that extracts, embeds, and serves codebase content for AI-assisted development workflows"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Extraction Task (Priority: P1)

A developer wants to index a local codebase for AI-assisted development. They provide the path to their repository and receive a task identifier to track the extraction process.

**Why this priority**: This is the entry point for all system functionality. Without the ability to create extraction tasks, no other features can operate. This establishes the core workflow.

**Independent Test**: Can be fully tested by creating a task for a sample repository and verifying the task is stored with correct configuration. Delivers value by enabling the extraction pipeline.

**Acceptance Scenarios**:

1. **Given** a valid repository path and default configuration, **When** the developer creates a new extraction task, **Then** the system returns a unique task identifier and stores the task with "pending" status.

2. **Given** a repository path that was previously processed, **When** the developer creates a new extraction task, **Then** the system creates a new task version (v2, v3, etc.) while retaining the previous version.

3. **Given** custom configuration options (batch size, chunk size), **When** the developer creates a task with overrides, **Then** the system stores the custom configuration with the task.

4. **Given** an invalid repository path (non-existent directory), **When** the developer attempts to create a task, **Then** the system returns an error with a clear message explaining the path does not exist.

---

### User Story 2 - Process Repository Files (Priority: P1)

A developer triggers processing for a pending task. The system scans the repository, extracts file content, chunks it into segments, generates embeddings, and stores everything for later search.

**Why this priority**: Processing is the core value proposition. Without processing, the system cannot index code for search. This is equally critical as task creation.

**Independent Test**: Can be fully tested by triggering processing on a small test repository (10-20 files) and verifying all files are chunked and embedded.

**Acceptance Scenarios**:

1. **Given** a pending task, **When** the developer triggers processing, **Then** the system begins scanning files in batches and updates progress in real-time.

2. **Given** a repository with 500 files and batch size of 50, **When** processing runs, **Then** files are processed in 10 sequential batches, with each batch fully completing before the next begins.

3. **Given** a file larger than 1MB, **When** the system encounters it during scanning, **Then** the file is skipped and logged as oversized, without failing the batch.

4. **Given** files with unsupported extensions (.exe, .dll, .png), **When** the system scans the directory, **Then** these files are excluded from processing.

5. **Given** directories named node_modules, .git, dist, or build, **When** the system scans recursively, **Then** these directories are completely excluded.

6. **Given** a processing task that is interrupted (system restart, error), **When** the developer resumes processing, **Then** the system continues from the last completed batch without reprocessing finished batches.

7. **Given** a batch that partially fails during embedding, **When** an error occurs mid-batch, **Then** the entire batch is marked incomplete and will be reprocessed on resume.

---

### User Story 3 - Monitor Task Progress (Priority: P2)

A developer wants to check how far along their extraction task is. They can query the task status and see detailed progress including files processed, current batch, and estimated completion.

**Why this priority**: Progress visibility is essential for user experience but not required for core functionality. Users can still use the system without progress monitoring.

**Independent Test**: Can be tested by querying status during an active processing job and verifying accurate counts are returned.

**Acceptance Scenarios**:

1. **Given** a task that is currently processing, **When** the developer queries task status, **Then** the system returns current batch number, total batches, files processed, total files, and percentage complete.

2. **Given** a completed task, **When** the developer queries task status, **Then** the system returns "completed" status with final statistics and completion timestamp.

3. **Given** a failed task, **When** the developer queries task status, **Then** the system returns "failed" status with error message and the batch number where failure occurred.

4. **Given** a task ID that does not exist, **When** the developer queries status, **Then** the system returns a clear error indicating the task was not found.

---

### User Story 4 - Search Embedded Code (Priority: P2)

A developer wants to find relevant code snippets using natural language queries. They describe what they're looking for, and the system returns the most semantically similar code chunks with file locations and context.

**Why this priority**: Search is the primary use case for the indexed data, but requires processing to complete first. High value but dependent on earlier stories.

**Independent Test**: Can be tested by searching a processed repository with various queries and verifying relevant results are returned with accurate file paths and line numbers.

**Acceptance Scenarios**:

1. **Given** a completed task and a natural language query, **When** the developer searches for code, **Then** the system returns up to the requested number of results ranked by semantic similarity.

2. **Given** a search query, **When** results are returned, **Then** each result includes: file path, code content, start line, end line, and similarity score.

3. **Given** a query with no semantically similar results, **When** the developer searches, **Then** the system returns an empty result set (not an error).

4. **Given** multiple task versions for the same repository, **When** the developer searches, **Then** the search only returns results from the specified task version.

5. **Given** a task that is still processing, **When** the developer attempts to search, **Then** the system returns results from completed batches only (partial results are acceptable).

---

### User Story 5 - System Installation and Setup (Priority: P3)

A developer wants to set up the Code Reader system on their local machine. They run an installation process that verifies prerequisites, installs dependencies, and initializes the database.

**Why this priority**: Setup is a one-time operation that must happen before any usage, but is not part of ongoing system functionality.

**Independent Test**: Can be tested by running setup on a clean machine and verifying all components are properly initialized.

**Acceptance Scenarios**:

1. **Given** a machine with required prerequisites (Node.js 18+, MongoDB running), **When** the developer runs installation, **Then** all dependencies are installed and database collections are created.

2. **Given** Node.js version below 18, **When** the developer attempts installation, **Then** the system fails with a clear message indicating the minimum required version.

3. **Given** MongoDB is not running on the expected port, **When** the developer attempts installation, **Then** the system fails with a clear message about database connectivity.

4. **Given** a previous installation exists, **When** the developer runs installation again, **Then** the system verifies existing setup without destroying data (idempotent operation).

---

### Edge Cases

- What happens when a file contains binary content despite having a supported extension (.js file with binary data)?
  - System attempts UTF-8 read; if decoding fails, file is skipped and logged.

- How does the system handle very large repositories (100,000+ files)?
  - Processing continues in batches; progress is tracked and resumable. No memory issues due to batch-based design.

- What happens if OpenAI API rate limits are exceeded during embedding?
  - System implements exponential backoff and retries; batch completion waits for successful embedding.

- How does the system handle files with no content (0 bytes)?
  - Empty files are skipped during chunking; they may be logged but do not produce chunks or embeddings.

- What happens if disk space runs out during processing?
  - Current batch fails; resume capability allows continuation after space is freed.

- How are symbolic links handled during directory scanning?
  - Symbolic links are followed but circular references are detected and skipped.

## Requirements *(mandatory)*

### Functional Requirements

**Task Management**

- **FR-001**: System MUST accept new extraction tasks with a repository path and optional configuration overrides.
- **FR-002**: System MUST assign a unique identifier to each task using UUID format.
- **FR-003**: System MUST version tasks for the same repository path (v1, v2, etc.) and retain the last 3 versions, auto-deleting older versions and their associated data.
- **FR-004**: System MUST validate that the repository path exists before accepting a task.
- **FR-005**: System MUST store task configuration including batch size (default: 50), chunk size (default: 1000 tokens), and embedding model.

**File Processing**

- **FR-006**: System MUST recursively scan the target directory for files matching supported extensions.
- **FR-007**: System MUST support these file extensions: .js, .ts, .py, .go, .rs, .java, .cpp, .c, .h, .md, .json, .yaml, .yml.
- **FR-008**: System MUST exclude directories: node_modules, .git, dist, build.
- **FR-009**: System MUST skip files exceeding 1MB in size with a logged warning.
- **FR-010**: System MUST process files in configurable batches (default: 50 files per batch).
- **FR-011**: System MUST treat each batch as atomic - either fully processed or not at all.

**Content Chunking**

- **FR-012**: System MUST split file content into chunks within token limits (default: 1000 tokens, configurable range: 500-1500).
- **FR-013**: System MUST preserve logical boundaries when chunking (functions, classes, or paragraph breaks).
- **FR-014**: System MUST add configurable overlap between consecutive chunks (default: 100 tokens).
- **FR-015**: System MUST track start line and end line for each chunk.
- **FR-016**: System MUST detect language from file extension and store with chunk metadata.

**Embedding Generation**

- **FR-017**: System MUST generate embeddings for all chunks using the configured embedding model (default: text-embedding-3-small).
- **FR-018**: System MUST batch embedding requests (max 20 per request) to respect API limits.
- **FR-019**: System MUST handle rate limiting with exponential backoff (initial: 1s, max: 60s).
- **FR-020**: System MUST retry failed embedding requests up to 3 times before failing the batch.

**Resume Capability**

- **FR-021**: System MUST persist progress after each completed batch.
- **FR-022**: System MUST be resumable from the last completed batch after interruption.
- **FR-023**: System MUST discard and reprocess partial batches on resume.
- **FR-024**: System MUST store resume state including: task ID, last completed batch number, total batches.

**Search Functionality**

- **FR-025**: System MUST accept natural language queries for semantic code search.
- **FR-026**: System MUST return results ranked by similarity score (0.0 to 1.0).
- **FR-027**: System MUST include file path, content snippet, line numbers, and score in results.
- **FR-028**: System MUST allow limiting result count (default: 10).
- **FR-029**: System MUST scope searches to a specific task version.
- **FR-030**: System MUST use MongoDB Atlas vector search when available, falling back to in-memory cosine similarity for local MongoDB instances.

**Data Storage**

- **FR-031**: System MUST store all data in MongoDB (localhost:27017 by default).
- **FR-032**: System MUST maintain separate collections for: tasks, files, chunks, embeddings.
- **FR-033**: System MUST create indexes for efficient queries on task_id, file_path, and vector similarity.
- **FR-034**: System MUST compute and store SHA-256 hash for each processed file.

**Server Interface**

- **FR-035**: System MUST expose functionality via localhost-only server (default port: 3100).
- **FR-036**: System MUST respond to all requests in JSON format.
- **FR-037**: System MUST include appropriate error codes and messages for all failure cases.
- **FR-038**: System MUST process extraction tasks in the background without blocking request handling.
- **FR-039**: System MUST queue multiple tasks and process them sequentially (one at a time) to avoid resource contention.

**Observability**

- **FR-040**: System MUST log at INFO level by default, with configurable verbosity via environment variable.
- **FR-041**: System MUST output logs to both console and rotating file (default: logs/ directory, 10MB max per file, 5 file rotation).
- **FR-042**: System MUST log batch start/completion, errors, skipped files, and API rate limit events.

### Key Entities

- **Task**: Represents a single extraction job for a repository. Contains repository path, version number, status (pending/processing/completed/failed), configuration settings, progress tracking, timestamps, and error information if failed.

- **File**: Represents a processed source file. Contains file path (absolute and relative), detected language, size, line count, content hash, batch number, and link to parent task.

- **Chunk**: Represents a segment of file content suitable for embedding. Contains the text content, source file reference, line range (start/end), token count, and link to parent task.

- **Embedding**: Represents the vector representation of a chunk. Contains the vector (1536 dimensions for text-embedding-3-small), model name used, chunk reference, and link to parent task.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new extraction task and receive a task identifier within 2 seconds.

- **SC-002**: System processes 1000 files in under 10 minutes (excluding embedding API time).

- **SC-003**: Users can resume an interrupted task and continue from the last checkpoint within 5 seconds of restart.

- **SC-004**: Search queries return relevant results within 3 seconds for repositories with up to 100,000 chunks.

- **SC-005**: System successfully processes repositories up to 50,000 files without memory issues.

- **SC-006**: Progress reporting updates are available within 1 second of batch completion.

- **SC-007**: 90% of semantic searches return at least one relevant result in the top 5 for common programming queries.

- **SC-008**: System installation completes successfully on first attempt for 95% of users with correct prerequisites.

- **SC-009**: All data from interrupted processing sessions is preserved with zero data loss.

- **SC-010**: System operates entirely locally with only embedding API requiring external network access.

## Clarifications

### Session 2026-02-07

- Q: When multiple extraction tasks are created, should the system process them simultaneously or queue them sequentially? → A: Sequential queuing (one task at a time)
- Q: What default logging level should the system use, and should logs be written to file or console only? → A: Info level with console + rotating file logs
- Q: When new versions of a task are created for the same repository, should old versions be automatically cleaned up? → A: Auto-delete versions older than the last 3
- Q: Should the system require MongoDB Atlas or support local MongoDB with fallback? → A: Support both Atlas vector search and in-memory cosine similarity fallback

## Assumptions

- MongoDB is installed and running on the default port (localhost:27017) before system use.
- Users have valid OpenAI API credentials with access to the embeddings API.
- Target repositories contain primarily text-based source code files.
- Users have read access to the repository directories they want to process.
- The local machine has sufficient disk space for MongoDB storage (approximately 2x the size of source files being indexed).
- Node.js 18 or higher is available on the system.
