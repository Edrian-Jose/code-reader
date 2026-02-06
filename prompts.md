# Speckit Prompts for Code Reader MCP System

---

## 1. Prompt for `/constitution`

```
You are designing a local MCP (Model Context Protocol) system called "Code Reader" that extracts, embeds, and serves codebase content for AI-assisted development workflows.

### System Purpose
Build a local-first system that:
- Extracts code from a target repository in manageable batches
- Generates embeddings using OpenAI's API
- Tracks all progress in MongoDB for resume capability
- Exposes an MCP server API for Speckit to query code and request processing

### Core Rules

#### R1: Batch Processing
- All code extraction MUST happen in configurable batches (default: 50 files per batch)
- Each batch is an atomic unit - either fully processed or not at all
- Batches are numbered sequentially starting from 1
- A batch includes: file discovery, content extraction, chunking, and embedding

#### R2: Resume Capability
- The system MUST be resumable at any point
- Progress state is persisted in MongoDB after each batch completes
- On restart, the system reads the last completed batch and continues from there
- Partial batches are discarded and reprocessed

#### R3: Local-Only Execution
- All processing runs locally except OpenAI API calls for embeddings
- No external services beyond OpenAI embeddings API
- MongoDB runs locally (localhost:27017)
- MCP server binds to localhost only

#### R4: Task Versioning
- Each extraction run creates a new "task" with a unique ID
- Tasks are versioned (v1, v2, etc.) for the same repository
- Outputs (embeddings, chunks) are linked to their task version
- Old versions are retained for comparison/rollback

#### R5: Incremental User Stories
All features are implemented as small, testable increments:
1. Setup MongoDB connection
2. Scan directory for files
3. Extract file content
4. Chunk content
5. Generate embeddings
6. Store in MongoDB
7. Expose via MCP endpoints

### MCP Server Responsibilities
- Accept new extraction tasks via `/task` endpoint
- Process tasks in background via `/process` endpoint
- Report task status via `/task/{id}` endpoint
- Search embedded code via `/search_code` endpoint
- All responses follow JSON:API format

### Constraints
- Maximum file size: 1MB (skip larger files)
- Supported extensions: .js, .ts, .py, .go, .rs, .java, .cpp, .c, .h, .md, .json, .yaml, .yml
- Chunk size: 500-1500 tokens (configurable)
- Embedding model: text-embedding-3-small (configurable)
```

---

## 2. Prompt for `/specify`

```
Generate detailed specifications for the Code Reader MCP system. Each component must have clear inputs, outputs, and MongoDB schemas.

### Component 1: Setup Scripts

**install.sh**
- Input: None
- Output: Installed dependencies, initialized MongoDB
- Actions:
  1. Check Node.js >= 18
  2. Install npm dependencies (express, mongodb, openai, glob, tiktoken)
  3. Verify MongoDB is running on localhost:27017
  4. Create database "code_reader" with collections: tasks, files, chunks, embeddings
  5. Create indexes for performance

**config.json**
```json
{
  "mongodb": {
    "uri": "mongodb://localhost:27017",
    "database": "code_reader"
  },
  "openai": {
    "apiKey": "${OPENAI_API_KEY}",
    "embeddingModel": "text-embedding-3-small"
  },
  "extraction": {
    "batchSize": 50,
    "maxFileSize": 1048576,
    "chunkSize": 1000,
    "chunkOverlap": 100,
    "extensions": [".js", ".ts", ".py", ".go", ".rs", ".java", ".cpp", ".c", ".h", ".md"]
  },
  "server": {
    "port": 3100,
    "host": "localhost"
  }
}
```

### Component 2: Code Extraction and Chunking

**File Scanner**
- Input: `{ targetPath: string, extensions: string[] }`
- Output: `{ files: [{ path: string, relativePath: string, size: number }] }`
- Logic:
  1. Recursively scan targetPath
  2. Filter by extensions
  3. Exclude node_modules, .git, dist, build directories
  4. Skip files exceeding maxFileSize

**Content Extractor**
- Input: `{ filePath: string }`
- Output: `{ content: string, lines: number, language: string }`
- Logic:
  1. Read file as UTF-8
  2. Detect language from extension
  3. Count lines
  4. Return raw content

**Chunker**
- Input: `{ content: string, filePath: string, chunkSize: number, overlap: number }`
- Output: `{ chunks: [{ text: string, startLine: number, endLine: number, tokenCount: number }] }`
- Logic:
  1. Split content by logical boundaries (functions, classes, or line groups)
  2. Ensure chunks are within token limits
  3. Add overlap between consecutive chunks
  4. Preserve context (include file path in chunk metadata)

### Component 3: Embeddings Generation

**Embedder**
- Input: `{ chunks: [{ text: string, id: string }] }`
- Output: `{ embeddings: [{ chunkId: string, vector: number[], model: string }] }`
- Logic:
  1. Batch chunks into groups of 20 (OpenAI limit)
  2. Call OpenAI embeddings API
  3. Handle rate limits with exponential backoff
  4. Return vectors with chunk IDs

### Component 4: MongoDB Schemas

**tasks collection**
```json
{
  "_id": "ObjectId",
  "taskId": "string (uuid)",
  "version": "number",
  "repositoryPath": "string",
  "status": "enum: pending | processing | completed | failed",
  "progress": {
    "totalFiles": "number",
    "processedFiles": "number",
    "currentBatch": "number",
    "totalBatches": "number"
  },
  "config": {
    "batchSize": "number",
    "chunkSize": "number",
    "embeddingModel": "string"
  },
  "createdAt": "Date",
  "updatedAt": "Date",
  "completedAt": "Date | null",
  "error": "string | null"
}
```

**files collection**
```json
{
  "_id": "ObjectId",
  "taskId": "string",
  "filePath": "string",
  "relativePath": "string",
  "language": "string",
  "size": "number",
  "lines": "number",
  "hash": "string (sha256)",
  "batchNumber": "number",
  "processedAt": "Date"
}
```

**chunks collection**
```json
{
  "_id": "ObjectId",
  "chunkId": "string (uuid)",
  "taskId": "string",
  "fileId": "ObjectId",
  "filePath": "string",
  "content": "string",
  "startLine": "number",
  "endLine": "number",
  "tokenCount": "number",
  "createdAt": "Date"
}
```

**embeddings collection**
```json
{
  "_id": "ObjectId",
  "chunkId": "string",
  "taskId": "string",
  "vector": "[number] (1536 dimensions)",
  "model": "string",
  "createdAt": "Date"
}
```
- Create vector index: `{ "vector": "cosmosSearch" }` or use MongoDB Atlas Search

### Component 5: MCP Server Endpoints

**POST /task**
- Purpose: Create a new extraction task
- Input:
```json
{
  "repositoryPath": "/path/to/repo",
  "config": {
    "batchSize": 50,
    "chunkSize": 1000
  }
}
```
- Output:
```json
{
  "taskId": "uuid",
  "version": 1,
  "status": "pending"
}
```

**POST /process**
- Purpose: Start/resume processing a task
- Input: `{ "taskId": "uuid" }`
- Output: `{ "status": "processing", "message": "Processing started" }`
- Behavior: Runs in background, updates MongoDB progress

**GET /task/{id}**
- Purpose: Get task status and progress
- Output:
```json
{
  "taskId": "uuid",
  "status": "processing",
  "progress": {
    "totalFiles": 500,
    "processedFiles": 150,
    "currentBatch": 3,
    "totalBatches": 10,
    "percentComplete": 30
  }
}
```

**POST /search_code**
- Purpose: Semantic search over embedded code
- Input:
```json
{
  "query": "function that handles authentication",
  "taskId": "uuid",
  "limit": 10
}
```
- Output:
```json
{
  "results": [
    {
      "filePath": "src/auth/handler.ts",
      "content": "...",
      "startLine": 45,
      "endLine": 89,
      "score": 0.92
    }
  ]
}
```
```

---

## 3. Prompt for `/plan`

```
Generate a step-by-step implementation plan for the Code Reader MCP system. Each step should be a discrete, testable unit that can be implemented independently.

### Phase 1: Foundation (Steps 1-3)

**Step 1: Project Setup**
- Create project structure:
  ```
  code-reader/
  ├── src/
  │   ├── config/
  │   ├── db/
  │   ├── extractor/
  │   ├── embedder/
  │   ├── server/
  │   └── index.ts
  ├── scripts/
  │   └── install.sh
  ├── config.json
  └── package.json
  ```
- Initialize npm project
- Install core dependencies
- Create config loader
- **Test**: Config loads correctly, dependencies installed

**Step 2: MongoDB Connection**
- Create database client module
- Implement connection with retry logic
- Create collections with schemas
- Create indexes
- **Test**: Connect to MongoDB, create and read a test document

**Step 3: Task Management**
- Implement task creation (generates UUID, sets version)
- Implement task status updates
- Implement task retrieval
- **Test**: Create task, update status, retrieve task

### Phase 2: Extraction Pipeline (Steps 4-6)

**Step 4: File Scanner**
- Implement recursive directory scanning
- Filter by extensions and size
- Exclude common non-code directories
- Return file list with metadata
- **Test**: Scan a test directory, verify correct files returned

**Step 5: Content Extractor**
- Read file contents
- Detect language from extension
- Calculate file hash for change detection
- Handle encoding issues gracefully
- **Test**: Extract content from various file types

**Step 6: Chunking Logic**
- Implement token counter using tiktoken
- Split content into logical chunks
- Add overlap between chunks
- Preserve metadata (file path, line numbers)
- **Test**: Chunk a large file, verify token counts and overlaps

### Phase 3: Embeddings (Steps 7-8)

**Step 7: OpenAI Integration**
- Create OpenAI client wrapper
- Implement batch embedding calls
- Add rate limit handling with backoff
- Handle API errors gracefully
- **Test**: Generate embeddings for test chunks

**Step 8: Embedding Storage**
- Store embeddings in MongoDB
- Link embeddings to chunks and tasks
- Implement vector search (if using Atlas) or prepare for local similarity
- **Test**: Store and retrieve embeddings

### Phase 4: Batch Processing (Steps 9-10)

**Step 9: Batch Orchestrator**
- Divide files into batches
- Process each batch atomically
- Update progress after each batch
- Implement resume from last batch
- **Test**: Process 3 batches, interrupt, resume correctly

**Step 10: Progress Tracking**
- Track files processed per batch
- Calculate completion percentage
- Store timing information
- Handle partial batch recovery
- **Test**: Verify progress updates accurately

### Phase 5: MCP Server (Steps 11-14)

**Step 11: Express Server Setup**
- Create Express application
- Add JSON body parsing
- Add error handling middleware
- Bind to localhost only
- **Test**: Server starts and responds to health check

**Step 12: POST /task Endpoint**
- Validate input
- Create new task in MongoDB
- Return task ID and status
- **Test**: Create task via API

**Step 13: POST /process and GET /task/{id} Endpoints**
- Implement background processing trigger
- Return current progress
- Handle "task not found" errors
- **Test**: Start processing, poll for progress

**Step 14: POST /search_code Endpoint**
- Accept query and taskId
- Generate query embedding
- Perform vector similarity search
- Return ranked results with code snippets
- **Test**: Search for known code, verify relevant results

### Phase 6: Integration (Step 15)

**Step 15: End-to-End Testing**
- Create a test repository with known content
- Run full extraction pipeline
- Verify all documents in MongoDB
- Test search functionality
- Document any edge cases
- **Test**: Full workflow from task creation to code search

### Long-Running Task Handling

For tasks that take extended time:
1. `/process` returns immediately with "processing" status
2. Background worker processes batches sequentially
3. Client polls `/task/{id}` for progress updates
4. Worker updates MongoDB after each batch
5. If process crashes, restart reads last completed batch
6. Consider adding webhook callback for completion notification (future enhancement)

### Implementation Order Summary
1. Setup + Config (foundation)
2. MongoDB connection (data layer)
3. Task CRUD (state management)
4. File scanning (input)
5. Content extraction (processing)
6. Chunking (transformation)
7. OpenAI integration (external API)
8. Embedding storage (persistence)
9. Batch orchestration (coordination)
10. Progress tracking (observability)
11. Server setup (API foundation)
12-14. Endpoints (API surface)
15. Integration testing (validation)

Each step builds on the previous, with clear test criteria for validation.
```

---

## Usage Notes

These prompts are designed for Speckit's workflow:
1. Run `/constitution` first to establish system rules
2. Run `/specify` to generate detailed component specs
3. Run `/plan` to create the implementation roadmap
4. Speckit can then generate code for each step incrementally

The system is designed to be:
- **Modular**: Each component is independent
- **Resumable**: State persists in MongoDB
- **Local-first**: Only OpenAI calls leave the machine
- **Incremental**: Build and test one piece at a time
