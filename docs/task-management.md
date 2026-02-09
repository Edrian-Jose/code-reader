# Domain: Task Management

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:34:31.745Z

---

## Business Rules

### Unique Identifier and Versioning Enforcement

Each extraction task must have a user-friendly identifier that is unique per repository and version. When creating a new task, the system checks for existing tasks with the same identifier and increments the version number, ensuring historical traceability and preventing accidental overwrites.

**Rationale**: This rule ensures that multiple extractions of the same repository can be tracked independently, supporting auditability and rollback. It also enables users to reference tasks by human-readable identifiers, improving usability.

**Sources**: code_chunks

---

### Identifier Format Validation

Identifiers must be 2-100 characters, containing only alphanumeric characters, hyphens, and underscores. This is strictly validated at task creation and search endpoints, with clear error messages for violations.

**Rationale**: This prevents ambiguous or malformed identifiers, ensuring consistency and preventing accidental collisions or injection risks. It also aligns with business requirements for user-facing task tracking.

**Sources**: code_chunks

---

### Task Status Transition Integrity

Tasks can only transition between defined states: &#x27;pending&#x27;, &#x27;processing&#x27;, &#x27;completed&#x27;, and &#x27;failed&#x27;. The system enforces atomic transitions, setting timestamps (completedAt) and error fields as appropriate. Invalid transitions (e.g., processing a completed task) are prevented.

**Rationale**: This rule guarantees reliable tracking of task progress and prevents inconsistent states that could lead to data corruption or user confusion.

**Sources**: code_chunks

---

### Recommended File Limit Calculation

Upon task creation, the system scans the repository, counts files, and calculates a recommended file limit based on a token budget (~200,000 tokens), using the formula: 200,000 ÷ (chunkSize × 1.5). The minimum limit is always 10 files, regardless of chunk size.

**Rationale**: This ensures that processing tasks remain within resource constraints, preventing runaway costs or memory issues. It also guides users to optimal batch sizes for embedding operations.

**Sources**: code_chunks

---

### Atomic Batch Processing and Rollback

Each batch of files is processed atomically: scan, extract, chunk, embed, and persist. If any step fails, partial data for the batch is deleted, and progress is not advanced. This prevents partial/inconsistent state in the database.

**Rationale**: Atomicity is critical for data integrity, especially in long-running tasks. It ensures that failed batches do not leave orphaned or incomplete records, supporting reliable resume and audit.

**Sources**: code_chunks

---

### Old Task Version Cleanup

Only the last 3 versions of a task per identifier are retained. Older versions are deleted, including all related files, chunks, and embeddings, to conserve storage and maintain manageable history.

**Rationale**: This prevents unbounded growth of historical data, balancing auditability with resource efficiency. It also ensures that only relevant versions are available for search and analysis.

**Sources**: code_chunks

---

### Progress Tracking and Resume Capability

Task progress is tracked per batch, including files processed, batches completed, and percentage complete. If processing is interrupted, the system can resume from the last completed batch, ensuring no data is lost and work is not duplicated.

**Rationale**: Reliable progress tracking is essential for long-running, potentially interrupted processes. It supports robust recovery and user confidence in system reliability.

**Sources**: code_chunks

---


## Program Flows

### Task Creation Workflow

Creates a new extraction task for a repository, validates inputs, scans files, calculates limits, and persists metadata. Ensures the task is ready for processing and provides users with tracking information.

**Steps**:
1. Validate repository path and identifier format
2. Check for existing tasks, determine next version
3. Merge user config with defaults
4. Scan repository to count files
5. Calculate recommended file limit based on token budget
6. Create task record with status &#x27;pending&#x27;
7. Insert task into database
8. Clean up old task versions

**Sources**: code_chunks

---

### Task Processing Workflow

Processes a task in the background, dividing files into batches, extracting and embedding content, updating progress, and handling errors. Ensures atomicity and supports resume on failure.

**Steps**:
1. Start processing task (status &#x27;processing&#x27;)
2. Divide files into batches (configurable size)
3. For each batch: scan, extract, chunk, embed, persist
4. On batch failure: rollback partial data, log error
5. After each batch: update task progress in database
6. On completion: set status &#x27;completed&#x27;, record timestamps
7. On error: set status &#x27;failed&#x27;, record error details

**Sources**: code_chunks

---

### Task Status Query Workflow

Allows clients to query the status and progress of a task, returning detailed information including file counts, batches, percentage, and errors. Supports polling during processing.

**Steps**:
1. Receive GET /task/{id} request
2. Lookup task by UUID or identifier (latest version)
3. Return task details: status, progress, config, timestamps, errors
4. Handle 404 for non-existent tasks

**Sources**: code_chunks

---

### Task Deletion Workflow

Deletes a task and all associated data (files, chunks, embeddings) from the database, ensuring no orphaned records remain.

**Steps**:
1. Delete embeddings where taskId matches
2. Delete chunks where taskId matches
3. Delete files where taskId matches
4. Delete task record

**Sources**: code_chunks

---

### Sequential Task Queue Processing

Manages a queue of tasks to be processed sequentially, ensuring only one task is processed at a time and handling errors gracefully.

**Steps**:
1. Enqueue task with execution callback
2. Process next task if not already processing
3. Execute task, handle completion or failure
4. On completion, dequeue and process next
5. Expose queue status and current task

**Sources**: code_chunks

---


## Domain Models

### Task

Represents an extraction process for a specific repository, encapsulating configuration, progress, status, and versioning. Serves as the root entity for all downstream processing and data linkage.

**Attributes**:
- `taskId`: UUID - Globally unique identifier for tracking and linking
- `identifier`: String - User-friendly name for task, supports versioning
- `version`: Integer - Sequential version number for identifier
- `repositoryPath`: String - Absolute path to repository being processed
- `status`: Enum - Current state of task (pending, processing, completed, failed)
- `progress`: Object - Tracks files processed, batches, and completion percentage
- `config`: Object - Extraction settings (batch size, chunk size, etc.)
- `recommendedFileLimit`: Integer - Guides optimal file count per processing session
- `createdAt`: Date - Timestamp for audit and lifecycle tracking
- `updatedAt`: Date - Timestamp for last update
- `completedAt`: Date|null - Timestamp for completion
- `error`: String|null - Error message if task failed

**Sources**: code_chunks

---

### TaskConfig

Defines extraction parameters for a task, including batch size, chunk size, embedding model, file extensions, and exclusion rules. Allows fine-tuning of processing behavior.

**Attributes**:
- `batchSize`: Integer - Number of files per batch
- `chunkSize`: Integer - Target tokens per chunk
- `chunkOverlap`: Integer - Token overlap between chunks
- `embeddingModel`: String - Model used for embeddings
- `extensions`: Array&lt;String&gt; - File types to include
- `excludeDirs`: Array&lt;String&gt; - Directories to exclude
- `maxFileSize`: Integer - Maximum file size in bytes

**Sources**: code_chunks

---

### TaskProgress

Tracks the progress of a task, including total files, processed files, current batch, and total batches. Used for monitoring and resume logic.

**Attributes**:
- `totalFiles`: Integer - Total files found in repository
- `processedFiles`: Integer - Files processed so far
- `currentBatch`: Integer - Current batch number
- `totalBatches`: Integer - Total number of batches

**Sources**: code_chunks

---


## Contracts & Interfaces

### Create Task API

**Purpose**: Allows clients to create new extraction tasks for repositories, specifying configuration and identifier.

**Inputs**:
- `repositoryPath: Absolute path to repository` (string) - **required**
- `identifier: User-friendly task name` (string) - **required**
- `config: Optional extraction parameters` (string) - **required**

**Outputs**:
- `TaskResponse: Contains taskId, identifier, version, status, totalFiles, recommendedFileLimit, config` (string)

**Sources**: code_chunks

---

### Process Task API

**Purpose**: Triggers background processing of a task, dividing files into batches and updating progress.

**Inputs**:
- `taskId: UUID of task to process` (string) - **required**
- `fileLimit: Optional cap on files processed` (string) - **required**

**Outputs**:
- `ProcessResponse: Status and message indicating processing started` (string)

**Sources**: code_chunks

---

### Get Task Status API

**Purpose**: Allows clients to query the status and progress of a task, including completion percentage and errors.

**Inputs**:
- `taskId or identifier: Task lookup` (string) - **required**

**Outputs**:
- `TaskDetailResponse: Detailed task info` (string)

**Sources**: code_chunks

---

### Delete Task API

**Purpose**: Deletes a task and all associated data, ensuring no orphaned records.

**Inputs**:
- `taskId: UUID of task to delete` (string) - **required**

**Outputs**:
- `Confirmation of deletion` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- Unique Identifier and Versioning Enforcement: Each extraction task must have a user-friendly identifier that is unique per repository and version. When creating a new task, the system checks for existing tasks with the same identifier and increments the version number, ensuring historical traceability and preventing accidental overwrites.
- Identifier Format Validation: Identifiers must be 2-100 characters, containing only alphanumeric characters, hyphens, and underscores. This is strictly validated at task creation and search endpoints, with clear error messages for violations.
- Task Status Transition Integrity: Tasks can only transition between defined states: &#x27;pending&#x27;, &#x27;processing&#x27;, &#x27;completed&#x27;, and &#x27;failed&#x27;. The system enforces atomic transitions, setting timestamps (completedAt) and error fields as appropriate. Invalid transitions (e.g., processing a completed task) are prevented.
- Recommended File Limit Calculation: Upon task creation, the system scans the repository, counts files, and calculates a recommended file limit based on a token budget (~200,000 tokens), using the formula: 200,000 ÷ (chunkSize × 1.5). The minimum limit is always 10 files, regardless of chunk size.
- Atomic Batch Processing and Rollback: Each batch of files is processed atomically: scan, extract, chunk, embed, and persist. If any step fails, partial data for the batch is deleted, and progress is not advanced. This prevents partial/inconsistent state in the database.
- Old Task Version Cleanup: Only the last 3 versions of a task per identifier are retained. Older versions are deleted, including all related files, chunks, and embeddings, to conserve storage and maintain manageable history.
- Progress Tracking and Resume Capability: Task progress is tracked per batch, including files processed, batches completed, and percentage complete. If processing is interrupted, the system can resume from the last completed batch, ensuring no data is lost and work is not duplicated.
- Task Management is designed around atomic batch processing to ensure data integrity and efficient resource usage. By tracking progress and enforcing strict state transitions, the system supports robust resume and recovery for long-running tasks.
- Versioned identifiers allow for human-friendly task tracking and historical audit, while cleanup policies prevent unbounded storage growth.
- All entities are linked via taskId, enabling strict isolation of data per extraction session and supporting multi-tenant or multi-project scenarios.
- Progress tracking and resume logic are implemented at the batch level, allowing for granular recovery and preventing duplication of work.
- The system avoids direct file system reads for downstream processing, relying on indexed code chunks and metadata to comply with constitutional requirements.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:34:31.745Z)
- **code_chunks**: 50 code chunks analyzed by GPT-4 for Task Management (retrieved 2026-02-09T14:34:31.745Z)
