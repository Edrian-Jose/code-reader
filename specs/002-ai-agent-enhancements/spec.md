# Feature Specification: AI Agent Enhancements for Code Reader MCP

**Feature Branch**: `002-ai-agent-enhancements`
**Created**: 2026-02-07
**Status**: Implemented
**Input**: User description: "AI agent enhancements: user-friendly identifiers, token budget control with fileLimit, graceful stop processing, and smart file recommendations"

## Summary

This specification documents enhancements to the Code Reader MCP system that make it dramatically more AI-agent friendly and provide better token budget control for users. The key improvements include replacing UUIDs with user-friendly identifiers that AI agents can infer from context, adding file limit controls to manage daily token budgets, implementing graceful stop functionality, and providing smart recommendations for optimal processing batch sizes.

These enhancements transform the system from a developer-centric tool requiring UUID management into an AI-native service where agents can naturally interact using memorable identifiers like "my-app" or "auth-service".

## User Scenarios & Testing

### User Story 1 - AI-Friendly Identifiers (Priority: P1)

Developers and AI agents need to reference code repositories using memorable, context-inferrable names instead of UUIDs that must be copied and stored.

**Why this priority**: This is the foundation for AI agent integration. Without memorable identifiers, AI agents cannot naturally interact with the system - they would need users to provide UUIDs for every operation, breaking the natural language workflow.

**Independent Test**: Create a task with identifier "my-app", then search using that identifier without needing to remember or reference any UUID. Demonstrates complete value independently.

**Acceptance Scenarios**:

1. **Given** a user wants to extract code from their application, **When** they create a task with identifier "my-app" and repository path, **Then** the system creates the task and returns the identifier in the response
2. **Given** an AI agent needs to search code, **When** it references "my-app" in the search request, **Then** the system finds the correct task without requiring a UUID
3. **Given** multiple versions exist for an identifier, **When** querying by identifier, **Then** the system returns the latest version automatically
4. **Given** a user provides an identifier with spaces or special characters, **When** creating a task, **Then** the system rejects it with a clear validation error message
5. **Given** a user creates multiple tasks for different repositories, **When** they use distinct identifiers like "frontend" and "backend", **Then** each can be queried independently by identifier

---

### User Story 2 - Token Budget Control (Priority: P1)

Developers need to control their OpenAI API token usage by specifying exactly how many files to process in each session, staying within their daily budget while processing large repositories incrementally.

**Why this priority**: Token costs can accumulate quickly with large repositories. Without budget control, users risk unexpected API bills or hitting rate limits. This feature enables safe, incremental processing with predictable costs.

**Independent Test**: Create a task for a 1000-file repository, receive recommendation of 133 files per session, process exactly 133 files and verify processing stops, then resume with another 133 files. Delivers immediate budget control value.

**Acceptance Scenarios**:

1. **Given** a repository with 1000 files, **When** creating a task, **Then** the system scans and returns total file count (1000) and recommended file limit (~133 for 200k tokens)
2. **Given** a pending task, **When** starting processing with fileLimit of 100, **Then** the system processes exactly 100 files and then stops
3. **Given** a task with 500 total files where 100 have been processed, **When** resuming with fileLimit of 100, **Then** the system processes files 101-200
4. **Given** a task being processed with a file limit, **When** the limit is reached, **Then** the task status returns to pending for later resumption
5. **Given** a user specifies a fileLimit larger than remaining files, **When** processing starts, **Then** the system processes all remaining files and marks task as completed

---

### User Story 3 - Graceful Stop Processing (Priority: P2)

Developers need to stop long-running processing jobs without losing progress or creating partial data, enabling them to free up resources or respond to interruptions.

**Why this priority**: Users may need to stop processing for various reasons (system shutdown, priority changes, noticed errors). Without graceful stop, they would need to kill the process and potentially lose progress or create corrupt data. This is essential for production robustness.

**Independent Test**: Start processing a large repository, send stop request mid-processing, verify current batch completes, progress is saved, and task can be resumed later. Demonstrates value without other stories.

**Acceptance Scenarios**:

1. **Given** a task is currently processing batch 3 of 10, **When** user sends stop request, **Then** batch 3 completes atomically and processing stops without data loss
2. **Given** processing was stopped after batch 3, **When** checking task status, **Then** task shows status pending with currentBatch=3 and can be resumed
3. **Given** a task is not currently processing, **When** user sends stop request, **Then** the system returns a clear error message indicating the task is not running
4. **Given** processing is stopped mid-job, **When** resumed later, **Then** processing continues from the next batch without reprocessing completed files
5. **Given** multiple stop requests are sent in succession, **When** the second request arrives, **Then** system acknowledges without error (idempotent)

---

### User Story 4 - Smart File Recommendations (Priority: P2)

Developers need automatic calculation of optimal file processing limits based on average token usage, eliminating guesswork for budget planning.

**Why this priority**: Manual token calculation is error-prone and time-consuming. Automated recommendations help users make informed decisions about batch sizes without complex math or trial and error.

**Independent Test**: Create tasks with different chunk sizes (500, 1000, 1500 tokens), verify each returns appropriate recommendedFileLimit inversely proportional to chunk size. Provides immediate planning value.

**Acceptance Scenarios**:

1. **Given** a repository with 450 files and chunk size 1000, **When** creating the task, **Then** the system recommends processing ~133 files per session (targeting 200k tokens)
2. **Given** a repository configured with chunk size 500, **When** creating the task, **Then** the system recommends processing ~266 files per session
3. **Given** a small repository with only 50 files, **When** creating the task, **Then** the recommendation equals the total file count (not capped artificially)
4. **Given** recommendations are displayed, **When** user follows the recommendation in processing, **Then** actual token usage approximates 200k tokens within 20% margin

---

### Edge Cases

- **Duplicate identifier with different paths**: System allows same identifier with incremented version (my-app v1, my-app v2)
- **Very long identifier (>100 chars)**: System rejects with validation error listing character limit
- **FileLimit larger than remaining files**: Processes only remaining files and marks task complete
- **Stop requested during first file of batch**: Completes entire batch atomically before stopping
- **Both identifier and taskId provided in search**: System uses taskId (explicit parameter takes precedence)
- **Recommended limit changes between creation and resume**: Uses original recommendation stored at task creation
- **Multiple stop requests for same task**: Second stop returns error "Task not currently processing"
- **Empty repository (0 files)**: Task creation succeeds with totalFiles=0, recommendation=10 (minimum)
- **Identifier case sensitivity**: Identifiers are case-sensitive ("My-App" ≠ "my-app")
- **Processing stopped then resumed with different fileLimit**: New limit applies to the resume session

## Requirements

### Functional Requirements - Identifier Support

- **FR-001**: System MUST accept a user-provided identifier when creating extraction tasks
- **FR-002**: Identifiers MUST be between 2 and 100 characters in length
- **FR-003**: Identifiers MUST contain only alphanumeric characters, hyphens (-), and underscores (_)
- **FR-004**: System MUST enforce unique identifiers per version (same identifier can have multiple versions numbered sequentially)
- **FR-005**: System MUST provide an endpoint to query tasks by identifier
- **FR-006**: When querying by identifier, system MUST return the latest version automatically
- **FR-007**: System MUST maintain backward compatibility with UUID-based task lookup for existing integrations
- **FR-008**: System MUST include identifier in all task responses alongside taskId
- **FR-009**: System MUST validate identifier format and provide clear error messages for invalid formats
- **FR-010**: System MUST create database index on identifier field for efficient lookups

### Functional Requirements - Token Budget Management

- **FR-011**: System MUST scan the repository and count total files during task creation before returning response
- **FR-012**: System MUST calculate and return a recommended file limit based on ~200,000 token target
- **FR-013**: Recommended file limit calculation MUST use formula: 200,000 ÷ (chunkSize × 1.5 average chunks per file)
- **FR-014**: Recommended file limit MUST have a minimum threshold of 10 files regardless of chunk size
- **FR-015**: System MUST include total file count (totalFiles) in task creation response
- **FR-016**: System MUST include recommended file limit (recommendedFileLimit) in task creation response
- **FR-017**: Process endpoint MUST accept an optional fileLimit parameter to cap files processed
- **FR-018**: When fileLimit is specified, system MUST process at most that number of files in the session
- **FR-019**: System MUST track files processed cumulatively across multiple resume sessions
- **FR-020**: System MUST handle fileLimit correctly when resuming partially processed tasks

### Functional Requirements - Stop Processing

- **FR-021**: System MUST provide a dedicated endpoint to request stopping ongoing processing
- **FR-022**: Stop endpoint MUST accept either taskId or identifier to specify which task to stop
- **FR-023**: Stop requests MUST allow current batch to complete atomically before stopping
- **FR-024**: When processing is stopped, system MUST set task status to "pending" for later resumption
- **FR-025**: System MUST persist all progress when processing is stopped (currentBatch, processedFiles)
- **FR-026**: System MUST return an error if stop is requested for a task not currently processing
- **FR-027**: System MUST clear stop request flags when processing completes naturally or fails
- **FR-028**: Stop response MUST include confirmation message and both identifier and taskId

### Functional Requirements - Search by Identifier

- **FR-029**: Search endpoint MUST accept either taskId parameter OR identifier parameter
- **FR-030**: System MUST require at least one of taskId or identifier (not both optional)
- **FR-031**: When identifier is provided, system MUST look up the corresponding task (latest version) automatically
- **FR-032**: Search response MUST include both taskId and identifier regardless of which was used in the request
- **FR-033**: System MUST return 404 error if provided identifier does not exist
- **FR-034**: System MUST validate identifier format in search requests same as task creation

### Functional Requirements - Enhanced API Responses

- **FR-035**: Task creation response MUST return detailed information including totalFiles, recommendedFileLimit, and full config
- **FR-036**: Process response MUST include identifier, taskId, and fileLimit (if specified) in response attributes
- **FR-037**: Process response message MUST indicate when file limit is active (e.g., "Processing started (max 133 files)")
- **FR-038**: Stop response MUST include both identifier and taskId for user confirmation
- **FR-039**: All task query responses MUST include identifier field alongside taskId

### Key Entities

- **Task** (Enhanced):
  - identifier: User-friendly string (2-100 chars, alphanumeric + hyphens/underscores)
  - recommendedFileLimit: Calculated integer based on ~200k token budget
  - Existing fields: taskId, version, repositoryPath, status, progress, config, timestamps

- **ProcessRequest** (Enhanced):
  - identifier: Optional alternative to taskId
  - fileLimit: Optional integer cap on files to process this session
  - Existing fields: taskId

- **StopProcessingRequest** (New):
  - identifier: Optional, identifies task to stop
  - taskId: Optional, UUID of task to stop
  - At least one of identifier or taskId required

- **SearchRequest** (Enhanced):
  - identifier: Optional alternative to taskId for AI agents
  - Existing fields: query, taskId, limit

## Success Criteria

### Measurable Outcomes

- **SC-001**: AI agents can successfully search code using inferred identifiers without user-provided UUIDs in 95% of natural language interactions
- **SC-002**: Recommended file limits result in actual token usage within 20% of the 200,000 token target across diverse repository types
- **SC-003**: Users can process large repositories incrementally with precise control over daily token spend
- **SC-004**: Stop requests result in zero data loss and 100% resumability (all stopped tasks can be resumed successfully)
- **SC-005**: Task creation including repository scanning completes within 5 seconds for repositories up to 10,000 files
- **SC-006**: All existing UUID-based API calls continue to function without modification (100% backward compatibility)
- **SC-007**: New users prefer identifier-based workflows over UUID-based workflows in 80% of API calls
- **SC-008**: File limit enforcement is accurate within ±1 file for all processing sessions
- **SC-009**: Identifier validation errors provide clear, actionable feedback that users can resolve on first attempt
- **SC-010**: System can handle up to 1,000 tasks per identifier (across versions) without query performance degradation

## Scope & Limitations

### In Scope

- User-friendly identifier support for task creation and querying
- Identifier-based search without requiring UUIDs
- File count scanning during task creation with immediate results
- Recommended file limit calculation based on configurable 200k token target
- File limit parameter for processing endpoint to cap files per session
- File limit parameter for resume operations
- Graceful stop endpoint with batch-level granularity
- Stop request handling with atomic batch completion
- Backward compatibility with all existing UUID-based endpoints
- Database indexing on identifier field for query performance
- Version management using identifiers instead of repository paths
- Identifier validation with clear error messages

### Out of Scope

- Modifying identifiers after task creation (identifiers are immutable once set)
- Sub-batch or file-level stop granularity (stops only at batch boundaries)
- Multiple identifier aliases for the same task
- Identifier-based task deletion endpoints (use taskId for administrative operations)
- Per-user or per-identifier custom token budgets (200k is system-wide default)
- Real-time token usage tracking during processing
- Identifier reservation or namespace management
- Automatic identifier suggestion based on repository analysis
- Identifier transfer or migration between tasks

## Constraints & Assumptions

### Constraints

- Identifiers must be unique per version within the entire system
- File scanning during task creation adds processing time (acceptable trade-off for better UX)
- Stop requests have batch-level granularity only (cannot stop mid-batch for data consistency)
- Recommended limits are statistical estimates (actual usage varies by code complexity)
- Identifier validation is format-only (no semantic validation of appropriateness)
- Maximum 3 versions retained per identifier (existing behavior maintained)

### Assumptions

- Average file generates approximately 1.5 chunks (used in recommendation calculation)
- Users prefer ~200,000 tokens per processing session as a safe daily budget
- Batch-level stop granularity is sufficient for 95% of use cases
- Identifiers derived from repository or project names will be sufficiently unique
- AI agents can reliably infer appropriate identifiers from conversation context with 90% accuracy
- Users will follow recommended file limits in majority of cases
- Repository file counts remain relatively stable between task creation and processing

## Dependencies

### Internal Dependencies

- Existing Code Reader MCP system (feature 001-mcp-code-reader)
- FileScanner service for upfront repository scanning
- BatchProcessor for file limit enforcement and stop signal handling
- TaskService for identifier-based lookups and validation
- MongoDB with indexes for efficient identifier queries
- Task queue system for managing stop requests

### External Dependencies

None - all enhancements use existing infrastructure and dependencies

## Non-Functional Requirements

- **Performance**: Task creation with file scanning MUST complete within 5 seconds for repositories up to 10,000 files
- **Performance**: Identifier-based task lookups MUST complete within 100ms for databases with up to 10,000 tasks
- **Reliability**: Stop requests MUST achieve 100% success rate for completing current batch without data corruption
- **Reliability**: File limit enforcement MUST be accurate within ±1 file across all scenarios
- **Usability**: Identifier validation errors MUST provide specific, actionable feedback
- **Usability**: Recommended file limits MUST be displayed prominently in task creation response
- **Compatibility**: All existing UUID-based API calls MUST continue to work unchanged (100% backward compatibility)
- **Scalability**: System MUST handle up to 1,000 tasks per unique identifier (across versions) efficiently
- **Security**: Identifier validation MUST prevent injection attacks or path traversal attempts

## Open Questions

None - all features are fully specified, implemented, and tested.

## Related Features

- **001-mcp-code-reader**: Base system that this feature enhances
- Future: Multi-repository search using identifier prefixes (e.g., "monorepo/service-a")
- Future: Per-identifier token budget customization
- Future: Identifier analytics and usage patterns

## Implementation Notes (For Reference Only)

This section documents what was implemented - included for completeness but not part of the user-facing specification.

**Endpoints Added/Modified**:
- `POST /task`: Now requires `identifier`, returns `totalFiles` and `recommendedFileLimit`
- `GET /task/by-identifier/:identifier`: New endpoint for identifier-based lookup
- `POST /process`: Enhanced with optional `fileLimit` and `identifier` parameters
- `POST /process/stop`: New endpoint for graceful interruption
- `POST /search_code`: Enhanced to accept `identifier` as alternative to `taskId`

**Database Changes**:
- Added `identifier` field to tasks collection
- Added `recommendedFileLimit` field to tasks collection
- Added index on `{identifier: 1, version: -1}` for efficient queries

**Algorithm**:
- Recommended file limit = `Math.max(10, Math.floor(200000 / (chunkSize * 1.5)))`
- Default (chunkSize=1000): 133 files/session
- Custom (chunkSize=500): 266 files/session
- Custom (chunkSize=1500): 88 files/session

**Bug Fixes Included**:
- Fixed Zod schema default value handling
- Fixed validation middleware type assertions
- Fixed test cleanup using deprecated `rmdirSync` → `rmSync`
- Fixed embedder OpenAI.APIError mock for ESM compatibility
