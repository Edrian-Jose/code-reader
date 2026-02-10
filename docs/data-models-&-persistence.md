# Domain: Data Models &amp; Persistence

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:33:57.250Z

---

## Business Rules

### Task Versioning and Isolation

Each extraction task and documentation plan is versioned per repository identifier. New tasks or plans increment the version, ensuring that data from different versions is never mixed. This guarantees that each run is isolated and reproducible, preventing accidental overwrites or cross-version contamination.

**Rationale**: Versioning allows for historical comparison, rollback, and ensures that documentation and code extraction are always tied to a specific snapshot of the repository. It supports auditability and enables safe iterative improvements.

**Sources**: code_chunks

---

### Unidirectional State Transitions

Tasks and plans can only transition in one direction: pending → processing/executing → completed/failed. Once completed or failed, they cannot revert to an earlier state. This prevents accidental re-execution and ensures immutable historical records.

**Rationale**: Immutable state transitions provide reliability and traceability, ensuring that once a task or plan is finished, its results are preserved and not subject to accidental modification.

**Sources**: code_chunks

---

### Cascade Deletion

When a task or plan is deleted, all related entities (files, chunks, embeddings, artifacts, external source configs) are deleted in a cascading manner. This prevents orphaned data and maintains referential integrity.

**Rationale**: Cascade deletion ensures that the database remains clean and consistent, avoiding storage bloat and confusion from leftover records.

**Sources**: code_chunks

---

### Local Data Sovereignty

All persistent data, including documentation artifacts, task state, and configuration, must be stored locally. External sources (e.g., Confluence) are only accessed for enrichment and never for storage. No authentication credentials for external sources are stored in the system.

**Rationale**: This rule ensures privacy, compliance, and user control over their data, aligning with constitutional requirements for local-only persistence.

**Sources**: code_chunks

---

### Identifier Uniqueness Per Version

Each plan or task version is uniquely identified by a combination of identifier and version number, preventing collisions and ensuring correct retrieval and isolation.

**Rationale**: Unique identifiers per version are critical for accurate querying, audit trails, and preventing accidental overwrites.

**Sources**: code_chunks

---

### Validation of Chunk and Embedding Constraints

Chunks must be non-empty, have a token count within specified bounds (1–1500), and valid line ranges. Embeddings are generated one per chunk, using a fixed-dimension vector model (1536 dimensions for text-embedding-3-small).

**Rationale**: These constraints ensure semantic search quality, prevent malformed data, and optimize storage and retrieval performance.

**Sources**: code_chunks

---


## Program Flows

### Extraction Task Lifecycle

Handles the creation, processing, and completion of code extraction tasks. Each task scans a repository, processes files in batches, chunks content, generates embeddings, and tracks progress. Errors trigger batch rollback and allow for resumption.

**Steps**:
1. Create task with unique taskId and version for repository
2. Scan repository files, filter by extensions and size
3. Process files in batches, extract content and chunk
4. Generate embeddings for each chunk
5. Insert files, chunks, embeddings in transaction
6. Update task progress and status
7. On error, rollback batch and mark task as failed
8. Allow resume from last completed batch

**Sources**: code_chunks

---

### Documentation Plan Lifecycle

Manages the creation and execution of documentation plans. Plans are decomposed into tasks, each synthesizing documentation for a domain. Tasks are prioritized, executed, and artifacts are generated. Completion triggers plan status update.

**Steps**:
1. Create plan with unique planId, identifier, and version
2. Decompose plan into documentation tasks with domain assignments
3. Prioritize tasks using heuristic
4. Execute tasks: synthesize documentation from sources
5. Generate and persist artifacts
6. Update task and plan progress
7. On completion, mark plan as completed
8. Cascade delete on manual plan removal

**Sources**: code_chunks

---

### Semantic Search Workflow

Enables searching for relevant code snippets using natural language queries. Queries are matched against embeddings, returning ranked code chunks with context.

**Steps**:
1. Receive search query and task version
2. Vectorize query using embedding model
3. Perform vector search against chunk embeddings for task
4. Return ranked results with file path, content, and score

**Sources**: code_chunks

---


## Domain Models

### Task

Represents a code extraction job for a specific repository and version. Tracks progress, configuration, and error state.

**Attributes**:
- `taskId`: UUID - Unique identifier for the task
- `version`: number - Sequential version for repository
- `repositoryPath`: string - Absolute path to repository
- `status`: enum - Current state of the task
- `progress`: object - Tracks files processed and batches
- `config`: object - Batch, chunk, embedding settings
- `timestamps`: object - Created, updated, completed times
- `error`: string|null - Error message if failed

**Sources**: code_chunks

---

### ProcessedFile

Represents a source file processed as part of a task. Stores metadata, language, hash, and batch information.

**Attributes**:
- `fileId`: UUID - Unique identifier for the file
- `taskId`: string - Reference to parent task
- `filePath`: string - Absolute path to file
- `relativePath`: string - Path relative to repo root
- `language`: string - Detected programming language
- `size`: number - File size in bytes
- `lines`: number - Line count
- `hash`: string - SHA-256 hash of content
- `batchNumber`: number - Batch that processed this file
- `processedAt`: Date - Timestamp of processing

**Sources**: code_chunks

---

### Chunk

Represents a segment of file content, optimized for semantic search. Tracks content, line range, token count, and parent file/task.

**Attributes**:
- `chunkId`: UUID - Unique identifier for the chunk
- `taskId`: string - Reference to parent task
- `fileId`: string - Reference to parent file
- `content`: string - Chunked code or text
- `startLine`: number - First line in chunk
- `endLine`: number - Last line in chunk
- `tokenCount`: number - Token count for embedding

**Sources**: code_chunks

---

### Embedding

Stores vector representation of a chunk for semantic search. One embedding per chunk, tied to task and model used.

**Attributes**:
- `chunkId`: string - Reference to source chunk
- `taskId`: string - Reference to parent task
- `vector`: number[] - 1536-dimension float array
- `model`: string - Embedding model used
- `createdAt`: Date - Timestamp of embedding creation

**Sources**: code_chunks

---

### DocumentationPlan

Represents a documentation generation plan for a repository and version. Tracks progress, heuristic used, and error state.

**Attributes**:
- `planId`: UUID - Unique identifier for the plan
- `identifier`: string - User-friendly repository name
- `version`: number - Sequential version
- `repositoryIdentifier`: string - Links to code extraction task
- `status`: enum - Current plan state
- `progress`: object - Tracks tasks completed/failed
- `heuristic`: object - Prioritization heuristic details
- `timestamps`: object - Created, updated, completed times
- `error`: string|null - Error message if failed

**Sources**: code_chunks

---

### DocumentationTask

Atomic unit of work within a documentation plan. Assigns domain, tracks dependencies, status, and artifact reference.

**Attributes**:
- `taskId`: UUID - Unique identifier for the task
- `planId`: string - Reference to parent plan
- `domain`: string - Domain being documented
- `description`: string - Task description
- `priorityScore`: number - Task prioritization
- `dependencies`: string[] - Task dependencies
- `sourcesRequired`: string[] - Required sources
- `status`: enum - Task state
- `artifactRef`: string|null - Reference to generated artifact
- `error`: string|null - Error message if failed

**Sources**: code_chunks

---

### DocumentationArtifact

Represents the output of a completed documentation task. Stores domain sections, citations, markdown content, and generation timestamp.

**Attributes**:
- `artifactId`: UUID - Unique identifier for artifact
- `taskId`: string - Reference to source task
- `planId`: string - Reference to parent plan
- `domainName`: string - Domain documented
- `sections`: object - Business rules, flows, models, etc.
- `citations`: object[] - Source references
- `markdownContent`: string - Generated documentation
- `generatedAt`: Date - Timestamp of generation

**Sources**: code_chunks

---

### ExternalSourceConfig

Configuration for external documentation sources (e.g., Confluence). Stores connection parameters and authentication delegation protocol.

**Attributes**:
- `configId`: UUID - Unique identifier for config
- `planId`: string - Reference to documentation plan
- `sourceType`: string - Type of external source
- `enabled`: boolean - Whether config is active
- `connectionParams`: object - Non-credential connection details
- `authDelegation`: object - Delegation protocol details
- `createdAt`: Date - Creation timestamp
- `updatedAt`: Date - Last update timestamp

**Sources**: code_chunks

---


## Contracts & Interfaces

### Task Creation API

**Purpose**: Enables creation of extraction tasks for repositories, returning task identifiers for tracking and processing.

**Inputs**:
- `repositoryPath (absolute path)` (string) - **required**
- `configuration (batch size, chunk size, etc.)` (string) - **required**

**Outputs**:
- `taskId (unique identifier)` (string)
- `status (pending)` (string)
- `version (for repository)` (string)

**Sources**: code_chunks

---

### Process Repository API

**Purpose**: Triggers processing of repository files, chunking, embedding, and persistence.

**Inputs**:
- `taskId` (string) - **required**
- `fileLimit (max files to process)` (string) - **required**

**Outputs**:
- `Processing status` (string)
- `Progress counters` (string)
- `Error messages if failed` (string)

**Sources**: code_chunks

---

### Documentation Plan Creation API

**Purpose**: Creates documentation generation plans, decomposes into tasks, and tracks progress.

**Inputs**:
- `repositoryIdentifier` (string) - **required**
- `plan configuration (heuristic, domains)` (string) - **required**

**Outputs**:
- `planId (unique identifier)` (string)
- `status (planning)` (string)
- `version` (string)

**Sources**: code_chunks

---

### Documentation Artifact Retrieval API

**Purpose**: Retrieves generated documentation artifacts by plan, task, or domain.

**Inputs**:
- `planId` (string) - **required**
- `taskId` (string) - **required**
- `domainName` (string) - **required**

**Outputs**:
- `Artifact content (sections, markdown)` (string)
- `Citations` (string)
- `Generation timestamp` (string)

**Sources**: code_chunks

---

### External Source Config API

**Purpose**: Manages configuration for external documentation sources, delegating authentication to MCP client.

**Inputs**:
- `planId` (string) - **required**
- `sourceType` (string) - **required**
- `connectionParams` (string) - **required**

**Outputs**:
- `configId` (string)
- `enabled status` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- Task Versioning and Isolation: Each extraction task and documentation plan is versioned per repository identifier. New tasks or plans increment the version, ensuring that data from different versions is never mixed. This guarantees that each run is isolated and reproducible, preventing accidental overwrites or cross-version contamination.
- Unidirectional State Transitions: Tasks and plans can only transition in one direction: pending → processing/executing → completed/failed. Once completed or failed, they cannot revert to an earlier state. This prevents accidental re-execution and ensures immutable historical records.
- Cascade Deletion: When a task or plan is deleted, all related entities (files, chunks, embeddings, artifacts, external source configs) are deleted in a cascading manner. This prevents orphaned data and maintains referential integrity.
- Local Data Sovereignty: All persistent data, including documentation artifacts, task state, and configuration, must be stored locally. External sources (e.g., Confluence) are only accessed for enrichment and never for storage. No authentication credentials for external sources are stored in the system.
- Identifier Uniqueness Per Version: Each plan or task version is uniquely identified by a combination of identifier and version number, preventing collisions and ensuring correct retrieval and isolation.
- Validation of Chunk and Embedding Constraints: Chunks must be non-empty, have a token count within specified bounds (1–1500), and valid line ranges. Embeddings are generated one per chunk, using a fixed-dimension vector model (1536 dimensions for text-embedding-3-small).
- The system adopts a strict versioning and isolation model for all persisted entities, ensuring that every extraction and documentation run is independently queryable and auditable.
- Cascade deletion is enforced at the persistence layer, preventing orphaned records and maintaining referential integrity across all collections.
- Local data sovereignty is a constitutional requirement, driving architectural decisions to avoid external storage and credential persistence.
- All entities follow immutable lifecycle patterns once completed, supporting auditability and preventing accidental modification.
- Semantic search is enabled via vector embeddings, leveraging MongoDB Atlas&#x27;s vector search capabilities for scalable, performant retrieval.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:33:57.250Z)
- **code_chunks**: 50 code chunks analyzed by GPT-4 for Data Models &amp; Persistence (retrieved 2026-02-09T14:33:57.250Z)
