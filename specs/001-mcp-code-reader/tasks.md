# Tasks: Code Reader MCP System

**Input**: Design documents from `/specs/001-mcp-code-reader/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Tests included as part of implementation steps (unit tests in each phase).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root (per plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic TypeScript/Node.js structure

- [x] T001 Initialize npm project with package.json (name: code-reader, type: module)
- [x] T002 Create tsconfig.json with ES2022 target, strict mode, ESM output
- [x] T003 [P] Create jest.config.js with ts-jest preset for TypeScript testing
- [x] T004 [P] Create .gitignore for node_modules, dist, logs, .env
- [x] T005 [P] Create .env.example with OPENAI_API_KEY, MONGODB_URI, CODE_READER_PORT placeholders
- [x] T006 Install production dependencies: express, mongodb, openai, glob, tiktoken, uuid, zod, winston, dotenv
- [x] T007 Install dev dependencies: typescript, @types/express, @types/node, jest, ts-jest, @types/jest, tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Configuration

- [x] T008 Create config schema with Zod validation in src/config/schema.ts
- [x] T009 Create config loader (JSON file + env overrides) in src/config/index.ts
- [x] T010 Create default config.json at repository root with MongoDB, OpenAI, extraction, server settings

### Database Infrastructure

- [x] T011 Create MongoDB client with connection pooling and retry logic in src/db/client.ts
- [x] T012 Define collection type exports (tasks, files, chunks, embeddings) in src/db/collections.ts
- [x] T013 Create index initialization function in src/db/indexes.ts

### Logging Infrastructure

- [x] T014 Create Winston logger with console + rotating file transports in src/utils/logger.ts

### Shared Utilities

- [x] T015 [P] Create error types and JSON:API error formatter in src/utils/errors.ts
- [x] T016 [P] Create UUID generator wrapper in src/utils/uuid.ts
- [x] T017 [P] Create SHA-256 hash utility in src/utils/hash.ts

### Express Server Foundation

- [x] T018 Create Express app with JSON body parsing in src/server/app.ts
- [x] T019 [P] Create error handling middleware in src/server/middleware/error.ts
- [x] T020 [P] Create request validation middleware using Zod in src/server/middleware/validation.ts
- [x] T021 Create health check route (GET /health) in src/server/routes/health.ts
- [x] T022 Create main entry point with graceful shutdown in src/index.ts

### Foundation Tests

- [x] T023 [P] Create unit test for config loader in tests/unit/config.test.ts
- [x] T024 [P] Create integration test for MongoDB connection in tests/integration/db.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Create Extraction Task (Priority: P1) MVP

**Goal**: Allow developers to create extraction tasks for repositories, returning task identifiers for tracking

**Independent Test**: Create a task for a sample repository, verify task is stored with pending status and correct configuration

**Dependencies**: Foundational phase complete

### Models for User Story 1

- [x] T025 [P] [US1] Create Task interface and type definitions in src/models/task.ts
- [x] T026 [P] [US1] Create TaskConfig interface with defaults in src/models/task.ts

### Services for User Story 1

- [x] T027 [US1] Implement TaskService with create, getById, updateStatus methods in src/services/task.ts
- [x] T028 [US1] Implement version increment logic for same repository path in src/services/task.ts
- [x] T029 [US1] Implement old version cleanup (retain last 3) in src/services/task.ts
- [x] T030 [US1] Implement path validation (check directory exists) in src/services/task.ts

### Routes for User Story 1

- [x] T031 [US1] Create POST /task endpoint with request validation in src/server/routes/task.ts
- [x] T032 [US1] Implement JSON:API response format for task creation in src/server/routes/task.ts
- [x] T033 [US1] Register task routes in Express app in src/server/app.ts

### Tests for User Story 1

- [x] T034 [P] [US1] Create unit tests for TaskService in tests/unit/task.test.ts
- [x] T035 [US1] Create integration test for POST /task endpoint in tests/integration/api-task.test.ts

**Checkpoint**: User Story 1 complete - can create tasks and receive task IDs

---

## Phase 4: User Story 2 - Process Repository Files (Priority: P1)

**Goal**: Scan repository, extract content, chunk files, generate embeddings, store in MongoDB with resume capability

**Independent Test**: Trigger processing on a 10-20 file test repository, verify all files chunked and embedded

**Dependencies**: User Story 1 (needs task to exist before processing)

### Models for User Story 2

- [x] T036 [P] [US2] Create ProcessedFile interface in src/models/file.ts
- [x] T037 [P] [US2] Create Chunk interface with line tracking in src/models/chunk.ts
- [x] T038 [P] [US2] Create Embedding interface with vector array in src/models/embedding.ts

### File Scanner Service

- [x] T039 [US2] Create file scanner with glob patterns in src/services/scanner.ts
- [x] T040 [US2] Implement extension filtering (.js, .ts, .py, .go, .rs, .java, .cpp, .c, .h, .md, .json, .yaml, .yml) in src/services/scanner.ts
- [x] T041 [US2] Implement directory exclusion (node_modules, .git, dist, build) in src/services/scanner.ts
- [x] T042 [US2] Implement 1MB file size limit with logging in src/services/scanner.ts
- [x] T043 [US2] Implement symlink handling with circular reference detection in src/services/scanner.ts

### Content Extractor Service

- [x] T044 [US2] Create content extractor with UTF-8 reading in src/services/extractor.ts
- [x] T045 [US2] Implement language detection from extension mapping in src/services/extractor.ts
- [x] T046 [US2] Implement binary file detection (null byte check) in src/services/extractor.ts
- [x] T047 [US2] Integrate SHA-256 hash computation in src/services/extractor.ts

### Chunking Service

- [x] T048 [US2] Create tiktoken tokenizer wrapper (cl100k_base) in src/services/chunker.ts
- [x] T049 [US2] Implement line-based chunking with token limits (500-1500) in src/services/chunker.ts
- [x] T050 [US2] Implement boundary detection patterns (function/class) in src/services/chunker.ts
- [x] T051 [US2] Implement configurable overlap between chunks in src/services/chunker.ts
- [x] T052 [US2] Track start/end line numbers for each chunk in src/services/chunker.ts

### Embedding Service

- [x] T053 [US2] Create OpenAI client wrapper in src/services/embedder.ts
- [x] T054 [US2] Implement batch embedding (max 20 per request) in src/services/embedder.ts
- [x] T055 [US2] Implement exponential backoff for rate limiting in src/services/embedder.ts
- [x] T056 [US2] Implement retry logic (3 attempts) for failed requests in src/services/embedder.ts

### Batch Processor Service

- [x] T057 [US2] Create batch processor orchestrator in src/services/processor.ts
- [x] T058 [US2] Implement batch division logic (configurable batch size) in src/services/processor.ts
- [x] T059 [US2] Implement atomic batch processing (scan -> extract -> chunk -> embed -> persist) in src/services/processor.ts
- [x] T060 [US2] Implement batch rollback on failure in src/services/processor.ts
- [x] T061 [US2] Implement progress persistence after each batch in src/services/processor.ts
- [x] T062 [US2] Implement resume from last completed batch in src/services/processor.ts

### Task Queue

- [x] T063 [US2] Implement sequential task queue in src/services/queue.ts
- [x] T064 [US2] Implement background processing with setImmediate yield in src/services/processor.ts

### Routes for User Story 2

- [x] T065 [US2] Create POST /process endpoint in src/server/routes/process.ts
- [x] T066 [US2] Implement task status validation (must be pending) in src/server/routes/process.ts
- [x] T067 [US2] Register process routes in Express app in src/server/app.ts

### Tests for User Story 2

- [x] T068 [P] [US2] Create unit tests for scanner in tests/unit/scanner.test.ts
- [x] T069 [P] [US2] Create unit tests for chunker in tests/unit/chunker.test.ts
- [x] T070 [P] [US2] Create unit tests for embedder (mocked) in tests/unit/embedder.test.ts
- [x] T071 [US2] Create integration test for processor in tests/integration/processor.test.ts
- [x] T072 [US2] Create test fixtures directory with sample files in tests/fixtures/sample-repo/

**Checkpoint**: User Story 2 complete - can process repositories and generate embeddings

---

## Phase 5: User Story 3 - Monitor Task Progress (Priority: P2)

**Goal**: Allow developers to query task status and see detailed progress information

**Independent Test**: Query status during active processing, verify accurate counts returned

**Dependencies**: User Story 1 (needs task to exist)

### Services for User Story 3

- [ ] T073 [US3] Implement progress calculation (percentage, files, batches) in src/services/task.ts
- [ ] T074 [US3] Add completedAt and error fields to task retrieval in src/services/task.ts

### Routes for User Story 3

- [ ] T075 [US3] Create GET /task/{id} endpoint in src/server/routes/task.ts
- [ ] T076 [US3] Implement detailed progress response (JSON:API format) in src/server/routes/task.ts
- [ ] T077 [US3] Implement 404 response for non-existent tasks in src/server/routes/task.ts

### Tests for User Story 3

- [ ] T078 [US3] Create integration test for GET /task/{id} endpoint in tests/integration/api-task.test.ts

**Checkpoint**: User Story 3 complete - can monitor task progress

---

## Phase 6: User Story 4 - Search Embedded Code (Priority: P2)

**Goal**: Allow semantic code search using natural language queries

**Independent Test**: Search processed repository, verify relevant results with file paths and line numbers

**Dependencies**: User Story 2 (needs embeddings to exist)

### Services for User Story 4

- [ ] T079 [US4] Create search service in src/services/search.ts
- [ ] T080 [US4] Implement query embedding generation in src/services/search.ts
- [ ] T081 [US4] Implement MongoDB Atlas vector search aggregation in src/services/search.ts
- [ ] T082 [US4] Implement in-memory cosine similarity fallback in src/services/search.ts
- [ ] T083 [US4] Implement Atlas detection and automatic fallback selection in src/services/search.ts
- [ ] T084 [US4] Implement result ranking and limiting in src/services/search.ts
- [ ] T085 [US4] Implement chunk-to-result mapping (file path, content, lines, score) in src/services/search.ts

### Routes for User Story 4

- [ ] T086 [US4] Create POST /search_code endpoint in src/server/routes/search.ts
- [ ] T087 [US4] Implement request validation (query, taskId, limit) in src/server/routes/search.ts
- [ ] T088 [US4] Implement JSON:API response format for search results in src/server/routes/search.ts
- [ ] T089 [US4] Register search routes in Express app in src/server/app.ts

### Tests for User Story 4

- [ ] T090 [P] [US4] Create unit tests for search service in tests/unit/search.test.ts
- [ ] T091 [US4] Create integration test for POST /search_code endpoint in tests/integration/api-search.test.ts

**Checkpoint**: User Story 4 complete - can search code semantically

---

## Phase 7: User Story 5 - System Installation and Setup (Priority: P3)

**Goal**: Provide easy installation and database initialization for new users

**Independent Test**: Run setup on clean environment, verify all components initialized

**Dependencies**: None (standalone)

### Setup Scripts

- [ ] T092 [US5] Create database initialization script (npm run db:init) in scripts/db-init.ts
- [ ] T093 [US5] Implement collection creation if not exists in scripts/db-init.ts
- [ ] T094 [US5] Implement index creation in scripts/db-init.ts
- [ ] T095 [US5] Create prerequisite check script in scripts/check-prereqs.ts
- [ ] T096 [US5] Implement Node.js version check (>=18) in scripts/check-prereqs.ts
- [ ] T097 [US5] Implement MongoDB connectivity check in scripts/check-prereqs.ts

### Package Scripts

- [ ] T098 [US5] Add npm scripts: start, dev, build, test, test:unit, test:integration, db:init, lint in package.json

### Tests for User Story 5

- [ ] T099 [US5] Create test for prerequisite checker in tests/unit/prereqs.test.ts

**Checkpoint**: User Story 5 complete - users can install and initialize the system

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T100 [P] Add JSDoc comments to all public service methods
- [ ] T101 [P] Create sample repository for testing in tests/fixtures/sample-repo/ with diverse file types
- [ ] T102 Run full end-to-end test: create task -> process -> search
- [ ] T103 Validate quickstart.md instructions work end-to-end
- [ ] T104 [P] Add TypeScript strict mode compliance fixes if any
- [ ] T105 Final code review and cleanup

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - No dependencies on other stories
- **User Story 2 (Phase 4)**: Depends on Foundational + User Story 1 (needs task to process)
- **User Story 3 (Phase 5)**: Depends on Foundational + User Story 1 (needs task to monitor)
- **User Story 4 (Phase 6)**: Depends on User Story 2 (needs embeddings to search)
- **User Story 5 (Phase 7)**: Depends on Foundational only - Can run in parallel with other stories
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

```text
          ┌─────────────────┐
          │  Foundational   │
          │    (Phase 2)    │
          └────────┬────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
       ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│   US1    │ │   US3    │ │   US5    │
│  (P1)    │ │  (P2)    │ │  (P3)    │
│ Task Mgmt│ │ Progress │ │  Setup   │
└────┬─────┘ └──────────┘ └──────────┘
     │
     │ (needs task)
     ▼
┌──────────┐
│   US2    │
│  (P1)    │
│ Process  │
└────┬─────┘
     │
     │ (needs embeddings)
     ▼
┌──────────┐
│   US4    │
│  (P2)    │
│  Search  │
└──────────┘
```

### Within Each User Story

- Models before services
- Services before routes
- Core implementation before tests
- Story complete before moving to dependent stories

### Parallel Opportunities

**Phase 1 Setup**:
- T003, T004, T005 can run in parallel

**Phase 2 Foundational**:
- T015, T016, T017 (utilities) can run in parallel
- T019, T020 (middleware) can run in parallel
- T023, T024 (tests) can run in parallel

**Phase 3 User Story 1**:
- T025, T026 (models) can run in parallel
- T034, T035 (tests) can run in parallel after implementation

**Phase 4 User Story 2**:
- T036, T037, T038 (models) can run in parallel
- T068, T069, T070 (unit tests) can run in parallel

**Phase 6 User Story 4**:
- T090, T091 (tests) can run after implementation

---

## Parallel Example: User Story 2

```bash
# Launch all models in parallel:
Task: T036 "Create ProcessedFile interface in src/models/file.ts"
Task: T037 "Create Chunk interface in src/models/chunk.ts"
Task: T038 "Create Embedding interface in src/models/embedding.ts"

# Then services sequentially (scanner -> extractor -> chunker -> embedder -> processor)

# Launch unit tests in parallel after implementation:
Task: T068 "Unit tests for scanner"
Task: T069 "Unit tests for chunker"
Task: T070 "Unit tests for embedder"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Create Task)
4. **VALIDATE**: Test task creation independently
5. Complete Phase 4: User Story 2 (Process Files)
6. **VALIDATE**: Test full extraction pipeline
7. **MVP READY**: System can extract and embed code

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Can create tasks
3. Add User Story 2 → Test independently → Can process repositories (MVP!)
4. Add User Story 3 → Test independently → Can monitor progress
5. Add User Story 4 → Test independently → Can search code (Full Feature!)
6. Add User Story 5 → Test independently → Easy installation
7. Each story adds value without breaking previous stories

### Suggested MVP Scope

**Minimum Viable Product**: User Stories 1 + 2
- Create extraction tasks
- Process repositories with chunking and embedding
- Resume capability on interruption

**Full Feature**: Add User Stories 3 + 4
- Progress monitoring
- Semantic search

**Complete Package**: Add User Story 5
- Easy installation and setup

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Total tasks: 105
