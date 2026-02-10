# Domain: Processing &amp; Extraction

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:35:24.889Z

---

## Business Rules

### Repository Path Validation

The system enforces that any extraction task must reference a repository path that exists on the local filesystem. If the path does not exist, the task creation is rejected with a clear error message. This prevents invalid or mistyped paths from entering the system and ensures all extraction jobs are actionable.

**Rationale**: This rule exists to guarantee that only valid, accessible repositories are processed, avoiding wasted resources and user confusion due to silent failures or ambiguous errors.

**Sources**: code_chunks

---

### Task Versioning and Retention

When a new extraction task is created for a repository that has been processed before, the system increments the version number and retains only the last three versions, automatically deleting older versions and their associated data. This ensures historical traceability without unbounded data growth.

**Rationale**: Versioning supports auditability and rollback, while retention limits prevent excessive storage consumption and operational complexity.

**Sources**: code_chunks

---

### Supported File Extensions and Directory Exclusion

The file scanner processes only files with a specific set of extensions (.js, .ts, .py, .go, .rs, .java, .cpp, .c, .h, .md, .json, .yaml, .yml) and excludes directories such as node_modules, .git, dist, and build. Files larger than 1MB are also skipped with a warning.

**Rationale**: This rule ensures that only relevant, processable source files are indexed, optimizing for AI code understanding and avoiding noise or resource exhaustion from binaries or dependencies.

**Sources**: code_chunks

---

### Atomic Batch Processing and Resume

Each batch of files is processed atomically: all files in a batch must be successfully scanned, chunked, and embedded for the batch to be marked complete. If a batch fails, it is rolled back and will be retried upon resume. Progress is persisted after each batch, enabling interruption and resumption without data loss.

**Rationale**: Atomicity ensures data consistency and prevents partial, corrupted states. Resume capability is critical for reliability in the face of interruptions (e.g., server restarts, errors).

**Sources**: code_chunks

---

### Embedding Rate Limiting and Retry

Embedding requests to the external API are batched (max 20 per request), with exponential backoff and up to three retries on failure or rate limiting. If all retries fail, the batch is marked as failed and will be retried on resume.

**Rationale**: This rule ensures robustness against transient API failures and rate limits, maintaining forward progress without manual intervention.

**Sources**: code_chunks

---

### SHA-256 File Hashing

For every processed file, a SHA-256 hash of its content is computed and stored. This enables change detection, deduplication, and efficient reprocessing logic.

**Rationale**: Hashing provides a reliable fingerprint for content-based operations and is foundational for incremental processing and integrity checks.

**Sources**: code_chunks

---


## Program Flows

### Extraction Task Creation

This flow allows a user to register a new repository for processing. It validates the repository path, checks for existing versions, and creates a new task with initial configuration and status.

**Steps**:
1. User submits repository path and optional config.
2. System validates path existence.
3. System checks for existing tasks for the path and determines version.
4. System inserts new task with status &#x27;pending&#x27; and returns taskId and version.

**Sources**: code_chunks

---

### Repository Processing Pipeline

This is the core pipeline that scans the repository, extracts file contents, chunks code, generates embeddings, and stores all artifacts in MongoDB. It is designed for batch-based, resumable execution.

**Steps**:
1. User triggers processing for a pending task.
2. System divides file list into batches according to config.
3. For each batch: scan files, extract content, detect language, compute hash.
4. Chunk file content by token limits and logical boundaries.
5. Batch chunks for embedding, handle API rate limits and retries.
6. Persist files, chunks, and embeddings in MongoDB.
7. Update task progress and mark batch complete.
8. On interruption or error, rollback incomplete batch and persist progress.
9. On resume, continue from last completed batch.

**Sources**: code_chunks

---

### Semantic Code Search

Enables users (or agents) to query the indexed codebase using natural language. The system computes embedding for the query, performs vector similarity search, and returns ranked results with context.

**Steps**:
1. User submits a search query and task identifier.
2. System computes embedding for the query.
3. Performs vector search (Atlas or in-memory cosine similarity).
4. Ranks results by similarity score.
5. Returns file path, content snippet, line numbers, and score.

**Sources**: code_chunks

---


## Domain Models

### Task

Represents a single extraction job for a repository, encapsulating configuration, progress, and lifecycle state.

**Attributes**:
- `taskId`: UUID - Globally unique identifier for the extraction job
- `version`: Integer - Tracks sequential versions for the same repository
- `repositoryPath`: String (absolute path) - Location of the repository to process
- `status`: Enum - Current state: pending, processing, completed, failed
- `progress`: Object - Tracks total/processed files, batches, and completion
- `config`: Object - Batch size, chunk size, overlap, embedding model, extensions
- `createdAt/updatedAt/completedAt`: Date - Lifecycle timestamps
- `error`: String or null - Error message if failed

**Sources**: code_chunks

---

### File

Represents a single processed source file, capturing both its identity and extraction metadata.

**Attributes**:
- `fileId`: UUID - Unique identifier for the file record
- `taskId`: UUID - Links file to its parent extraction task
- `filePath`: String - Absolute path to the file
- `relativePath`: String - Path relative to repository root
- `language`: String - Detected programming language
- `size`: Integer (bytes) - File size for filtering and limits
- `lines`: Integer - Line count for chunking and reporting
- `hash`: SHA-256 String - Content fingerprint for change detection
- `batchNumber`: Integer - Indicates which batch processed this file
- `processedAt`: Date - Timestamp when file was processed

**Sources**: code_chunks

---

### Chunk

A segment of file content, sized and structured for embedding, with line and token metadata.

**Attributes**:
- `chunkId`: UUID - Unique identifier for the chunk
- `taskId`: UUID - Links chunk to extraction task
- `fileId`: UUID - Links chunk to source file
- `content`: String - The actual code or text content
- `startLine`: Integer - First line number in file
- `endLine`: Integer - Last line number in file
- `tokenCount`: Integer - Token count for embedding limits
- `createdAt`: Date - Timestamp of chunk creation

**Sources**: code_chunks

---

### Embedding

A vector representation of a chunk, suitable for semantic search and similarity operations.

**Attributes**:
- `chunkId`: UUID - Links embedding to its chunk
- `taskId`: UUID - Links embedding to extraction task
- `vector`: Array[float] - 1536-dimensional embedding vector
- `model`: String - Embedding model used (e.g., text-embedding-3-small)
- `createdAt`: Date - Timestamp of embedding creation

**Sources**: code_chunks

---


## Contracts & Interfaces

### POST /task

**Purpose**: Allows creation of a new extraction task for a repository.

**Inputs**:
- `repositoryPath (absolute path to code repository)` (string) - **required**
- `config (optional: batchSize, chunkSize, etc.)` (string) - **required**

**Outputs**:
- `taskId (unique identifier for tracking)` (string)
- `version (sequential version number)` (string)
- `status (initially &#x27;pending&#x27;)` (string)

**Sources**: code_chunks

---

### POST /process

**Purpose**: Triggers or resumes processing for a given extraction task.

**Inputs**:
- `taskId (or identifier)` (string) - **required**
- `fileLimit (optional: cap on files to process in this session)` (string) - **required**

**Outputs**:
- `status (processing)` (string)
- `message (confirmation of processing start/resume)` (string)

**Sources**: code_chunks

---

### GET /task/{id}

**Purpose**: Retrieves status and progress for a specific extraction task.

**Inputs**:
- `taskId (or identifier)` (string) - **required**

**Outputs**:
- `taskId, version, status` (string)
- `progress (totalFiles, processedFiles, currentBatch, totalBatches, percentComplete)` (string)

**Sources**: code_chunks

---

### POST /search_code

**Purpose**: Performs semantic search over embedded code for a given task.

**Inputs**:
- `query (natural language)` (string) - **required**
- `taskId or identifier` (string) - **required**
- `limit (optional: max results)` (string) - **required**

**Outputs**:
- `results (filePath, content, startLine, endLine, score)` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- Repository Path Validation: The system enforces that any extraction task must reference a repository path that exists on the local filesystem. If the path does not exist, the task creation is rejected with a clear error message. This prevents invalid or mistyped paths from entering the system and ensures all extraction jobs are actionable.
- Task Versioning and Retention: When a new extraction task is created for a repository that has been processed before, the system increments the version number and retains only the last three versions, automatically deleting older versions and their associated data. This ensures historical traceability without unbounded data growth.
- Supported File Extensions and Directory Exclusion: The file scanner processes only files with a specific set of extensions (.js, .ts, .py, .go, .rs, .java, .cpp, .c, .h, .md, .json, .yaml, .yml) and excludes directories such as node_modules, .git, dist, and build. Files larger than 1MB are also skipped with a warning.
- Atomic Batch Processing and Resume: Each batch of files is processed atomically: all files in a batch must be successfully scanned, chunked, and embedded for the batch to be marked complete. If a batch fails, it is rolled back and will be retried upon resume. Progress is persisted after each batch, enabling interruption and resumption without data loss.
- Embedding Rate Limiting and Retry: Embedding requests to the external API are batched (max 20 per request), with exponential backoff and up to three retries on failure or rate limiting. If all retries fail, the batch is marked as failed and will be retried on resume.
- SHA-256 File Hashing: For every processed file, a SHA-256 hash of its content is computed and stored. This enables change detection, deduplication, and efficient reprocessing logic.
- The system is architected for strict locality: all processing and storage occurs on the user&#x27;s machine, with only embedding API calls leaving the local environment. This supports privacy, security, and compliance.
- Batch-based, resumable processing is a core resilience strategy. By persisting progress after each batch and rolling back on failure, the system guarantees that interruptions or errors do not corrupt state or lose work.
- The use of versioned tasks with retention limits balances traceability (supporting audit and rollback) with operational efficiency (preventing unbounded data growth).
- Vector search is abstracted to support both advanced (Atlas) and fallback (in-memory) implementations, ensuring the system works in constrained or offline environments.
- All APIs are designed with clear, explicit contracts and JSON:API responses, supporting automation, integration, and forward compatibility.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:35:24.889Z)
- **code_chunks**: 50 code chunks analyzed by GPT-4 for Processing &amp; Extraction (retrieved 2026-02-09T14:35:24.889Z)
