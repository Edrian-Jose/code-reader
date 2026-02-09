# Domain: API Layer

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:42:51.342Z

---

## Business Rules

### Identifier Validation Rule

All API endpoints that reference a repository or task require a user-friendly identifier (e.g., &#x27;my-app&#x27;, &#x27;auth-service&#x27;) that matches a strict pattern: 2-100 characters, letters, numbers, hyphens, and underscores only. This prevents ambiguous or unsafe references and ensures compatibility with AI agents and human users.

**Rationale**: Enforcing identifier constraints ensures consistent task referencing, prevents accidental collisions, and supports robust automation and agent-driven workflows.

**Sources**: code_chunks

---

### Token Budget Enforcement

When processing a repository, the API enforces a maximum file limit (&#x27;fileLimit&#x27;) based on a recommended value calculated from repository size and token budget. This prevents runaway processing costs and ensures the system stays within OpenAI API limits.

**Rationale**: This rule exists to protect users from unexpected costs, maintain predictable resource usage, and avoid exceeding external API quotas.

**Sources**: code_chunks

---

### Graceful Stop Rule

Processing tasks can be stopped gracefully via the API, which completes the current batch and marks the task as &#x27;pending&#x27; for safe resumption. Abrupt termination is discouraged to prevent partial or inconsistent data states.

**Rationale**: Graceful stopping ensures data integrity, enables resumable processing, and avoids corruption or loss of progress.

**Sources**: code_chunks

---

### Error Handling and Response Format

All API errors are returned in strict JSON:API format, with standardized error codes, status, and detailed messages. Specific error types (e.g., NotFoundError, ValidationError, ProcessingError) are mapped to HTTP status codes and include relevant metadata.

**Rationale**: Consistent error responses enable reliable client integration, simplify debugging, and support automated error handling by AI agents and external systems.

**Sources**: code_chunks

---

### Version Management Rule

The API automatically manages task and plan versions, keeping the last three versions per identifier and deleting older ones. This prevents data bloat and ensures only relevant, recent versions are available for search and documentation.

**Rationale**: Version management supports reproducibility, rollback, and efficient storage, while avoiding confusion from stale or obsolete data.

**Sources**: code_chunks

---


## Program Flows

### Repository Extraction and Processing Flow

This flow orchestrates the end-to-end extraction, chunking, embedding, and indexing of a repository for semantic search. It ensures that files are scanned, chunked, embedded, and persisted in a controlled, batch-oriented manner.

**Steps**:
1. User creates an extraction task via POST /task, specifying repositoryPath and identifier.
2. System scans the repository, determines total files, and recommends a file limit.
3. User triggers processing via POST /process, optionally specifying fileLimit.
4. Processor divides files into batches, chunks each file, embeds chunks, and persists results.
5. Progress is tracked and exposed via GET /task/{id} or /task/by-identifier/{identifier}.
6. Errors are handled with retries and exponential backoff for embedding API calls.
7. Processing can be stopped gracefully, resuming later from the last completed batch.

**Sources**: code_chunks

---

### Semantic Search Flow

This flow enables semantic search over embedded code chunks, ranking results by cosine similarity to the query. It supports filtering by minimum score and returns results with file paths and line numbers for precise navigation.

**Steps**:
1. User or agent issues POST /search_code with query, identifier, limit, and minScore.
2. System retrieves relevant code chunks, computes similarity, and ranks results.
3. Results are filtered by minScore threshold to ensure relevance.
4. Response includes file path, content, start/end lines, and similarity score.
5. Errors (e.g., task not found, invalid query) are returned in JSON:API format.

**Sources**: code_chunks

---

### Task Progress Monitoring Flow

This flow allows clients to monitor the status and progress of extraction and processing tasks, including batch, file, and percentage completion. It supports polling and real-time updates for automation and user feedback.

**Steps**:
1. Client queries GET /task/{taskId} or /task/by-identifier/{identifier}.
2. System returns task status (pending, processing, completed, failed), progress counters, and error details if any.
3. Progress includes total files, processed files, current batch, and percent complete.
4. If processing is stopped or failed, client can resume or handle errors accordingly.

**Sources**: code_chunks

---


## Domain Models

### Task

Represents a repository extraction and processing job, uniquely identified by taskId or user-friendly identifier. Tracks status, progress, configuration, and versioning.

**Attributes**:
- `taskId`: UUID - Unique reference for the extraction job
- `identifier`: string - Human/agent-friendly name for lookup
- `version`: number - Tracks sequential versions for the same identifier
- `repositoryPath`: string - Absolute path to the target repository
- `status`: enum - Current state (pending, processing, completed, failed)
- `progress`: object - Counters for files, batches, percent complete
- `config`: object - Processing parameters (batchSize, chunkSize, etc.)
- `createdAt`: Date - Timestamp of task creation
- `completedAt`: Date - Timestamp of completion or null

**Sources**: code_chunks

---

### Chunk

Represents a segment of code extracted from a file, with tracked start/end lines and token count. Serves as the atomic unit for embedding and semantic search.

**Attributes**:
- `chunkId`: UUID - Unique reference for the chunk
- `taskId`: UUID - Links chunk to its parent task
- `fileId`: UUID - Links chunk to its source file
- `content`: string - Actual code/text of the chunk
- `startLine`: number - First line in source file
- `endLine`: number - Last line in source file
- `tokenCount`: number - Number of tokens (for embedding budget)

**Sources**: code_chunks

---

### Embedding

Stores the vector representation of a code chunk, enabling semantic search and similarity ranking. Contains model metadata and links to chunk/task.

**Attributes**:
- `embeddingId`: ObjectId - MongoDB internal ID
- `chunkId`: UUID - Links embedding to chunk
- `taskId`: UUID - Links embedding to task
- `vector`: number[] - Embedding vector (1536 dims for text-embedding-3-small)
- `model`: string - Embedding model used
- `createdAt`: Date - Timestamp of embedding creation

**Sources**: code_chunks

---


## Contracts & Interfaces

### Create Task API

**Purpose**: Allows clients to initiate repository extraction and processing, specifying path and identifier.

**Inputs**:
- `repositoryPath: Absolute path to repository` (string) - **required**
- `identifier: User-friendly project name` (string) - **required**
- `config: Optional processing parameters` (string) - **required**

**Outputs**:
- `Task detail: taskId, identifier, version, progress, recommendedFileLimit` (string)

**Sources**: code_chunks

---

### Process Task API

**Purpose**: Triggers background processing for a task, with optional fileLimit for token budget control.

**Inputs**:
- `identifier or taskId: Reference to task` (string) - **required**
- `fileLimit: Maximum files to process` (string) - **required**

**Outputs**:
- `Processing started response` (string)
- `Progress available via task endpoints` (string)

**Sources**: code_chunks

---

### Search Code API

**Purpose**: Performs semantic search over embedded code chunks, returning ranked and filtered results.

**Inputs**:
- `identifier or taskId: Reference to task` (string) - **required**
- `query: Natural language or code search query` (string) - **required**
- `limit: Maximum results` (string) - **required**
- `minScore: Minimum similarity threshold` (string) - **required**

**Outputs**:
- `List of code chunks with file path, content, lines, score` (string)

**Sources**: code_chunks

---

### Task Progress API

**Purpose**: Allows clients to monitor task status and progress in real time.

**Inputs**:
- `taskId or identifier: Reference to task` (string) - **required**

**Outputs**:
- `Task status, progress counters, error details` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- Identifier Validation Rule: All API endpoints that reference a repository or task require a user-friendly identifier (e.g., &#x27;my-app&#x27;, &#x27;auth-service&#x27;) that matches a strict pattern: 2-100 characters, letters, numbers, hyphens, and underscores only. This prevents ambiguous or unsafe references and ensures compatibility with AI agents and human users.
- Token Budget Enforcement: When processing a repository, the API enforces a maximum file limit (&#x27;fileLimit&#x27;) based on a recommended value calculated from repository size and token budget. This prevents runaway processing costs and ensures the system stays within OpenAI API limits.
- Graceful Stop Rule: Processing tasks can be stopped gracefully via the API, which completes the current batch and marks the task as &#x27;pending&#x27; for safe resumption. Abrupt termination is discouraged to prevent partial or inconsistent data states.
- Error Handling and Response Format: All API errors are returned in strict JSON:API format, with standardized error codes, status, and detailed messages. Specific error types (e.g., NotFoundError, ValidationError, ProcessingError) are mapped to HTTP status codes and include relevant metadata.
- Version Management Rule: The API automatically manages task and plan versions, keeping the last three versions per identifier and deleting older ones. This prevents data bloat and ensures only relevant, recent versions are available for search and documentation.
- The API layer is designed for agent-driven automation and human usability, prioritizing user-friendly identifiers over opaque UUIDs to support natural language workflows and AI integration.
- All endpoints follow JSON:API response format, enabling consistent error handling and simplifying client-side consumption, especially for AI agents.
- Processing is batch-oriented and atomic, with explicit support for graceful stopping and resumable workflows. This ensures data integrity and robustness against failures.
- Semantic search leverages vector embeddings and cosine similarity, with configurable filtering to balance precision and recall. MongoDB Atlas vector search is used when available, with in-memory fallback for local development.
- Version management is automatic, keeping only the last three versions per identifier to prevent data bloat and ensure reproducibility.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:42:51.341Z)
- **code_chunks**: 49 code chunks analyzed by GPT-4 for API Layer (retrieved 2026-02-09T14:42:51.341Z)
