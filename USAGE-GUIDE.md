# Code Reader MCP - Usage Guide

## Key Features (Updated)

### 🆔 User-Friendly Identifiers

Instead of UUIDs, use memorable identifiers for your repositories:

```bash
# Create task with identifier
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/path/to/my-app",
    "identifier": "my-app"
  }'

# Search using identifier (perfect for AI agents!)
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication function",
    "identifier": "my-app"
  }'

# Filter results by similarity score (only show relevant results)
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication function",
    "identifier": "my-app",
    "minScore": 0.8
  }'
```

**Benefits for AI Agents:**
- AI can infer identifiers from context (repo name, project name)
- No need to remember or store UUIDs
- Natural language workflow: "search my-app for auth code"

**Search Quality Control:**
- Default `minScore`: 0.7 (filters out irrelevant results)
- Higher scores (0.8-0.9): Only very relevant results
- Lower scores (0.5-0.6): More permissive, broader results
- Score range: 0-1 (cosine similarity)

---

### 📊 Smart Token Budget Management

**Automatic File Count & Recommendations:**

When you create a task, the system now:
1. Scans the repository immediately
2. Counts total files
3. Calculates recommended file limit based on ~200k token target

```bash
# Create task - get file count and recommendation
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/path/to/repo",
    "identifier": "my-project"
  }'

# Response includes:
{
  "data": {
    "attributes": {
      "progress": {
        "totalFiles": 450  # Total files found
      },
      "recommendedFileLimit": 133  # Process ~133 files per batch for 200k tokens
    }
  }
}
```

**Process with File Limit:**

Control exactly how many files to process before stopping:

```bash
# Process only 133 files (recommended limit)
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-project",
    "fileLimit": 133
  }'

# Later, resume with another 133 files
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-project",
    "fileLimit": 133
  }'
```

**Why This Matters:**
- **Budget Control**: Process exactly what you can afford each day
- **Incremental Processing**: Break large repos into manageable chunks
- **Resume Anytime**: Continue where you left off without reprocessing

---

### 🛑 Graceful Stop Processing

Stop processing at any time without losing progress:

```bash
# Stop after current batch completes
curl -X POST http://localhost:3100/process/stop \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-project"
  }'

# Response:
{
  "data": {
    "attributes": {
      "status": "stopped",
      "message": "Processing will stop after current batch completes"
    }
  }
}
```

**How It Works:**
- Current batch completes atomically (no partial data)
- Task status returns to `pending`
- All progress is saved
- Resume with `/process` endpoint

---

### 🎯 Search Result Filtering (Quality Control)

Only get relevant results by setting a minimum similarity score threshold:

```bash
# Default behavior (minScore: 0.7) - filters out irrelevant results
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "query": "user authentication"
  }'

# Strict filtering (minScore: 0.85) - only highly relevant results
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "query": "JWT token validation",
    "minScore": 0.85
  }'

# Broader search (minScore: 0.5) - more permissive
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "query": "error handling",
    "minScore": 0.5
  }'
```

**Score Guidelines:**

| minScore | Result Quality | Use When |
|----------|---------------|----------|
| 0.9+ | Extremely precise matches only | You know exact code exists |
| 0.8-0.89 | Highly relevant results | Specific, well-defined queries |
| 0.7-0.79 | **Good balance (default)** | Most queries, general search |
| 0.6-0.69 | Permissive, broader results | Exploratory search |
| 0.5-0.59 | Very broad, may include tangential code | When you're not sure what you're looking for |
| <0.5 | Too broad, mostly noise | Not recommended |

**Example:**

```bash
# Query: "authentication middleware"
# With minScore: 0.7 (default)
# Results: 3 results, all directly related to auth middleware

# Query: "authentication middleware"
# Without filtering (minScore: 0.0)
# Results: 10 results, including config files, tests, unrelated middleware

# Query: "authentication middleware"
# With strict filtering (minScore: 0.85)
# Results: 1 result, the exact auth middleware function
```

**Why This Matters:**
- **Quality over Quantity**: Better to get 2 relevant results than 10 mixed results
- **Token Efficiency**: AI agents process fewer irrelevant results
- **User Experience**: Faster review of search results
- **Cost Savings**: Fewer irrelevant results mean less AI processing time

---

## Complete Workflow Examples

### Example 1: Large Repository (Budget-Conscious)

```bash
# 1. Create task
RESPONSE=$(curl -s -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/path/to/large-repo",
    "identifier": "large-repo"
  }')

# Extract recommendations
TOTAL_FILES=$(echo $RESPONSE | jq '.data.attributes.progress.totalFiles')
RECOMMENDED=$(echo $RESPONSE | jq '.data.attributes.recommendedFileLimit')

echo "Found $TOTAL_FILES files"
echo "Recommended limit: $RECOMMENDED files per session (~200k tokens)"

# 2. Process first batch with recommended limit
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d "{
    \"identifier\": \"large-repo\",
    \"fileLimit\": $RECOMMENDED
  }"

# 3. Monitor progress
curl http://localhost:3100/task/by-identifier/large-repo | jq '.data.attributes.progress'

# 4. Next day, process another batch
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d "{
    \"identifier\": \"large-repo\",
    \"fileLimit\": $RECOMMENDED
  }"

# 5. Search when ready
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "large-repo",
    "query": "authentication middleware"
  }' | jq '.'
```

### Example 2: AI Agent Integration

```javascript
// AI agent can naturally work with identifiers
async function searchCodebase(projectName, searchQuery) {
  const response = await fetch('http://localhost:3100/search_code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: projectName,  // AI can infer: "my-app", "auth-service", etc.
      query: searchQuery,
      limit: 5
    })
  });

  return await response.json();
}

// Natural usage in AI prompt:
// "Search my-app for authentication handlers"
const results = await searchCodebase('my-app', 'authentication handlers');
```

### Example 3: Interrupted Processing with Resume

```bash
# Start processing
curl -X POST http://localhost:3100/process \
  -d '{"identifier": "my-app", "fileLimit": 100}'

# After processing 50 files, stop it
curl -X POST http://localhost:3100/process/stop \
  -d '{"identifier": "my-app"}'

# Check progress
curl http://localhost:3100/task/by-identifier/my-app \
  | jq '.data.attributes.progress.processedFiles'
# Output: 50

# Resume later (processes next 100 files)
curl -X POST http://localhost:3100/process \
  -d '{"identifier": "my-app", "fileLimit": 100}'
```

---

## API Reference Quick Links

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/task` | POST | Create task (requires identifier) |
| `/task/:taskId` | GET | Get task by UUID (backward compat) |
| `/task/by-identifier/:identifier` | GET | **Get task by identifier** |
| `/process` | POST | Start/resume with optional fileLimit |
| `/process/stop` | POST | **Stop processing gracefully** |
| `/search_code` | POST | Search by identifier or taskId |
| `/openapi.yaml` | GET | OpenAPI specification |

### New Request Parameters

**POST /task:**
- `identifier` (required): User-friendly name (e.g., "my-app", "auth-service")
- Returns: `totalFiles`, `recommendedFileLimit`

**POST /process:**
- `identifier` or `taskId`: Which task to process
- `fileLimit` (optional): Max files to process this session

**POST /process/stop:**
- `identifier` or `taskId`: Which task to stop

**POST /search_code:**
- `identifier` or `taskId`: Which task to search (identifier preferred for AI)

---

## Token Budget Planning

### Calculating Your Budget

**Formula:**
```
recommendedFileLimit = 200,000 tokens ÷ (chunkSize × 1.5)
```

**Default:**
- Chunk size: 1000 tokens
- Average: 1.5 chunks per file
- **Recommended: 133 files per session**

**Custom Chunk Sizes:**
- 500 tokens → ~266 files
- 1000 tokens → ~133 files (default)
- 1500 tokens → ~88 files

### Example: 1000-File Repository

```
Total files: 1000
Recommended limit: 133 files/session
Sessions needed: 1000 ÷ 133 = 8 sessions

Day 1: Process 133 files (~200k tokens)
Day 2: Process 133 files (~200k tokens)
...
Day 8: Process remaining 69 files (~104k tokens)
```

---

## Identifier Best Practices

### Good Identifiers ✓

```
"my-app"           # Simple, memorable
"auth-service"     # Descriptive
"frontend-v2"      # Version included
"api_server"       # Underscores OK
"project-2024"     # Numbers OK
```

### Bad Identifiers ✗

```
"my app"           # Spaces not allowed
"service#1"        # Special chars not allowed
"a"                # Too short (min 2 chars)
"abc-123-xyz-..."  # Too long (max 100 chars)
```

### Allowed Characters

- Letters: `a-z`, `A-Z`
- Numbers: `0-9`
- Hyphens: `-`
- Underscores: `_`

---

## Monitoring & Control

### Check Progress

```bash
# By identifier (recommended)
curl http://localhost:3100/task/by-identifier/my-app \
  | jq '.data.attributes.progress'

# By UUID (if you have it)
curl http://localhost:3100/task/abc-123-uuid \
  | jq '.data.attributes.progress'
```

### Stop Processing

```bash
# Graceful stop (completes current batch)
curl -X POST http://localhost:3100/process/stop \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-app"}'

# Task status becomes "pending" - safe to resume later
```

### Resume Processing

```bash
# Resume from where you stopped
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "fileLimit": 133
  }'
```

---

## For AI Agents

### Why Identifiers Are Better

**With UUID (old way):**
```
User: "Search my authentication code"
AI: "I need the taskId. Please provide the UUID."
User: "It's abc-123-def-456..."
```

**With Identifier (new way):**
```
User: "Search my-app for authentication code"
AI: *directly searches using identifier "my-app"*
```

### AI Agent Pattern

```python
def search_codebase(project_name: str, query: str, min_score: float = 0.7):
    """
    AI agents can infer project_name from context:
    - Repository name
    - Project mentioned in conversation
    - Service name

    min_score: Minimum similarity score (0-1)
    - 0.7 (default): Good balance of precision/recall
    - 0.8+: Only highly relevant results
    - 0.5-0.6: Broader, more permissive search
    """
    response = requests.post('http://localhost:3100/search_code', json={
        'identifier': project_name,  # No UUID needed!
        'query': query,
        'limit': 5,
        'minScore': min_score  # Filter irrelevant results
    })
    return response.json()

# Natural usage:
results = search_codebase('my-app', 'error handling middleware')

# For highly specific searches:
exact_results = search_codebase('my-app', 'JWT validation', min_score=0.85)
```

---

## Complete API Reference

For full API documentation including all endpoints, error codes, and examples, see:

- **[API.md](API.md)** - Complete API reference
- **[README.md](README.md)** - Setup and configuration guide
- **[openapi.yaml](openapi.yaml)** - OpenAPI 3.0 specification
- **Runtime**: `http://localhost:3100/openapi.yaml`

---

## Tips & Best Practices

1. **Use Identifiers**: Always use meaningful identifiers for better AI agent compatibility
2. **Respect Recommendations**: Follow the `recommendedFileLimit` to stay within budget
3. **Filter Search Results**: Use `minScore` (default 0.7) to eliminate irrelevant results
   - Getting too many irrelevant results? Increase to 0.8 or 0.9
   - Getting too few results? Decrease to 0.5 or 0.6
   - Rule of thumb: 0.7 is good for most queries
4. **Monitor Progress**: Check progress before resuming to avoid duplicate work
5. **Stop Gracefully**: Use `/process/stop` instead of killing the server
6. **Version Management**: System keeps last 3 versions automatically

**Budget Management:**
```bash
# Always check recommendations first
LIMIT=$(curl -s http://localhost:3100/task/by-identifier/my-app \
  | jq '.data.attributes.recommendedFileLimit')

# Use that limit when processing
curl -X POST http://localhost:3100/process \
  -d "{\"identifier\": \"my-app\", \"fileLimit\": $LIMIT}"
```