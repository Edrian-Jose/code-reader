# Tasks: Reconstruction-Grade Documentation Generator

**Input**: Design documents from `/specs/003-reconstruction-docs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are not explicitly requested in the feature specification. This task list focuses on implementation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and prepare project structure for documentation generation

- [x] T001 Install markdown processing dependencies (unified, remark-stringify, remark-parse) via npm
- [x] T002 Install template engine dependency (handlebars) and types via npm
- [x] T003 [P] Install AST utilities (unist-util-visit) via npm
- [x] T004 Create Handlebars templates directory structure at src/templates/documentation/
- [x] T005 [P] Create documentation artifact template in src/templates/documentation/domain-artifact.hbs
- [x] T006 [P] Add MongoDB initialization script for documentation collections in scripts/db-init-docs.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create DocumentationPlan model in src/models/documentation-plan.ts
- [x] T008 [P] Create DocumentationTask model in src/models/documentation-task.ts
- [x] T009 [P] Create DocumentationArtifact model in src/models/documentation-artifact.ts
- [x] T010 [P] Create ExternalSourceConfig model in src/models/external-source-config.ts
- [x] T011 Create documentation collections accessor in src/db/documentation-collections.ts
- [x] T012 Implement database initialization for documentation collections in scripts/db-init-docs.ts
- [x] T013 Add Zod validation schemas for documentation entities in src/server/middleware/validation.ts
- [x] T014 [P] Create markdown formatter utility in src/utils/markdown-formatter.ts (using remark ecosystem)
- [x] T015 [P] Create dependency graph utility in src/utils/dependency-graph.ts
- [x] T016 Create documentation routes file in src/server/routes/documentation.ts (empty, endpoints added per story)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Initiate Documentation Generation (Priority: P1) 🎯 MVP

**Goal**: Enable users to create documentation plans with task decomposition and priority assignment

**Independent Test**: Create a documentation plan for a test repository, verify plan is persisted with atomic tasks including IDs, descriptions, dependencies, source types, and priority scores

### Implementation for User Story 1

- [x] T017 [P] [US1] Implement TaskPrioritizer service in src/services/task-prioritizer.ts with FoundationalFirst heuristic
- [x] T018 [P] [US1] Implement CLAUDE.md analyzer using code chunk search in src/services/source-synthesizer.ts
- [x] T019 [US1] Implement DocumentationPlanner service in src/services/documentation-planner.ts (depends on T017, T018)
- [x] T020 [US1] Implement task decomposition logic in documentation-planner.ts (analyze architecture, identify domains, create atomic tasks)
- [x] T021 [US1] Implement dependency detection and graph construction in documentation-planner.ts using dependency-graph utility
- [x] T022 [US1] Implement priority score calculation in documentation-planner.ts using task-prioritizer service
- [x] T023 [US1] Implement version sequencing for documentation plans in documentation-planner.ts (max + 1 pattern)
- [x] T024 [US1] Add POST /documentation/plan endpoint in src/server/routes/documentation.ts
- [x] T025 [US1] Add request validation for plan creation endpoint using Zod schemas
- [x] T026 [US1] Add error handling for invalid repository identifiers, malformed CLAUDE.md, planning failures
- [x] T027 [US1] Add logging for plan creation events (INFO level) with plan ID, identifier, task count

**Checkpoint**: At this point, User Story 1 should be fully functional - users can create documentation plans with prioritized tasks

---

## Phase 4: User Story 2 - Execute Documentation Tasks Incrementally (Priority: P1)

**Goal**: Enable incremental task execution with multi-source synthesis, state persistence, and resume capability

**Independent Test**: Execute 5 documentation tasks, verify artifacts are generated and persisted, interrupt execution, resume and verify continuation from correct task without reprocessing

### Implementation for User Story 2

- [x] T028 [P] [US2] Implement SourceSynthesizer service in src/services/source-synthesizer.ts for multi-source information combination
- [x] T029 [P] [US2] Implement ArtifactGenerator service in src/services/artifact-generator.ts using Handlebars templates
- [x] T030 [P] [US2] Implement quality validation scanner in src/services/artifact-generator.ts (section completeness, implementation detail detection)
- [x] T031 [P] [US2] Implement quality scoring logic in src/services/artifact-generator.ts (40% completeness, 30% tech-agnostic, 20% citations, 10% acceptance criteria)
- [x] T032 [US2] Implement DocumentationExecutor service in src/services/documentation-executor.ts (orchestrates T028, T029, T030)
- [x] T033 [US2] Implement task selection logic in documentation-executor.ts (highest priority + dependencies satisfied)
- [x] T034 [US2] Implement CLAUDE.md synthesis in source-synthesizer.ts (query code chunks, parse markdown structure with remark-parse)
- [x] T035 [US2] Implement code chunk synthesis in source-synthesizer.ts (semantic search for business rules, program flows via /search_code)
- [x] T036 [US2] Implement artifact generation in artifact-generator.ts (build markdown AST, render with template, validate quality)
- [x] T037 [US2] Implement state persistence after task completion in documentation-executor.ts (atomic transaction: artifact + task status + plan progress)
- [x] T038 [US2] Implement resume capability in documentation-executor.ts (load state, skip completed, continue from next ready task)
- [x] T039 [US2] Add POST /documentation/execute endpoint in src/server/routes/documentation.ts
- [x] T040 [US2] Add task execution validation (plan must be in executing status, task must be ready)
- [x] T041 [US2] Add error handling for task failures with continuation logic (mark failed, persist error, continue with remaining)
- [x] T042 [US2] Add logging for task lifecycle events (started, completed, failed) with execution time, quality score

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - plans can be created and executed incrementally with resume support

---

## Phase 5: User Story 3 - Review Generated Documentation (Priority: P2)

**Goal**: Enable retrieval and viewing of generated documentation artifacts with structured sections and source citations

**Independent Test**: Generate several documentation artifacts, retrieve them via API, verify structure includes all required sections (business rules, flows, models, stories) with source citations

### Implementation for User Story 3

- [x] T043 [P] [US3] Add GET /documentation/plan/:identifier endpoint in src/server/routes/documentation.ts
- [x] T044 [P] [US3] Add GET /documentation/artifact/:artifactId endpoint in src/server/routes/documentation.ts
- [x] T045 [US3] Implement plan status query logic with task list in documentation-planner.ts (return progress, completed/failed/pending tasks)
- [x] T046 [US3] Implement artifact retrieval logic in documentation-executor.ts (support JSON and markdown content negotiation)
- [x] T047 [US3] Add content negotiation support for artifact endpoint (Accept: application/json vs Accept: text/markdown)
- [x] T048 [US3] Add error handling for artifact not found, plan not found scenarios
- [x] T049 [US3] Add logging for artifact retrieval events with domain name and content type

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently - complete documentation workflow functional

---

## Phase 6: User Story 4 - Configure Documentation Sources (Priority: P3) ⚠️ DEFERRED

**Status**: ⚠️ **DEFERRED** - Implementation not production ready

**Reason**: Confluence integration requires more refinement in:
- CQL query construction and phrase-based searching
- GPT-4 relevance filtering and confidence thresholds
- Tag-based correlation between code items and Confluence pages
- Full page content extraction vs excerpt handling

**POC Available**: Working proof-of-concept exists in `scripts/poc-confluence-enrichment.ts`

**Goal**: Enable optional external source configuration (Confluence) with MCP client authentication delegation

**Independent Test**: Configure Confluence for a documentation plan, execute a task, verify Confluence data is included in generated artifact with proper citations

### Implementation for User Story 4

- [~] T050 [P] [US4] Implement ExternalSourceAdapter service in src/services/external-source-adapter.ts (**COMMENTED OUT**)
- [~] T051 [US4] Implement MCP tool call wrapper for Confluence queries (**COMMENTED OUT**)
- [~] T052 [US4] Implement timeout logic (30-second timeout) (**COMMENTED OUT**)
- [~] T053 [US4] Implement retry logic with exponential backoff (**COMMENTED OUT**)
- [~] T054 [US4] Implement graceful degradation (**COMMENTED OUT**)
- [~] T055 [US4] Integrate Confluence enrichment into SourceSynthesizer (**COMMENTED OUT**)
- [~] T056 [US4] Add POST /documentation/source/configure endpoint (**COMMENTED OUT**)
- [~] T057 [US4] Add validation for external source configuration (**COMMENTED OUT**)
- [~] T058 [US4] Add error handling for invalid configurations (**COMMENTED OUT**)
- [~] T059 [US4] Add logging for external source integration (**COMMENTED OUT**)

**Code Location** (commented out):
- `src/index.ts` - Confluence client initialization
- `src/server/routes/documentation.ts` - `/source/configure` endpoint (lines 384-502)
- `src/services/source-synthesizer.ts` - Confluence enrichment logic (lines 306-316)
- `src/mcp/confluence-client.ts` - Direct Confluence API client (exists but not used)
- `src/services/external-source-adapter.ts` - Query/retry logic (exists but not used)

**Checkpoint**: Phase 6 deferred - **Core documentation generation (Phases 1-5) is production-ready and complete**

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T060 [P] Add comprehensive error messages with remediation guidance across all endpoints
- [ ] T061 [P] Add plan-level metrics tracking (average task time, total duration) in documentation-executor.ts
- [ ] T062 [P] Create Handlebars helper functions for common markdown structures (lists, tables, code blocks)
- [ ] T063 Implement artifact quality report generation (failed quality items per artifact) in artifact-generator.ts
- [ ] T064 [P] Add API documentation for all 5 new endpoints in openapi.yaml (if exists) or API.md
- [ ] T065 [P] Update README.md with documentation generation feature overview and quick start example
- [ ] T066 Run database initialization script to create collections and indexes
- [ ] T067 Run build and fix any TypeScript compilation errors
- [ ] T068 Run npm run lint and fix any linting issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories (both P1 stories can run in parallel)
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Should integrate with US1+US2 but is independently testable
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Integrates with US2 (enhances synthesis) but independently testable

### Within Each User Story

- Models before services (T007-T010 before T017-T019)
- Utilities before services that use them (T014-T015 before T019)
- Core services before orchestrators (T017-T018 before T019, T028-T031 before T032)
- Services before routes (T019 before T024, T032 before T039)
- Route implementation before error handling (T024 before T026, T039 before T041)
- Core implementation before integration (US1+US2 before US4 Confluence integration)

### Parallel Opportunities

- All Setup tasks (T001-T006) marked [P] can run in parallel
- All Foundational model tasks (T007-T010) can run in parallel
- Foundational utilities (T014-T015) can run in parallel
- Once Foundational completes:
  - US1 tasks T017-T018 can run in parallel (different files)
  - US2 tasks T028-T031 can run in parallel (different files)
  - If team capacity allows: US1 and US2 can be worked on simultaneously (both P1, independent)
- Polish tasks T060-T062, T064-T065, T067-T068 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch tasks in parallel for US1:
# Task T017: Implement TaskPrioritizer service in src/services/task-prioritizer.ts
# Task T018: Implement CLAUDE.md analyzer in src/services/source-synthesizer.ts

# Then sequentially:
# Task T019: Implement DocumentationPlanner (depends on T017, T018)
# Tasks T020-T023: Planner implementation details (sequential, same file)
# Task T024: Add endpoint (depends on T019-T023)
```

---

## Parallel Example: User Story 2

```bash
# Launch tasks in parallel for US2:
# Task T028: Implement SourceSynthesizer
# Task T029: Implement ArtifactGenerator
# Task T030: Implement quality validation scanner
# Task T031: Implement quality scoring

# Then sequentially:
# Task T032: Implement DocumentationExecutor (orchestrates T028-T031)
# Tasks T033-T038: Executor implementation details
# Task T039: Add endpoint (depends on T032-T038)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (install dependencies)
2. Complete Phase 2: Foundational (CRITICAL - models, collections, utilities)
3. Complete Phase 3: User Story 1 (plan creation)
4. Complete Phase 4: User Story 2 (task execution)
5. **STOP and VALIDATE**: Test US1+US2 independently - create plan, execute tasks, verify artifacts
6. Deploy/demo if ready (functional documentation generator without external sources)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (can create plans)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP! Can generate documentation)
4. Add User Story 3 → Test independently → Deploy/Demo (can retrieve artifacts conveniently)
5. Add User Story 4 → Test independently → Deploy/Demo (full feature with Confluence)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (6 + 10 tasks)
2. Once Foundational is done:
   - Developer A: User Story 1 (11 tasks - plan creation)
   - Developer B: User Story 2 (15 tasks - task execution)
   - (US1 and US2 can be developed in parallel, both P1)
3. After US1+US2 complete:
   - Developer C: User Story 3 (7 tasks - artifact retrieval)
   - Developer D: User Story 4 (10 tasks - external sources)
4. Stories complete and integrate independently

---

## Task Summary

**Total Tasks**: 68

**By Phase**:
- Setup: 6 tasks
- Foundational: 10 tasks
- User Story 1 (P1): 11 tasks
- User Story 2 (P1): 15 tasks
- User Story 3 (P2): 7 tasks
- User Story 4 (P3): 10 tasks
- Polish: 9 tasks

**Parallel Opportunities**: 17 tasks marked [P] can run concurrently

**Critical Path** (serial execution):
1. Setup → Foundational → US1 core → US2 core → US3 → US4 → Polish
2. Estimated duration: 10-12 hours (assuming 10-15 min per task average)

**MVP Scope** (US1 + US2): 42 tasks (Setup + Foundational + US1 + US2)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- External source integration (US4) is optional - system functions without it
- Quality validation (FR-037 to FR-040) is built into US2's artifact generation (T030-T031)
- Observability requirements (FR-041 to FR-045) are integrated into relevant tasks (T027, T042, T049, T059, T061)
