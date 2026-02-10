# Domain: Search &amp; Embedding

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:40:54.916Z

---

## Business Rules

### Semantic Search Query Validation

All search queries must be non-empty strings, and the result limit must be between 1 and 100. The minimum similarity score for results must be between 0 and 1. These constraints are strictly enforced before any search is performed.

**Rationale**: Ensures that the search system receives meaningful and bounded input, preventing resource exhaustion, nonsensical queries, and inconsistent scoring. Protects the system from abuse and accidental overload.

**Sources**: code_chunks

---

### Task Existence Enforcement

Every search operation is scoped to a specific extraction task (repository version). The system verifies that the given taskId exists before proceeding with search or embedding operations.

**Rationale**: Prevents orphaned or cross-repository searches, ensuring that all search results are contextually relevant to a specific codebase snapshot. This maintains data isolation and version correctness.

**Sources**: code_chunks

---

### Embedding Generation Batching and Rate Limiting

Text inputs for embedding are always batched in groups of up to 20 per API call. If the embedding service returns a rate limit or server error, the system retries the batch up to 3 times with exponential backoff (starting at 1s, doubling up to 60s).

**Rationale**: Prevents API quota exhaustion and maximizes throughput while respecting external service constraints. Ensures reliability and fairness when integrating with third-party APIs.

**Sources**: code_chunks

---

### One Embedding Per Chunk Invariant

Each code chunk must have at most one embedding vector stored, uniquely identified by chunkId. The system enforces uniqueness at the database level.

**Rationale**: Prevents inconsistent or duplicate vector data, which would corrupt semantic search results and increase storage costs. Guarantees a one-to-one mapping between code chunks and their vector representations.

**Sources**: code_chunks

---

### Fallback to In-Memory Search When Vector Index Unavailable

If MongoDB Atlas Vector Search is not detected or available, the system automatically falls back to in-memory cosine similarity search over all embeddings for the task.

**Rationale**: Ensures the search feature remains available regardless of infrastructure, providing graceful degradation for local development or unsupported environments.

**Sources**: code_chunks

---


## Program Flows

### Semantic Code Search Workflow

Executes a semantic search for code snippets relevant to a natural language query within a specific repository version. Dynamically selects the optimal search backend and returns ranked, filtered results.

**Steps**:
1. Validate search query, result limit, and minimum score.
2. Verify that the referenced extraction task exists.
3. Generate an embedding vector for the search query using the embedding service.
4. Detect whether MongoDB Atlas Vector Search is available (on first use).
5. If Atlas Vector Search is available, perform a vector search aggregation query filtered by taskId; otherwise, fetch all embeddings for the task and compute cosine similarity in memory.
6. Sort and filter results by similarity score, returning only those above the minimum threshold.
7. Map embedding results back to code chunk metadata (file path, content, line numbers) for presentation.

**Sources**: code_chunks

---

### Batch Embedding Generation

Generates vector embeddings for code chunks in batches, handling API rate limits and errors robustly. Ensures all chunks are embedded before proceeding.

**Steps**:
1. Split input texts into batches of up to 20 items.
2. For each batch, attempt to generate embeddings using the external API.
3. If a rate limit or server error occurs, wait (exponential backoff) and retry up to 3 times.
4. On success, collect and index the resulting vectors by their input order.
5. If all retries fail, abort the batch and raise an error.

**Sources**: code_chunks

---

### Atlas Search Detection and Selection

Determines at runtime whether MongoDB Atlas Vector Search is available and configures the search backend accordingly. This is performed once per process and cached.

**Steps**:
1. Query MongoDB build information to detect Atlas or Enterprise features.
2. Attempt to list vector search indexes on the embeddings collection.
3. If a suitable index is found, enable Atlas Vector Search; otherwise, use in-memory fallback.
4. Log the detection outcome for observability.

**Sources**: code_chunks

---


## Domain Models

### Embedding

Represents the vectorized semantic representation of a code chunk, used for similarity search.

**Attributes**:
- `chunkId`: UUID - Links the embedding to its source code chunk.
- `taskId`: UUID - Scopes the embedding to a specific extraction task (repository version).
- `vector`: float[1536] - The high-dimensional vector representing the chunk&#x27;s semantics.
- `model`: string - Records which embedding model was used (e.g., text-embedding-3-small).
- `createdAt`: DateTime - Tracks when the embedding was generated.

**Sources**: code_chunks

---

### Chunk

A logically-bounded segment of code or documentation, small enough for embedding and semantic search.

**Attributes**:
- `chunkId`: UUID - Unique identifier for the chunk.
- `taskId`: UUID - Scopes the chunk to a specific extraction task.
- `fileId`: ObjectId - Links to the source file.
- `filePath`: string - Records the absolute or relative path of the source file.
- `content`: string - The actual code or documentation text.
- `startLine`: int - First line of the chunk in the file.
- `endLine`: int - Last line of the chunk in the file.
- `tokenCount`: int - Number of tokens in the chunk (for embedding limits).
- `createdAt`: DateTime - When the chunk was created.

**Sources**: code_chunks

---

### Task

Represents a single extraction and indexing job for a repository, including configuration and progress tracking.

**Attributes**:
- `taskId`: UUID - Unique identifier for the extraction job.
- `version`: int - Version number for repeated extractions of the same repository.
- `repositoryPath`: string - Absolute path to the repository being processed.
- `status`: enum - Current state (pending, processing, completed, failed).
- `progress`: object - Tracks batch/file progress for resumability.
- `config`: object - Stores batch size, chunk size, embedding model, and other settings.
- `createdAt`: DateTime - When the task was created.
- `updatedAt`: DateTime - When the task was last updated.
- `completedAt`: DateTime|null - When the task finished or null if incomplete.
- `error`: string|null - Error message if the task failed.

**Sources**: code_chunks

---


## Contracts & Interfaces

### Semantic Search API (search_code endpoint)

**Purpose**: Enables clients to perform semantic search over indexed code for a specific repository version.

**Inputs**:
- `query: Natural language string describing the information need.` (string) - **required**
- `taskId: UUID specifying the extraction task to search within.` (string) - **required**
- `limit: Maximum number of results (default 10, max 100).` (string) - **required**
- `minScore: Minimum similarity score threshold (default 0.7).` (string) - **required**

**Outputs**:
- `results: Array of objects with filePath, content, startLine, endLine, and similarity score.` (string)

**Sources**: code_chunks

---

### Embedding Generation Interface

**Purpose**: Abstracts the process of generating vector representations for code/documentation chunks.

**Inputs**:
- `texts: Array of strings (code or documentation snippets).` (string) - **required**

**Outputs**:
- `embeddings: Array of objects with index and vector (float array).` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- Semantic Search Query Validation: All search queries must be non-empty strings, and the result limit must be between 1 and 100. The minimum similarity score for results must be between 0 and 1. These constraints are strictly enforced before any search is performed.
- Task Existence Enforcement: Every search operation is scoped to a specific extraction task (repository version). The system verifies that the given taskId exists before proceeding with search or embedding operations.
- Embedding Generation Batching and Rate Limiting: Text inputs for embedding are always batched in groups of up to 20 per API call. If the embedding service returns a rate limit or server error, the system retries the batch up to 3 times with exponential backoff (starting at 1s, doubling up to 60s).
- One Embedding Per Chunk Invariant: Each code chunk must have at most one embedding vector stored, uniquely identified by chunkId. The system enforces uniqueness at the database level.
- Fallback to In-Memory Search When Vector Index Unavailable: If MongoDB Atlas Vector Search is not detected or available, the system automatically falls back to in-memory cosine similarity search over all embeddings for the task.
- The system is designed for robust, infrastructure-agnostic operation: it automatically detects and leverages advanced vector search capabilities (MongoDB Atlas) when available, but gracefully falls back to in-memory search for local or unsupported environments. This maximizes both performance and portability.
- All search and embedding operations are strictly scoped to a &#x27;task&#x27; (repository version), ensuring strong data isolation, support for versioned codebases, and safe concurrent use.
- Batching, retry logic, and exponential backoff are first-class citizens in the embedding pipeline, reflecting a design that anticipates and mitigates external API limitations (rate limits, outages) without manual intervention.
- The domain model enforces strong invariants (e.g., one embedding per chunk, unique chunk IDs, atomic batch processing), which protects against data corruption and ensures search accuracy.
- The system is built for horizontal scalability: all operations are idempotent, resumable, and designed to handle large codebases (100k+ files) without memory issues, thanks to batch processing and efficient indexing.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:40:54.916Z)
- **code_chunks**: 50 code chunks analyzed by GPT-4 for Search &amp; Embedding (retrieved 2026-02-09T14:40:54.916Z)
