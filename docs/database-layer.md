# Domain: Database Layer

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:33:21.335Z

---

## Business Rules

### Unique Task Identifier Enforcement

Each extraction task is assigned a globally unique &#x27;taskId&#x27; (UUID v4). The database enforces uniqueness through an index, preventing duplicate tasks for the same repository and version. This ensures that task progress, status, and associated data are isolated and traceable to a single logical operation.

**Rationale**: Guarantees atomicity and traceability of extraction operations, preventing accidental overwrites or ambiguity in task tracking.

**Sources**: code_chunks

---

### File Deduplication Within Task

Files processed for a given task are uniquely identified by a composite index of &#x27;taskId&#x27; and &#x27;filePath&#x27;. This prevents the same file from being processed multiple times within a single extraction run, ensuring consistency in chunking and embedding generation.

**Rationale**: Avoids redundant processing and storage, ensuring that each file contributes only once to the semantic search index for a task.

**Sources**: code_chunks

---

### Chunk Content Validation

Chunks extracted from files must contain non-empty content, have a token count between 1 and 1500, and startLine/endLine values that are logically consistent (startLine &gt;&#x3D; 1, endLine &gt;&#x3D; startLine). These constraints are enforced both in code and via schema validation rules.

**Rationale**: Ensures semantic search operates on meaningful, contextually valid segments, preventing errors in downstream embedding and retrieval.

**Sources**: code_chunks

---

### One Embedding Per Chunk

Each chunk is represented by a single embedding vector. The database enforces this via a unique index on &#x27;chunkId&#x27; in the embeddings collection, preventing multiple embeddings for the same chunk.

**Rationale**: Maintains a one-to-one mapping between content and semantic representation, ensuring deterministic search results and efficient storage.

**Sources**: code_chunks

---

### Batch Atomicity in Processing

When processing files in batches, all related files, chunks, and embeddings are inserted in a single transaction. If any error occurs, the batch is rolled back, and all partial data is deleted. This guarantees that partial or inconsistent batch states never persist.

**Rationale**: Ensures data integrity and simplifies recovery from failures, preventing orphaned or incomplete records.

**Sources**: code_chunks

---


## Program Flows

### Extraction Task Lifecycle

Manages the full lifecycle of a code extraction task, from creation through processing to completion or failure. Ensures that all related entities (files, chunks, embeddings) are linked and versioned, and that progress is tracked and recoverable.

**Steps**:
1. Generate unique taskId and determine version based on repository history
2. Insert task document with status &#x27;pending&#x27;
3. Process files in batches: scan, chunk, embed, and persist
4. Update task progress after each batch
5. On completion, mark task as &#x27;completed&#x27;; on error, mark as &#x27;failed&#x27; and clean up batch data

**Sources**: code_chunks

---

### Batch File Processing and Embedding

Processes files in batches for scalability and resilience. Each batch reads files, extracts content, chunks them, generates embeddings, and inserts all related records atomically. Progress is tracked, and errors trigger batch rollback.

**Steps**:
1. Read batch of files based on task config
2. Extract content and metadata for each file
3. Chunk content into segments with overlap
4. Generate embeddings for each chunk
5. Insert files, chunks, embeddings in a transaction
6. Update task progress; on error, delete batch data

**Sources**: code_chunks

---

### Task Deletion and Data Cleanup

Manual deletion of a task triggers cascading removal of all associated embeddings, chunks, files, and the task document itself. This ensures no orphaned or stale data remains in the database.

**Steps**:
1. Delete embeddings where taskId matches
2. Delete chunks where taskId matches
3. Delete files where taskId matches
4. Delete task document

**Sources**: code_chunks

---


## Domain Models

### Task

Represents a single extraction operation for a repository, encapsulating configuration, progress, and versioning. Tasks are the root entity for all downstream processing and data linkage.

**Attributes**:
- `taskId`: UUID - Globally unique identifier for the extraction operation
- `version`: number - Tracks sequential extraction runs for a repository
- `repositoryPath`: string - Absolute path to the codebase being processed
- `status`: enum - Current state of the task (pending, processing, completed, failed)
- `progress`: object - Tracks batch/file progress for monitoring and recovery
- `config`: object - Extraction parameters (batch size, chunk size, embedding model, etc.)
- `createdAt`: Date - Timestamp for task creation
- `updatedAt`: Date - Timestamp for last update
- `completedAt`: Date | null - Timestamp for completion
- `error`: string | null - Error message if task failed

**Sources**: code_chunks

---

### File

Represents a single file processed within a task, storing metadata and linkage to its parent task. Files are deduplicated and tracked for batch processing and progress.

**Attributes**:
- `fileId`: UUID - Unique identifier for the file within the task
- `taskId`: UUID - Reference to parent extraction task
- `filePath`: string - Absolute path for traceability
- `relativePath`: string - Path relative to repository root
- `language`: string - Detected programming language
- `size`: number - File size in bytes
- `lines`: number - Line count for chunking
- `hash`: string - SHA-256 hash for integrity and deduplication
- `batchNumber`: number - Batch identifier for scalable processing
- `processedAt`: Date - Timestamp for processing

**Sources**: code_chunks

---

### Chunk

Represents a segment of file content, optimized for semantic search and embedding. Chunks are linked to files and tasks, and validated for content and token limits.

**Attributes**:
- `chunkId`: UUID - Unique identifier for the chunk
- `taskId`: UUID - Reference to parent task
- `fileId`: UUID - Reference to source file
- `filePath`: string - Denormalized for search and display
- `content`: string - Actual text content for embedding
- `startLine`: number - First line number in file
- `endLine`: number - Last line number in file
- `tokenCount`: number - Token count for embedding constraints
- `createdAt`: Date - Timestamp for chunk creation

**Sources**: code_chunks

---

### Embedding

Represents the semantic vector for a chunk, enabling fast and accurate code search. Embeddings are linked one-to-one with chunks and tasks, and indexed for vector search.

**Attributes**:
- `chunkId`: UUID - Reference to source chunk
- `taskId`: UUID - Reference to parent task
- `vector`: number[] - 1536-dimension float array for semantic search
- `model`: string - Embedding model used (e.g., text-embedding-3-small)
- `createdAt`: Date - Timestamp for embedding creation

**Sources**: code_chunks

---


## Contracts & Interfaces

### Collection Access Interfaces

**Purpose**: Provides strongly-typed access to MongoDB collections for each domain entity (Task, File, Chunk, Embedding). Ensures type safety, encapsulation, and consistent access patterns across the database layer.

**Inputs**:
- `Collection name (business entity)` (string) - **required**
- `Entity type (schema definition)` (string) - **required**

**Outputs**:
- `MongoDB Collection instance for CRUD operations` (string)

**Sources**: code_chunks

---

### Index Management Contract

**Purpose**: Defines and enforces all required indexes for each collection, guaranteeing fast lookup, uniqueness, and efficient search. Includes vector search index for embeddings.

**Inputs**:
- `Collection instance` (string) - **required**
- `Index definition (fields, uniqueness)` (string) - **required**

**Outputs**:
- `Index creation and validation` (string)

**Sources**: code_chunks

---

### Database Initialization Script

**Purpose**: Automates creation of collections and indexes, ensuring the database is ready for extraction and search operations. Handles idempotency and error recovery.

**Inputs**:
- `Database connection` (string) - **required**
- `Collection and index definitions` (string) - **required**

**Outputs**:
- `Database with all collections and indexes created` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- Unique Task Identifier Enforcement: Each extraction task is assigned a globally unique &#x27;taskId&#x27; (UUID v4). The database enforces uniqueness through an index, preventing duplicate tasks for the same repository and version. This ensures that task progress, status, and associated data are isolated and traceable to a single logical operation.
- File Deduplication Within Task: Files processed for a given task are uniquely identified by a composite index of &#x27;taskId&#x27; and &#x27;filePath&#x27;. This prevents the same file from being processed multiple times within a single extraction run, ensuring consistency in chunking and embedding generation.
- Chunk Content Validation: Chunks extracted from files must contain non-empty content, have a token count between 1 and 1500, and startLine/endLine values that are logically consistent (startLine &gt;&#x3D; 1, endLine &gt;&#x3D; startLine). These constraints are enforced both in code and via schema validation rules.
- One Embedding Per Chunk: Each chunk is represented by a single embedding vector. The database enforces this via a unique index on &#x27;chunkId&#x27; in the embeddings collection, preventing multiple embeddings for the same chunk.
- Batch Atomicity in Processing: When processing files in batches, all related files, chunks, and embeddings are inserted in a single transaction. If any error occurs, the batch is rolled back, and all partial data is deleted. This guarantees that partial or inconsistent batch states never persist.
- The database layer is designed for versioned, task-scoped data isolation. Each extraction operation is encapsulated as a Task, with all downstream entities (File, Chunk, Embedding) linked via taskId. This enables concurrent processing, rollback, and historical traceability without cross-task contamination.
- Batch processing and atomic transactions are used to scale extraction while guaranteeing data integrity. If any part of a batch fails, all related data is rolled back, preventing partial or inconsistent states.
- Vector search is enabled via MongoDB Atlas Search, allowing semantic code retrieval at scale. Embeddings are indexed with a knnVector index, supporting cosine similarity queries for fast and accurate search.
- All schema and index definitions are centralized and enforced at initialization, simplifying maintenance and ensuring consistent performance across environments.
- Manual deletion flows are provided for full data cleanup, supporting GDPR and operational requirements for data removal.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:33:21.334Z)
- **code_chunks**: 50 code chunks analyzed by GPT-4 for Database Layer (retrieved 2026-02-09T14:33:21.334Z)
