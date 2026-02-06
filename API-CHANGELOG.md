# API Changelog

## Version 2.0.0 (2026-02-07)

### Breaking Changes

**POST /task** - Now requires `identifier` field:
```diff
{
  "repositoryPath": "/path/to/repo",
+ "identifier": "my-app"
}
```

**Migration Guide:**
- Add an `identifier` field when creating tasks
- Use repository name or project name as identifier
- Identifiers must be 2-100 chars, alphanumeric + hyphens/underscores only

### New Features

#### 1. User-Friendly Identifiers

**All endpoints now support identifiers as an alternative to UUIDs:**

```bash
# Create with identifier (required)
POST /task {"repositoryPath": "...", "identifier": "my-app"}

# Query by identifier
GET /task/by-identifier/my-app

# Process by identifier
POST /process {"identifier": "my-app", "fileLimit": 133}

# Search by identifier (AI-agent friendly!)
POST /search_code {"identifier": "my-app", "query": "auth"}

# Stop by identifier
POST /process/stop {"identifier": "my-app"}
```

#### 2. Token Budget Control

**NEW: `fileLimit` parameter in POST /process:**

```bash
# Process only 133 files (~200k tokens)
POST /process {
  "identifier": "my-app",
  "fileLimit": 133
}

# Resume with another 133 files
POST /process {
  "identifier": "my-app",
  "fileLimit": 133
}
```

**NEW: Automatic recommendations in task creation:**

```json
POST /task response:
{
  "data": {
    "attributes": {
      "progress": {
        "totalFiles": 450
      },
      "recommendedFileLimit": 133
    }
  }
}
```

#### 3. Graceful Stop Processing

**NEW ENDPOINT: POST /process/stop**

```bash
# Stop processing after current batch
POST /process/stop {
  "identifier": "my-app"
}

# Response:
{
  "status": "stopped",
  "message": "Processing will stop after current batch completes"
}
```

#### 4. Search Result Filtering

**NEW: `minScore` parameter in POST /search_code:**

```bash
# Default (0.7) - balanced precision/recall
POST /search_code {
  "identifier": "my-app",
  "query": "authentication"
}

# Strict filtering (0.85) - only highly relevant
POST /search_code {
  "identifier": "my-app",
  "query": "JWT validation",
  "minScore": 0.85
}

# Broader search (0.6)
POST /search_code {
  "identifier": "my-app",
  "query": "error handling",
  "minScore": 0.6
}
```

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/task/by-identifier/:identifier` | Get task by friendly identifier (latest version) |
| `POST` | `/process/stop` | Stop processing gracefully after current batch |

### Enhanced Endpoints

| Endpoint | New Parameters | Description |
|----------|---------------|-------------|
| `POST /task` | `identifier` (required) | User-friendly task identifier |
| `POST /task` | Returns `totalFiles` | Immediate file count from scanning |
| `POST /task` | Returns `recommendedFileLimit` | Smart recommendation for ~200k tokens |
| `POST /process` | `identifier` (optional) | Alternative to taskId |
| `POST /process` | `fileLimit` (optional) | Max files to process before stopping |
| `POST /search_code` | `identifier` (optional) | Alternative to taskId |
| `POST /search_code` | `minScore` (optional, default 0.7) | Minimum similarity threshold |

### Enhanced Responses

**All task responses now include:**
- `identifier` field alongside `taskId`
- `recommendedFileLimit` in detailed responses

**Process responses now include:**
- `identifier` field
- `fileLimit` (if specified)
- Enhanced status messages

**Search responses now include:**
- `identifier` field
- `minScore` threshold used
- Only results above minScore threshold

### Default Values

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` (search) | 10 | Max results returned |
| `minScore` (search) | 0.7 | Minimum similarity score |
| `fileLimit` (process) | unlimited | Process all files if not specified |

### Backward Compatibility

**All existing UUID-based calls continue to work:**
- `GET /task/{taskId}` - Still supported
- `POST /process {"taskId": "..."}` - Still supported
- `POST /search_code {"taskId": "..."}` - Still supported

**UUIDs and identifiers can coexist:**
- Systems can use identifiers for new tasks
- Old tasks with only UUIDs continue to work
- No data migration required

### Score Guidelines (minScore parameter)

| Score Range | Result Quality | Recommended Use |
|-------------|---------------|-----------------|
| 0.9-1.0 | Extremely precise | Exact code lookups |
| 0.8-0.89 | Highly relevant | Specific queries |
| **0.7-0.79** | **Balanced (default)** | **General search** |
| 0.6-0.69 | Permissive | Exploratory search |
| 0.5-0.59 | Very broad | Uncertain queries |
| <0.5 | Too noisy | Not recommended |

### Bug Fixes

- Fixed config schema default handling for nested objects
- Fixed validation middleware type assertions for params/query
- Fixed test cleanup using deprecated `rmdirSync` → `rmSync`
- Fixed OpenAI.APIError instanceof checks for ESM compatibility
- Improved Atlas Local detection with better version checking

### Performance Improvements

- Task creation now includes upfront scanning (adds ~1-3s but provides immediate feedback)
- Database index added on identifier field for fast lookups
- Search filtering reduces result processing overhead
- Enhanced Atlas detection provides clearer guidance

---

## Version 1.0.0 (Initial Release)

See [specs/001-mcp-code-reader/spec.md](specs/001-mcp-code-reader/spec.md) for original feature set.
