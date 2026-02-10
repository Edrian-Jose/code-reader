# Domain: Testing &amp; Fixtures

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:44:53.707Z

---

## Business Rules

### Task Identifier Validation

Every extraction task must have a unique, valid identifier conforming to strict format rules (alphanumeric, hyphens, underscores, 2-100 chars). Tasks with missing or malformed identifiers are rejected, and errors are surfaced to the client.

**Rationale**: Ensures task traceability, prevents ambiguous task references, and supports versioning and data isolation. Invalid identifiers could cause data collisions or orphaned tasks.

**Sources**: code_chunks

---

### Repository Path Existence Validation

Tasks can only be created for repository paths that exist and are accessible. If a non-existent or inaccessible path is provided, task creation fails with a clear error.

**Rationale**: Prevents wasted processing on invalid inputs, ensures that downstream file scanning and chunking operate on real data. Violations would result in failed tasks and wasted resources.

**Sources**: code_chunks

---

### Task Versioning and Old Version Cleanup

When a new task is created for an existing identifier, its version is incremented, and only the last three versions are retained. Older versions are automatically deleted to prevent data bloat.

**Rationale**: Supports reproducibility and rollback for recent extractions while keeping storage usage manageable. Without cleanup, storage would grow unbounded, complicating task management.

**Sources**: code_chunks

---

### Batch Size and Chunk Size Validation

Task configuration parameters such as batchSize and chunkSize are validated against allowed ranges. Invalid values (e.g., batchSize too large) cause task creation to fail.

**Rationale**: Protects system stability and ensures that processing workloads remain within operational limits. Invalid batch sizes could overload memory or API limits.

**Sources**: code_chunks

---

### Progress Calculation and Reporting

Task progress is calculated as a percentage based on processed files and batches, and is surfaced in API responses. Progress must be accurate and reflect real processing state.

**Rationale**: Enables users to monitor extraction progress, supports UX expectations, and prevents misleading status reporting. Inaccurate progress could cause confusion or premature actions.

**Sources**: code_chunks

---

### Atomic Batch Processing and Rollback

Each batch of files is processed atomically: scan, extract, chunk, embed, and persist. If any step fails, all data for that batch is rolled back to maintain consistency.

**Rationale**: Prevents partial or corrupt data from entering the database, supports reliable resume and error recovery. Violations would leave orphaned chunks or embeddings.

**Sources**: code_chunks

---

### Resume Processing from Last Completed Batch

If a processing task is interrupted, it resumes from the last completed batch without reprocessing finished batches. Partial failures are detected and handled.

**Rationale**: Supports robustness and efficiency, prevents duplicate work and ensures that only incomplete batches are retried. Without this, tasks would waste time and resources.

**Sources**: code_chunks

---

### Fixture Directory for Sample Repositories

A dedicated fixture directory (tests/fixtures/sample-repo/) is maintained with diverse file types for testing. Tests must use this directory for reproducibility.

**Rationale**: Ensures that tests are deterministic, cover real-world scenarios, and support regression checks. Without fixtures, tests would be brittle and non-repeatable.

**Sources**: code_chunks

---


## Program Flows

### End-to-End Extraction and Processing Workflow

This workflow covers the full lifecycle: task creation, repository scanning, chunking, embedding, progress tracking, and result verification. It is exercised in integration and E2E tests.

**Steps**:
1. Create extraction task via API with repository path and identifier
2. Scan repository files, filter by extension and exclude directories
3. Extract file content, detect language, compute hashes
4. Chunk files based on token and line limits, track start/end lines
5. Embed chunks in batches, handle rate limits and retries
6. Persist files, chunks, and embeddings atomically per batch
7. Update task progress after each batch, calculate percent complete
8. On error, rollback batch data and mark task as failed
9. On completion, mark task as completed and record statistics

**Sources**: code_chunks

---

### Task API Validation and Response Flow

This flow governs how task-related API endpoints validate input, enforce business rules, and return structured responses. It ensures that only valid tasks are created and queried.

**Steps**:
1. Validate incoming request body and parameters (identifier, path, config)
2. Reject requests with missing or invalid fields, return error codes
3. Create task with unique identifier and version, apply cleanup logic
4. Return JSON:API formatted response with task attributes and progress
5. Support detailed and basic response modes for different endpoints

**Sources**: code_chunks

---

### Fixture-Based Integration Testing Flow

Tests use fixture repositories to simulate realistic extraction scenarios. Temporary directories are created, populated, and cleaned up per test run.

**Steps**:
1. Create temporary directory for test repository
2. Populate with sample files of various types and sizes
3. Run extraction and processing tasks against fixture data
4. Verify database state (files, chunks, embeddings) after processing
5. Clean up fixture directories and database collections post-test

**Sources**: code_chunks

---


## Domain Models

### Task

Represents an extraction job for a repository, tracking configuration, progress, versioning, and error state. Each task is uniquely identified and versioned.

**Attributes**:
- `taskId`: UUID - Unique task identification
- `identifier`: string - User-friendly repository reference
- `version`: integer - Sequential version for reproducibility
- `repositoryPath`: string - Absolute path to repository
- `status`: enum - Tracks task lifecycle state
- `progress`: object - Tracks files, batches, percent complete
- `config`: object - Processing parameters (batchSize, chunkSize, etc.)
- `createdAt`: Date - Task creation timestamp
- `updatedAt`: Date - Last update timestamp
- `completedAt`: Date|null - Completion timestamp
- `error`: string|null - Error message if failed

**Sources**: code_chunks

---

### File

Represents a scanned file in a repository, linked to a task and batch. Tracks file path, language, hash, and batch number.

**Attributes**:
- `fileId`: UUID - Unique file identification
- `taskId`: UUID - Link to parent task
- `filePath`: string - Absolute file path
- `relativePath`: string - Path relative to repository root
- `language`: string - Detected programming language
- `hash`: string - SHA-256 hash for deduplication
- `batchNumber`: integer - Processing batch association

**Sources**: code_chunks

---

### Chunk

Represents a segment of file content, bounded by lines and tokens. Used for embedding and search.

**Attributes**:
- `chunkId`: UUID - Unique chunk identification
- `taskId`: UUID - Link to parent task
- `fileId`: UUID - Link to parent file
- `content`: string - Code/text content
- `startLine`: integer - Start line in file
- `endLine`: integer - End line in file
- `tokenCount`: integer - Number of tokens in chunk

**Sources**: code_chunks

---

### Embedding

Represents a vector embedding of a chunk, used for semantic search. Stores model and vector array.

**Attributes**:
- `chunkId`: UUID - Link to chunk
- `taskId`: UUID - Link to task
- `vector`: float[] - Embedding vector
- `model`: string - Embedding model used

**Sources**: code_chunks

---


## Contracts & Interfaces

### Task API (POST /task, GET /task/{id}, GET /task/by-identifier/{identifier})

**Purpose**: Enables creation, retrieval, and monitoring of extraction tasks

**Inputs**:
- `repositoryPath: Absolute path to repository` (string) - **required**
- `identifier: Unique task reference` (string) - **required**
- `config: Optional processing parameters` (string) - **required**

**Outputs**:
- `Task object with status, progress, version, recommended file limit` (string)
- `Detailed progress and error fields on retrieval` (string)

**Sources**: code_chunks

---

### Processor Service Contract

**Purpose**: Orchestrates batch processing of repository files, chunking, embedding, and persistence

**Inputs**:
- `taskId: Extraction task reference` (string) - **required**
- `batchSize, chunkSize: Processing parameters` (string) - **required**

**Outputs**:
- `Updates task progress and status` (string)
- `Creates files, chunks, embeddings in database` (string)

**Sources**: code_chunks

---

### Fixture Directory Contract

**Purpose**: Provides deterministic sample repositories for testing

**Inputs**:
- `Sample files of various types and sizes` (string) - **required**

**Outputs**:
- `Repeatable test scenarios for extraction, chunking, embedding` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- Task Identifier Validation: Every extraction task must have a unique, valid identifier conforming to strict format rules (alphanumeric, hyphens, underscores, 2-100 chars). Tasks with missing or malformed identifiers are rejected, and errors are surfaced to the client.
- Repository Path Existence Validation: Tasks can only be created for repository paths that exist and are accessible. If a non-existent or inaccessible path is provided, task creation fails with a clear error.
- Task Versioning and Old Version Cleanup: When a new task is created for an existing identifier, its version is incremented, and only the last three versions are retained. Older versions are automatically deleted to prevent data bloat.
- Batch Size and Chunk Size Validation: Task configuration parameters such as batchSize and chunkSize are validated against allowed ranges. Invalid values (e.g., batchSize too large) cause task creation to fail.
- Progress Calculation and Reporting: Task progress is calculated as a percentage based on processed files and batches, and is surfaced in API responses. Progress must be accurate and reflect real processing state.
- Atomic Batch Processing and Rollback: Each batch of files is processed atomically: scan, extract, chunk, embed, and persist. If any step fails, all data for that batch is rolled back to maintain consistency.
- Resume Processing from Last Completed Batch: If a processing task is interrupted, it resumes from the last completed batch without reprocessing finished batches. Partial failures are detected and handled.
- Fixture Directory for Sample Repositories: A dedicated fixture directory (tests/fixtures/sample-repo/) is maintained with diverse file types for testing. Tests must use this directory for reproducibility.
- Testing is deeply integrated with business logic, enforcing real-world scenarios and edge cases via fixtures and integration tests.
- Atomic batch processing and rollback logic ensure that the database remains consistent even in the face of partial failures, supporting robust resume and error recovery.
- Versioning and cleanup mechanisms for tasks prevent storage bloat and support reproducibility, enabling safe parallel development and testing.
- Progress calculation and reporting are treated as first-class concerns, supporting UX and monitoring requirements.
- Validation is centralized and strict, preventing invalid data from entering the system and surfacing clear errors to clients.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:44:53.707Z)
- **code_chunks**: 50 code chunks analyzed by GPT-4 for Testing &amp; Fixtures (retrieved 2026-02-09T14:44:53.707Z)
