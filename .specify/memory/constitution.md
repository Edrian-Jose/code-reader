<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 2.0.0 (MAJOR - v2 Reconstruction)

Modified principles:
  - Batch Processing → Atomic Batch Processing (expanded with transaction semantics)
  - Resume Capability → Stateful Resume Capability (clarified state machine)
  - Local-Only Execution → Privacy-First Local Execution (expanded security boundaries)
  - Task Versioning → Task Lifecycle & Versioning (added lifecycle management)
  - Incremental Development → Removed (moved to governance as practice, not principle)

Added sections:
  - Section 3.1: Business Domain Invariants (NEW)
  - Section 3.2: Domain Model Integrity (NEW - canonical entities with lifecycle rules)
  - Section 3.3: System Responsibilities & Boundaries (NEW - bounded contexts)
  - Section 3.4: Program Logic & Workflow Invariants (NEW - core workflows)
  - Section 3.5: Contracts & Interfaces (NEW - API contracts)
  - Section 3.6: User Stories & Guarantees (NEW - acceptance criteria)
  - Section 4: Architectural Principles (EXPANDED - from technical constraints)
  - Section 5: Evolution Rules (NEW)
  - Section 6: Anti-Goals (NEW)
  - Section 7: Relationship to /specify (NEW)

Removed sections:
  - "MCP Server Responsibilities" (moved to Contracts & Interfaces section)
  - "Technical Constraints" (elevated to Architectural Principles)
  - Incremental Development principle (moved to governance as development practice)

Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ Validated (Constitution Check section aligns)
  - .specify/templates/spec-template.md: ✅ Validated (User stories template aligned)
  - .specify/templates/tasks-template.md: ✅ Validated (Phased approach aligned)

Follow-up TODOs: None

Rationale for MAJOR version:
  - Complete restructuring from implementation-focused to business-domain focused
  - Backward incompatible governance changes (specifications must now reference constitution)
  - Added mandatory sections for all future specifications
  - Redefined principle categories using reconstruction-grade terminology
-->

# Code Reader MCP System - Constitution v2.0

**Project Name**: Code Reader MCP System
**Purpose**: Local-first semantic code extraction, embedding, and search system
**Version**: 2.0.0
**Ratified**: 2026-02-07
**Last Amended**: 2026-02-07

---

## Constitutional Authority Statement

> "This constitution defines the immutable principles and governing rules of the Code Reader MCP System. All future specifications, implementations, and evolutions MUST conform to it unless an explicit constitutional amendment is made."

---

## 1. Purpose & Scope

This constitution establishes the governing principles for the Code Reader MCP System, a local-first service that:

- Extracts source code from repositories in configurable batches
- Generates semantic embeddings using OpenAI's embedding API
- Enables natural language search over embedded codebases
- Supports AI agents through user-friendly identifiers and budget controls

The constitution MUST enable:

- **v2 Reconstruction**: System can be rebuilt from documentation alone without referencing original code
- **Consistent Evolution**: Features can be added without violating core principles
- **Technology Replacement**: Infrastructure can change without business logic drift
- **Multi-Team Development**: Teams can work independently without semantic conflicts

---

## 2. Authoritative Sources

This constitution is derived exclusively from:

1. **Feature Specifications**: `specs/001-mcp-code-reader/spec.md` and `specs/002-ai-agent-enhancements/spec.md`
2. **Data Model Documentation**: `specs/001-mcp-code-reader/data-model.md`
3. **System Documentation**: README.md, API.md, USAGE-GUIDE.md
4. **Original CLAUDE.md**: Reference only for architectural intent validation

---

## 3. Core Constitutional Principles

### 3.1 Business Domain Invariants (Immutable)

These rules MUST NEVER change without explicit business decision and constitutional amendment.

#### Invariant 1: Atomic Batch Integrity

**What must always be true**: Every batch of files is either fully processed (files extracted, chunked, embedded, and persisted) or not processed at all. No partial batches may exist in persisted state.

**Why it exists**: Ensures data consistency and enables reliable resume capability. Prevents corrupted search results from partial embeddings.

**What would break if violated**:
- Resume logic would be ambiguous (which files were processed?)
- Search results would contain incomplete or incorrect matches
- Users would lose trust in data accuracy

**Testable**: Query database after interruption - all files in a batch have status "completed" or none do.

#### Invariant 2: Progress Immutability

**What must always be true**: Once a batch is marked complete, it MUST NOT be reprocessed in the same task version. Progress is monotonically increasing.

**Why it exists**: Prevents wasted computation, duplicate embeddings, and ensures deterministic resume behavior.

**What would break if violated**:
- Duplicate embeddings in search results
- Unpredictable costs (same files embedded multiple times)
- Progress reporting becomes meaningless

**Testable**: Resume a task - verify no file is processed twice within the same task version.

#### Invariant 3: Version Isolation

**What must always be true**: Data from different task versions MUST be completely isolated. Search on version N returns only results from version N, never from N-1 or N+1.

**Why it exists**: Enables safe re-extraction after codebase changes and A/B comparison of different extraction strategies.

**What would break if violated**:
- Search results would mix old and new code
- Version comparison becomes impossible
- Users cannot trust search accuracy after re-extraction

**Testable**: Create v2 of a task, search v1 - results contain only v1 data.

#### Invariant 4: Local Data Sovereignty

**What must always be true**: All code content, chunks, and embeddings MUST be stored locally (MongoDB on localhost). No external service beyond the embedding API may receive code content.

**Why it exists**: Protects proprietary source code from leakage, enables offline operation (except embedding generation), and maintains user privacy.

**What would break if violated**:
- Legal/compliance issues with code confidentiality
- Cannot operate in air-gapped or restricted networks
- Users lose control over their data

**Testable**: Network analysis during processing - only OpenAI API calls detected, no other external requests.

#### Invariant 5: Identifier Uniqueness Per Version

**What must always be true**: Within the same system, an identifier + version combination MUST be globally unique. Same identifier with different version numbers refers to different task instances.

**Why it exists**: Enables AI agents to use memorable names while supporting multiple extractions of the same codebase over time.

**What would break if violated**:
- AI agents cannot reliably reference tasks
- Version disambiguation becomes ambiguous
- Search results return incorrect data

**Testable**: Create task "my-app" v1 and v2 - each has distinct taskId and isolated data.

---

### 3.2 Domain Model Integrity

These entities define the canonical domain model. All implementations MUST preserve these semantics.

#### Entity: Task

**Business Definition**: A single extraction job for a repository at a point in time, identified by a user-friendly name and version number.

**Core Attributes** (business terms):
- Identifier: User-friendly name (e.g., "my-app")
- Version: Sequential number starting from 1
- Repository Location: Path to source code directory
- Lifecycle State: pending → processing → completed/failed
- Configuration: Batch size, chunk size, overlap, embedding model
- Progress Tracking: Files processed, current batch, total batches

**Lifecycle Rules**:
- Creation: pending state, version = max(existing versions for identifier) + 1
- Processing Start: pending → processing
- Processing Success: processing → completed (TERMINAL)
- Processing Failure: processing → failed (TERMINAL)
- Resume: May only resume from pending state
- Re-extraction: Create new version (v+1), never modify existing task

**Forbidden State Transitions**:
- completed → processing (immutable once complete)
- failed → processing (must create new version)
- Direct pending → completed (must pass through processing)

#### Entity: File

**Business Definition**: A source code file that was scanned and extracted from the repository.

**Core Attributes**:
- File Path: Absolute and relative paths
- Language: Detected from file extension
- Content Hash: SHA-256 for change detection
- Batch Assignment: Which batch number processed this file
- Ownership: Linked to parent task (cascade delete)

**Lifecycle Rules**:
- Created during batch processing
- Immutable once persisted
- Deleted only when parent task is deleted

#### Entity: Chunk

**Business Definition**: A segment of file content suitable for embedding, representing a logical code unit (function, class, paragraph).

**Core Attributes**:
- Content: The actual text
- Line Range: Start and end line numbers (1-indexed, inclusive)
- Token Count: Number of tokens for embedding API
- Source Ownership: Linked to parent file and task

**Lifecycle Rules**:
- Created during file processing
- Immutable once persisted
- Chunk boundaries MUST preserve logical code structure when possible
- Deleted only when parent file/task is deleted

#### Entity: Embedding

**Business Definition**: Vector representation of a chunk enabling semantic similarity search.

**Core Attributes**:
- Vector: 1536-dimensional float array (model-dependent)
- Model Name: Which embedding model generated it
- Source Ownership: Linked to parent chunk and task

**Lifecycle Rules**:
- Created immediately after chunk generation
- One embedding per chunk (1:1 relationship)
- Immutable once persisted
- Deleted only when parent chunk/task is deleted

---

### 3.3 System Responsibilities & Boundaries

The system is organized into these bounded contexts with clear ownership:

#### Context: Task Management

**Owns**:
- Task creation with identifier validation
- Version sequencing for identifiers
- Task lifecycle state management
- Task configuration validation
- Version cleanup (retain last 3 per identifier)

**Does NOT Own**:
- File system operations (delegated to File Scanner)
- Embedding generation (delegated to Embedding Service)
- Database operations (delegated to Repository layer)

**Communicates With**:
- File Scanner: Requests repository scanning for total file count
- Batch Processor: Initiates processing with task configuration
- Search Service: Provides task metadata for scoped searches

#### Context: Batch Processing

**Owns**:
- File batching logic (dividing files into configurable batches)
- Atomic batch transactions (all-or-nothing persistence)
- Progress tracking and state updates
- File limit enforcement (budget control)
- Stop signal handling

**Does NOT Own**:
- File content reading (delegated to File Scanner)
- Chunking algorithm (delegated to Chunking Service)
- Embedding generation (delegated to Embedding Service)

**Communicates With**:
- Task Management: Reports progress, requests configuration
- File Scanner: Requests file content
- Chunking Service: Sends content for chunking
- Embedding Service: Sends chunks for embedding
- Repository: Persists batch results atomically

#### Context: Semantic Search

**Owns**:
- Query embedding generation
- Vector similarity computation
- Result ranking and limiting
- Task version scoping

**Does NOT Own**:
- Vector storage (delegated to Repository)
- Embedding model selection (comes from Task configuration)

**Communicates With**:
- Task Management: Resolves identifier to taskId
- Embedding Service: Generates query embedding
- Repository: Retrieves candidate vectors, performs similarity search

#### Context: MCP Server Interface

**Owns**:
- HTTP request/response handling
- Input validation and sanitization
- Error formatting (JSON:API)
- Localhost-only binding

**Does NOT Own**:
- Business logic (delegated to services)
- Data persistence (delegated to Repository)

**Communicates With**:
- All service contexts via well-defined interfaces

---

### 3.4 Program Logic & Workflow Invariants

These workflows define the mandatory behavioral sequences.

#### Workflow 1: Task Creation

**Conceptual Flow**:
1. Accept repository path and optional identifier
2. Validate identifier format (if provided) or generate UUID
3. Check for existing tasks with same identifier
4. Calculate next version number (max + 1)
5. Scan repository to count total files
6. Calculate recommended file limit (200k tokens target)
7. Persist task in "pending" state
8. Return task details including identifier, version, total files, recommendation

**Mandatory Steps**: All steps 1-8
**Optional Steps**: None
**Failure Handling**: Validation failure → return 400 error, scanning failure → return 500 error

#### Workflow 2: Batch Processing

**Conceptual Flow**:
1. Load task configuration and progress state
2. Calculate files remaining (total - processed)
3. Apply file limit if specified (min of limit, remaining)
4. Divide remaining files into batches of configured size
5. For each batch:
   a. Set task status to "processing"
   b. Read file contents
   c. Chunk each file content
   d. Generate embeddings for all chunks
   e. Persist files, chunks, embeddings atomically
   f. Update progress counters
   g. Check for stop signal - if present, break loop
6. If all batches complete: status → "completed"
7. If stopped early or file limit reached: status → "pending"
8. If error occurs: status → "failed", save error message

**Mandatory Steps**: All steps
**Optional Steps**: File limit (step 3), stop signal check (step 5g)
**Failure Handling**: Mid-batch failure → rollback current batch, mark task failed

#### Workflow 3: Resume Processing

**Conceptual Flow**:
1. Validate task is in "pending" state (not completed/failed)
2. Load last completed batch number from progress
3. Continue from batch (last + 1)
4. Execute Workflow 2 starting from step 1 with updated progress

**Mandatory Steps**: All steps
**Compensation**: Cannot resume from completed or failed states - must create new version

#### Workflow 4: Semantic Search

**Conceptual Flow**:
1. Accept query text and either taskId or identifier
2. If identifier provided: resolve to latest version taskId
3. Validate task exists and has completed embeddings
4. Generate query embedding using same model as task
5. Perform vector similarity search scoped to taskId
6. Retrieve top N results by similarity score
7. Enrich results with chunk content, file path, line numbers
8. Return ranked results with scores

**Mandatory Steps**: All steps
**Optional Steps**: None
**Failure Handling**: Task not found → 404, task not processed → 400 error with guidance

---

### 3.5 Contracts & Interfaces (Conceptual)

#### Contract: Task Creation API

**Purpose**: Enable users and AI agents to initiate code extraction jobs

**Inputs**:
- repositoryPath (required): Absolute directory path
- identifier (optional): User-friendly name (2-100 chars, alphanumeric + hyphens/underscores)
- config (optional): Overrides for batchSize, chunkSize, chunkOverlap, embeddingModel

**Outputs**:
- taskId: UUID
- identifier: User-provided or generated
- version: Integer version number
- totalFiles: Count of files to be processed
- recommendedFileLimit: Suggested files per session (~200k tokens)
- config: Full effective configuration
- status: "pending"

**Stability Guarantees**:
- Required inputs will never change (backward compatible)
- New optional inputs may be added (backward compatible)
- Output structure may add fields (backward compatible)
- Output fields will never be removed (breaking change requires major version)

**Evolution Rules**: May add optional configuration fields, may add output metadata fields

#### Contract: Process Initiation API

**Purpose**: Start or resume processing for a task

**Inputs**:
- taskId OR identifier (at least one required)
- fileLimit (optional): Maximum files to process this session

**Outputs**:
- taskId: UUID
- identifier: User-friendly name
- status: "processing"
- message: Confirmation with fileLimit if specified

**Stability Guarantees**: Backward compatible - taskId-only calls will continue to work

**Evolution Rules**: May add processing options, may add output status details

#### Contract: Stop Processing API

**Purpose**: Gracefully halt ongoing processing

**Inputs**:
- taskId OR identifier (at least one required)

**Outputs**:
- taskId: UUID
- identifier: User-friendly name
- message: Confirmation of stop request

**Stability Guarantees**: Always completes current batch atomically before stopping

**Evolution Rules**: May add immediate stop option (with data loss warning)

#### Contract: Semantic Search API

**Purpose**: Find code using natural language queries

**Inputs**:
- query (required): Natural language search string
- taskId OR identifier (at least one required)
- limit (optional): Max results (default 10)

**Outputs**:
- results: Array of code chunks ranked by similarity
  - filePath: Relative path
  - content: Code snippet
  - startLine, endLine: Line numbers
  - score: Similarity score (0.0-1.0)

**Stability Guarantees**: Result structure stable, may add metadata fields

**Evolution Rules**: May add filtering options, may add snippet highlighting

---

### 3.6 User Stories & Guarantees

For each major capability, these user stories define acceptance criteria.

#### Capability: Task Initialization

**User Story**: As a developer, I want to create an extraction task for my repository using a memorable name, so I can reference it later without managing UUIDs.

**Success Criteria**:
- Task created within 2 seconds for repositories ≤10,000 files
- Identifier validates and rejects invalid formats with clear error
- System returns total files and recommended file limit immediately
- Same identifier can have multiple versions (v1, v2, v3...)

**Failure Modes Visible to Users**:
- "Repository path does not exist" (404)
- "Identifier contains invalid characters" (400)
- "Repository scanning timed out" (500)

#### Capability: Budget-Controlled Processing

**User Story**: As a developer, I want to process my repository in controlled increments, staying within my daily token budget, and resume later without reprocessing completed files.

**Success Criteria**:
- System honors file limit within ±1 file accuracy
- Recommended limits result in ~200k tokens (±20%)
- Resume picks up from last completed batch
- No files are processed twice within same version

**Failure Modes Visible to Users**:
- "Task already completed - create new version to re-extract" (400)
- "Batch processing failed at batch N - see error details" (500)

#### Capability: Graceful Interruption

**User Story**: As a developer, I want to stop long-running processing without losing progress or corrupting data, so I can free resources or respond to urgent issues.

**Success Criteria**:
- Stop request completes current batch before halting
- All completed batches are preserved (zero data loss)
- Task returns to "pending" state and can be resumed
- Stop on non-processing task returns clear error

**Failure Modes Visible to Users**:
- "Task is not currently processing" (400)

#### Capability: Semantic Code Discovery

**User Story**: As a developer or AI agent, I want to search my codebase using natural language and get relevant code snippets with file locations, without needing to remember UUIDs.

**Success Criteria**:
- Search returns results within 3 seconds for ≤100k chunks
- Results ranked by semantic relevance (top result is most relevant)
- Each result includes file path, content, line numbers, and score
- Search using identifier "my-app" works identically to using UUID

**Failure Modes Visible to Users**:
- "Task not found" (404)
- "Task has no embedded data - processing not complete" (400)
- "No results found for query" (200 with empty results array)

---

## 4. Architectural Principles (Guiding, Not Prescriptive)

These principles guide design decisions but do NOT mandate specific tools or technologies.

### Principle 1: Separation of Business Logic from Infrastructure

**Statement**: Business rules (batch atomicity, versioning, progress tracking) MUST be independent of database, framework, or API technology choices.

**Rationale**: Enables replacement of MongoDB with PostgreSQL, Express with Fastify, or REST with GraphQL without rewriting domain logic.

**Testable**: Core services can be unit tested without database or HTTP server.

### Principle 2: Explicit Orchestration Over Implicit Coupling

**Statement**: Workflows (task creation, batch processing, search) MUST be orchestrated by explicit service layer, not by database triggers, event listeners, or framework magic.

**Rationale**: Makes control flow visible, debuggable, and testable. Avoids "action at a distance" anti-patterns.

**Testable**: Reading a single orchestration function reveals complete workflow.

### Principle 3: Idempotency and Retry Safety

**Statement**: Operations MUST be safe to retry without side effects (task creation, batch persistence, stop requests).

**Rationale**: Network failures, timeouts, and interruptions are inevitable. Idempotent operations prevent duplicate data and enable safe retries.

**Testable**: Retry any operation - system state is correct, not duplicated.

### Principle 4: Observability as First-Class Concern

**Statement**: All workflows MUST emit structured logs at batch boundaries, state transitions, and error conditions.

**Rationale**: Enables debugging, monitoring, and audit trails without modifying code.

**Testable**: Logs contain sufficient information to reconstruct system behavior post-failure.

### Principle 5: Fail-Safe Defaults

**Statement**: System MUST operate safely with zero configuration (localhost binding, INFO logging, safe batch sizes, validated inputs).

**Rationale**: Prevents accidental exposure, resource exhaustion, or security issues from misconfiguration.

**Testable**: Default configuration passes security audit and performance benchmarks.

### Principle 6: Bounded Scope of External Dependencies

**Statement**: External API calls (OpenAI embeddings) MUST be isolated to a single service with retry, timeout, and rate limit handling.

**Rationale**: Limits blast radius of external failures, enables mock testing, and centralizes cost management.

**Testable**: Can run full system with embedding API mocked.

---

## 5. Evolution Rules

### 5.1 Allowed Changes (No Amendment Required)

- Adding new optional API parameters (backward compatible)
- Adding new optional task configuration fields
- Introducing new bounded contexts with explicit boundaries
- Replacing infrastructure (MongoDB → PostgreSQL, Express → Fastify) without semantic changes
- Adding new metadata fields to responses
- Improving performance without changing behavior
- Adding new embedding models to supported list
- Expanding supported file extensions

### 5.2 Restricted Changes (Require Constitutional Amendment)

These changes MUST update this constitution and increment major version:

- Modifying atomic batch semantics (allowing partial batches)
- Changing version isolation rules (allowing cross-version searches)
- Weakening local-only execution (sending code to external services)
- Altering task lifecycle state machine (new states or transitions)
- Breaking API contract guarantees (removing required fields, changing semantics)
- Removing user-facing capabilities (breaking stories)
- Changing identifier uniqueness rules

**Amendment Process**:
1. Propose change with rationale in writing
2. Document impact on existing features and data
3. Define migration plan if breaking changes involved
4. Update constitution with new principle or modified rule
5. Increment version (major for breaking, minor for additive)
6. Update all dependent templates and documentation
7. Require explicit approval before implementation

---

## 6. Anti-Goals (Explicitly Forbidden)

The constitution explicitly forbids:

### Anti-Goal 1: Implementation-Driven Design

**Forbidden**: Encoding business rules in database triggers, ORM lifecycle hooks, or framework event listeners.

**Why**: Makes logic invisible, untestable, and tightly coupled to infrastructure.

**Alternative**: Explicit service orchestration with visible control flow.

### Anti-Goal 2: Leaking Infrastructure Concerns into Domain

**Forbidden**: Domain entities (Task, File, Chunk, Embedding) MUST NOT contain MongoDB ObjectIds, Express request objects, or OpenAI API client instances.

**Why**: Domain model should be technology-agnostic for v2 reconstruction.

**Alternative**: Adapter/port pattern isolating domain from infrastructure.

### Anti-Goal 3: Shared Persistence Coupling

**Forbidden**: Features MUST NOT couple through shared database collections without explicit bounded context ownership.

**Why**: Creates hidden dependencies and prevents independent evolution.

**Alternative**: Context owns its collections; cross-context communication via services.

### Anti-Goal 4: Business Rules in UI or API Layer

**Forbidden**: Validation logic, batch atomicity, and version sequencing MUST NOT be implemented in route handlers or controllers.

**Why**: Business logic becomes duplicated, inconsistent, and untestable.

**Alternative**: Thin controllers delegating to service layer.

### Anti-Goal 5: Silent Failures

**Forbidden**: Errors MUST NOT be swallowed or logged without propagating to caller.

**Why**: Hides problems, makes debugging impossible, and violates user trust.

**Alternative**: Explicit error handling with clear messages and remediation guidance.

### Anti-Goal 6: Magic Configuration

**Forbidden**: System behavior MUST NOT change based on undocumented environment variables or auto-detected system state.

**Why**: Makes system unpredictable and violates fail-safe defaults principle.

**Alternative**: Explicit configuration with documented defaults and validation.

---

## 7. Relationship to `/specify`

This constitution acts as the **supreme governing document** for all feature specifications.

### Rules for Specifications

**Mandatory Requirements**:
- Every `/specify` prompt MUST reference this constitution explicitly
- All new features MUST demonstrate compliance with business domain invariants
- User stories MUST align with guarantees defined in section 3.6
- API changes MUST respect contract stability guarantees (section 3.5)
- New entities MUST define lifecycle rules consistent with section 3.2

**Conflict Resolution**:
- If specification contradicts constitution, constitution takes precedence
- Specification author must either revise spec or propose constitutional amendment
- No feature may be implemented that violates constitutional principles

**Consistency Enforcement**:
- Constitution Check section in plan-template.md validates compliance
- Spec-template.md user stories reference constitutional guarantees
- Tasks-template.md phases align with workflow invariants (section 3.4)

---

## 8. Governance & Compliance

### Amendment Procedure

1. **Propose** change with clear rationale (business need, technical limitation, etc.)
2. **Assess** impact on existing features, data model, and contracts
3. **Document** migration plan if backward incompatible
4. **Update** constitution with new/modified principle
5. **Increment** version using semantic versioning:
   - **MAJOR**: Backward incompatible changes to principles, contracts, or domain model
   - **MINOR**: New principles, sections, or materially expanded guidance
   - **PATCH**: Clarifications, wording improvements, typo fixes
6. **Propagate** changes to dependent templates (plan, spec, tasks)
7. **Review** compliance across existing specs
8. **Obtain** approval before implementation

### Versioning Policy

- **Current Version**: 2.0.0
- **Ratification Date**: 2026-02-07 (original adoption)
- **Last Amendment Date**: 2026-02-07 (this date updates on any change)
- **Version Increment**: Based on semantic versioning rules above

### Compliance Review

- All PRs MUST verify compliance with constitutional principles
- Pull request description MUST cite which principles govern the change
- Complexity additions MUST be justified against simplicity principle
- Principle violations require explicit exception documentation and rationale
- Quarterly review of constitution vs. implementation drift

### Complexity Justification Framework

When adding complexity (new dependency, pattern, abstraction):

1. **State the Principle**: Which constitutional principle does this serve?
2. **Prove Necessity**: Why is simpler alternative insufficient?
3. **Document Trade-off**: What complexity cost vs. what principle benefit?
4. **Establish Bounds**: When would we remove this if principle changes?

---

## 9. Success Criteria for This Constitution

This constitution is successful if:

✅ A new team can build v2 of Code Reader without seeing v1 source code, using only:
   - This constitution
   - Feature specifications (specs/*.md)
   - Data model documentation

✅ Multiple teams can work on different features independently without:
   - Semantic drift in domain model
   - Breaking each other's assumptions
   - Violating shared principles

✅ Future specifications become:
   - Simpler (principles eliminate decision paralysis)
   - Smaller (reference constitution instead of repeating rules)
   - Safer (violations caught at spec review, not implementation)

✅ The system can evolve technologically without breaking business intent:
   - MongoDB → PostgreSQL: Domain model unchanged
   - Express → Fastify: Workflows unchanged
   - OpenAI → Custom model: Contracts unchanged

✅ All participants (developers, AI agents, reviewers) have shared understanding:
   - What MUST never change (invariants)
   - What CAN change (evolution rules)
   - What is FORBIDDEN (anti-goals)

---

## 10. Appendix: Constitution Derivation Map

This appendix traces each constitutional principle to its authoritative source for v2 reconstruction auditability.

| Principle | Source Document | Section |
|-----------|----------------|---------|
| Atomic Batch Integrity | 001-mcp-code-reader/spec.md | FR-011, User Story 2 |
| Progress Immutability | 001-mcp-code-reader/spec.md | FR-021, FR-023 |
| Version Isolation | 001-mcp-code-reader/spec.md | FR-029, User Story 4 |
| Local Data Sovereignty | 001-mcp-code-reader/spec.md | FR-031, User Story 2 |
| Identifier Uniqueness | 002-ai-agent-enhancements/spec.md | FR-004, User Story 1 |
| Task Entity Model | data-model.md | Collection: tasks |
| File Entity Model | data-model.md | Collection: files |
| Chunk Entity Model | data-model.md | Collection: chunks |
| Embedding Entity Model | data-model.md | Collection: embeddings |
| Task Creation Workflow | 001-mcp-code-reader/spec.md | User Story 1 acceptance scenarios |
| Batch Processing Workflow | 001-mcp-code-reader/spec.md | User Story 2 acceptance scenarios |
| Resume Workflow | 001-mcp-code-reader/spec.md | FR-022, FR-024 |
| Semantic Search Workflow | 001-mcp-code-reader/spec.md | User Story 4 acceptance scenarios |

---

**End of Constitution v2.0**

*This constitution is a living document. All changes require explicit amendment following the governance process defined in Section 8.*
