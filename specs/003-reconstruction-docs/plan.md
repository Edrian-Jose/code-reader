# Implementation Plan: Reconstruction-Grade Documentation Generator

**Branch**: `003-reconstruction-docs` | **Date**: 2026-02-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-reconstruction-docs/spec.md`

**Note**: This plan extends the existing Code Reader MCP system with documentation generation capabilities.

## Summary

This feature adds reconstruction-grade documentation generation to the Code Reader MCP system. It enables users to generate comprehensive, technology-agnostic documentation from existing codebases by synthesizing information from CLAUDE.md files, semantic code search, and optional external sources like Confluence. Documentation is generated incrementally through a prioritized task execution model with full resume capability, producing artifacts suitable for system reconstruction (v2) and governance tool input.

The system analyzes repositories to create documentation plans decomposed into atomic tasks, executes tasks one at a time with persistent state management, and produces structured output organized by domains and features. All authentication for external sources is delegated to the MCP client environment.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+ (consistent with existing codebase)

**Primary Dependencies**:
- express (HTTP server - existing)
- mongodb (data persistence - existing)
- @modelcontextprotocol/sdk (MCP protocol - existing)
- zod (validation - existing)
- winston (logging - existing)
- NEEDS CLARIFICATION: Task prioritization library (weighted graph traversal, information gain calculation)
- NEEDS CLARIFICATION: Markdown generation library for structured output formatting
- NEEDS CLARIFICATION: Template engine for documentation artifact generation

**Storage**: MongoDB 6.0+ (localhost, existing infrastructure)
- New collections: documentation_plans, documentation_tasks, documentation_artifacts, external_source_configs

**Testing**: Jest with ts-jest (existing test infrastructure)

**Target Platform**: Node.js server (localhost-only binding, consistent with existing MCP server)

**Project Type**: Single project (extends existing `src/` structure)

**Performance Goals**:
- Task plan generation: <30 seconds for repos with 10k files
- Task execution: <2 minutes average per documentation task
- State persistence: <500ms per task completion
- Resume operation: <5 seconds to load state and continue

**Constraints**:
- Serial task execution only (one task at a time)
- No raw file browsing (must use existing /search_code endpoint)
- No credential storage (authentication delegated to MCP client)
- Documentation output must be technology-agnostic
- Task boundaries must be atomic for interruption safety

**Scale/Scope**:
- Support repositories with 100+ domains/features
- Handle documentation plans with 500+ tasks
- Manage 10+ concurrent documentation task versions per identifier
- Process external source results up to 10MB per Confluence query

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Invariant 1: Atomic Batch Integrity

**Application**: Documentation tasks are analogous to file batches in code extraction. Each documentation task must be atomic - either fully completed with all outputs persisted, or not completed at all.

**Compliance**:
- FR-012: System MUST persist task output and updated state after each task completes
- FR-013: System MUST support interruption at task boundaries without data loss
- Documentation task execution follows same atomic transaction pattern as batch processing

**Verification**: Query database after interruption - task status is either "completed" with artifact reference, or "in_progress"/"failed" with no artifact.

---

### ✅ Invariant 2: Progress Immutability

**Application**: Once a documentation task is marked complete, it MUST NOT be reprocessed in the same documentation plan version.

**Compliance**:
- FR-006: System MUST version documentation tasks similar to code extraction tasks (v1, v2, v3)
- FR-014: System MUST allow resumption from the last completed task
- Task status transitions are unidirectional: pending → in_progress → completed/failed

**Verification**: Resume a documentation plan - verify no completed task is re-executed within the same plan version.

---

### ✅ Invariant 3: Version Isolation

**Application**: Documentation generated for plan version N must be completely isolated from version N-1 or N+1. Each re-documentation creates a new plan version.

**Compliance**:
- FR-006: Documentation tasks are versioned similar to code extraction tasks
- SC-010: Documentation versioning allows comparison between v1 and v2
- Documentation artifacts reference specific plan version, never mixed

**Verification**: Generate documentation v1 and v2 for same repository - artifacts are isolated by version, queryable independently.

---

### ✅ Invariant 4: Local Data Sovereignty

**Application**: All documentation content, task state, and generated artifacts MUST be stored locally. External sources (Confluence) only accessed for enrichment, not storage.

**Compliance**:
- FR-021: System MUST NOT store authentication credentials for external documentation sources
- FR-022: System MUST delegate all external source authentication to the client environment
- All MongoDB collections on localhost, no external data persistence

**Verification**: Network analysis during documentation generation - only OpenAI API (for code search embeddings) and optional Confluence queries detected, no data sent to external storage.

---

### ✅ Invariant 5: Identifier Uniqueness Per Version

**Application**: Documentation plans use same identifier + version pattern as code extraction tasks.

**Compliance**:
- FR-001: System MUST accept a repository identifier to initiate documentation generation
- FR-006: Version documentation tasks similar to code extraction tasks
- Each plan version has unique combination of identifier + version number

**Verification**: Create documentation plan "my-repo" v1 and v2 - each has distinct planId and isolated task sets.

---

### ✅ Domain Model Integrity: New Documentation Entities

**New Entities Introduced**:

1. **Documentation Plan** (similar to extraction Task entity pattern)
   - Lifecycle: pending → executing → completed/failed
   - Version-aware, linked to repository identifier
   - Immutable once completed

2. **Documentation Task** (similar to File entity pattern)
   - Atomic unit of work within a plan
   - Immutable once completed
   - Cascade deleted with parent plan

3. **Documentation Artifact** (similar to Embedding entity pattern)
   - Output of completed task
   - Immutable once created
   - References source task and plan

4. **External Source Configuration**
   - Configuration entity (no credentials)
   - Optional, feature can function without it

**Compliance**: All new entities follow existing lifecycle patterns, forbidden state transitions, and cascade delete rules established in constitution.

---

### ✅ System Responsibilities & Boundaries: New Context

**New Bounded Context**: Documentation Generation

**Owns**:
- Documentation plan creation and task decomposition
- Task prioritization heuristic execution
- Documentation synthesis from multiple sources
- Generated artifact formatting and persistence
- External source integration orchestration (not authentication)

**Does NOT Own**:
- Code semantic understanding (delegated to existing Search Service via /search_code)
- File system access (uses existing code chunk data, not raw files)
- External source authentication (delegated to MCP client)
- CLAUDE.md parsing (uses existing file reading if needed, or code chunks)

**Communicates With**:
- Existing Search Service: Queries code chunks for business logic understanding
- Existing Task Management: Reuses identifier + version pattern
- External Source APIs: Via MCP client-provided credentials (if configured)
- Repository: Persists plans, tasks, artifacts

**Boundary Validation**: No cross-context coupling - documentation generation is isolated, uses only public interfaces of existing contexts.

---

### ✅ Program Logic & Workflow Invariants

**New Workflows Introduced**:

1. **Documentation Plan Creation Workflow** (analogous to Task Creation)
   - Mandatory steps: Validate identifier, analyze sources, decompose into tasks, persist plan
   - Optional steps: External source configuration validation
   - Failure handling: Invalid sources → return 400 error, planning failure → return 500 error

2. **Documentation Task Execution Workflow** (analogous to Batch Processing)
   - Mandatory steps: Load task, synthesize from sources, generate artifact, persist output, update status
   - Optional steps: Confluence enrichment (if configured)
   - Failure handling: Task failure → mark failed with error details, continue with remaining tasks

3. **Resume Documentation Workflow** (analogous to Resume Processing)
   - Mandatory steps: Validate plan in "executing" state, load last completed task, continue from next task
   - Compensation: Cannot resume from "completed" plans - must create new version

**Compliance**: All workflows follow constitutional patterns - explicit orchestration, idempotent operations, failure compensation defined.

---

### ✅ Architectural Principles Compliance

**Principle 1: Separation of Business Logic from Infrastructure**
- ✅ Documentation generation logic independent of Express, MongoDB, MCP protocol
- ✅ Task prioritization heuristic is business logic, not tied to database schema
- ✅ Artifact formatting independent of storage mechanism

**Principle 2: Explicit Orchestration Over Implicit Coupling**
- ✅ Documentation synthesis workflow explicitly orchestrated by service layer
- ✅ No database triggers, no event listeners for task progression
- ✅ Clear control flow: plan creation → task selection → execution → persistence

**Principle 3: Idempotency and Retry Safety**
- ✅ Task execution is idempotent (completed tasks not re-executed)
- ✅ Failed tasks can be retried without side effects (FR-034)
- ✅ Plan creation safe to retry (identifier + version uniqueness)

**Principle 4: Observability as First-Class Concern**
- ✅ Structured logging at task boundaries, state transitions
- ✅ Error details persisted for troubleshooting (FR-033)
- ✅ Progress tracking enables monitoring (FR-030)

**Principle 5: Fail-Safe Defaults**
- ✅ Works without external sources configured (CLAUDE.md + code search only)
- ✅ Localhost-only binding (consistent with existing MCP server)
- ✅ Default prioritization heuristic if none specified

**Principle 6: Bounded Scope of External Dependencies**
- ✅ External source access isolated to single service
- ✅ Authentication failures don't crash system (FR-035)
- ✅ Can mock Confluence for testing

---

### ⚠️ Evolution Rules Check

**Allowed Changes Being Made**:
- ✅ Adding new optional feature (documentation generation) to existing system
- ✅ Introducing new bounded context (Documentation Generation) with explicit boundaries
- ✅ Adding new metadata fields to responses (documentation artifacts)
- ✅ Expanding functionality without changing existing code extraction semantics

**No Restricted Changes**:
- ❌ Not modifying atomic batch semantics (documentation tasks use same pattern)
- ❌ Not changing version isolation rules (documentation follows same versioning)
- ❌ Not weakening local-only execution (external sources only for enrichment, not storage)
- ❌ Not breaking existing API contracts (new endpoints only, existing endpoints unchanged)

**Conclusion**: This feature introduction is an **allowed evolution** under constitutional rules. No amendments required.

---

### Gate Evaluation Result: ✅ PASS

All constitutional invariants are satisfied. No violations detected. Feature design aligns with existing architectural principles and bounded context patterns. Proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/003-reconstruction-docs/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (prioritization heuristic, template engines, external source patterns)
├── data-model.md        # Phase 1 output (DocumentationPlan, DocumentationTask, DocumentationArtifact, ExternalSourceConfig)
├── quickstart.md        # Phase 1 output (end-to-end usage examples)
├── contracts/           # Phase 1 output (OpenAPI specs for new endpoints)
│   ├── create-documentation-plan.yaml
│   ├── execute-documentation-task.yaml
│   ├── get-documentation-status.yaml
│   ├── configure-external-source.yaml
│   └── get-documentation-artifact.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

This feature extends the existing single-project structure:

```text
src/
├── models/
│   ├── task.ts                    # Existing code extraction task model
│   ├── file.ts                    # Existing
│   ├── chunk.ts                   # Existing
│   ├── embedding.ts               # Existing
│   ├── documentation-plan.ts      # NEW: Documentation plan entity
│   ├── documentation-task.ts      # NEW: Documentation task entity
│   ├── documentation-artifact.ts  # NEW: Generated documentation output
│   └── external-source-config.ts  # NEW: External source configuration
│
├── services/
│   ├── task-service.ts            # Existing extraction task management
│   ├── batch-processor.ts         # Existing batch processing
│   ├── search-service.ts          # Existing semantic search
│   ├── documentation-planner.ts   # NEW: Plan creation and task decomposition
│   ├── documentation-executor.ts  # NEW: Task execution and synthesis
│   ├── task-prioritizer.ts        # NEW: Prioritization heuristic implementation
│   ├── source-synthesizer.ts      # NEW: Multi-source information synthesis
│   ├── artifact-generator.ts      # NEW: Documentation artifact formatting
│   └── external-source-adapter.ts # NEW: Confluence/external source integration
│
├── routes/
│   ├── task-routes.ts             # Existing extraction endpoints
│   ├── search-routes.ts           # Existing search endpoints
│   └── documentation-routes.ts    # NEW: Documentation generation endpoints
│
├── db/
│   ├── client.ts                  # Existing MongoDB connection
│   ├── collections.ts             # Existing collection accessors
│   └── documentation-collections.ts # NEW: Documentation-specific collections
│
└── utils/
    ├── logger.ts                  # Existing Winston logger
    ├── validation.ts              # Existing Zod schemas
    ├── markdown-formatter.ts      # NEW: Markdown generation utilities
    └── dependency-graph.ts        # NEW: Task dependency resolution

tests/
├── unit/
│   ├── documentation-planner.test.ts    # NEW: Plan creation unit tests
│   ├── task-prioritizer.test.ts        # NEW: Prioritization heuristic tests
│   ├── source-synthesizer.test.ts      # NEW: Multi-source synthesis tests
│   └── artifact-generator.test.ts      # NEW: Artifact formatting tests
│
└── integration/
    ├── documentation-workflow.test.ts   # NEW: End-to-end documentation generation
    ├── resume-capability.test.ts        # NEW: Resume after interruption tests
    └── external-source-integration.test.ts # NEW: Confluence integration tests (mocked)
```

**Structure Decision**: This feature extends the existing single-project structure with new services, models, and routes for documentation generation. The design maintains clear separation between existing code extraction functionality and new documentation generation capability through distinct service modules. All new code resides in `src/` following the established project layout, with dedicated test coverage in `tests/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. This section is not applicable.

---

## Post-Design Constitution Check Re-Evaluation

*Re-checking constitutional compliance after Phase 1 design completion.*

### Design Artifacts Generated

**Phase 0**:
- ✅ research.md: Resolved 3 NEEDS CLARIFICATION items (task prioritization, markdown generation, template engine)

**Phase 1**:
- ✅ data-model.md: 4 new entities (DocumentationPlan, DocumentationTask, DocumentationArtifact, ExternalSourceConfig)
- ✅ contracts/README.md: 5 new REST endpoints with JSON:API format
- ✅ quickstart.md: End-to-end usage guide with troubleshooting

### Constitutional Compliance Verification

**✅ All Invariants Maintained**:
- Atomic Batch Integrity: Documentation tasks follow same atomic pattern as file batches
- Progress Immutability: Tasks transition unidirectionally (pending → in_progress → completed/failed)
- Version Isolation: Documentation plans versioned identically to extraction tasks
- Local Data Sovereignty: All data persisted locally, external sources for enrichment only
- Identifier Uniqueness: Plans use identifier + version pattern

**✅ Domain Model Integrity**: All new entities follow constitutional lifecycle patterns
**✅ Bounded Context Isolation**: Documentation Generation context properly separated
**✅ Workflow Invariants**: All 3 new workflows defined with mandatory/optional steps
**✅ Architectural Principles**: All 6 principles maintained

### Research Decisions Validation

| Decision | Constitutional Alignment |
|----------|-------------------------|
| Custom prioritization heuristic (no external library) | ✅ Principle 1: Business logic independent of infrastructure |
| Remark ecosystem for markdown generation | ✅ Principle 6: External deps isolated, mockable |
| Handlebars for templating | ✅ Principle 1: Separation of data and presentation |
| MCP Tool Call with client auth delegation | ✅ Invariant 4: Local data sovereignty, FR-022 compliance |
| Code chunk search + remark-parse for CLAUDE.md | ✅ Constraint: No raw file browsing, uses existing /search_code |

### New Dependencies Impact

**Added**: 6 packages (unified, remark-stringify, remark-parse, handlebars, unist-util-visit, @types/*)

**Bundle Size**: ~80KB (acceptable for server-side)

**Security**: No security implications - all dependencies well-maintained, no credential handling

**Backward Compatibility**: Zero impact on existing code extraction functionality

### Final Gate Result: ✅ PASS

Design fully compliant with constitutional principles. No amendments required. Proceed to Phase 2 (/speckit.tasks command) when ready for implementation.

---

## Planning Complete

**Phase 0 Complete**: All unknowns resolved through research
**Phase 1 Complete**: Data model, contracts, and quickstart guide generated
**Agent Context Updated**: CLAUDE.md updated with new dependencies

**Next Step**: Run `/speckit.tasks` to generate implementation task breakdown.

---

**Plan Completed**: 2026-02-07
