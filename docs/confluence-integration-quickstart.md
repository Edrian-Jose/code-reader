# Confluence Integration Quick Start

**Quick setup guide for running Code Reader with integrated Confluence MCP client**

---

## What This Does

Your Code Reader server now includes a **built-in Confluence API client** that queries Confluence directly. No external dependencies or subprocesses needed - everything runs in a single process.

**Benefits**:
- ✅ Single process to start (just `npm start`)
- ✅ Direct Confluence REST API calls (no external MCP server)
- ✅ Automatic Confluence integration when credentials are provided
- ✅ Graceful degradation if Confluence not configured
- ✅ Zero additional dependencies beyond existing Node.js fetch API

---

## Quick Setup (5 Minutes)

### Step 1: Build the Project

```bash
npm install
npm run build
```

No additional dependencies needed - Confluence integration uses Node.js built-in `fetch` API.

### Step 2: Get Confluence Credentials

You need three things:

**A. Confluence Cloud ID**

```bash
# Get your Cloud ID using Atlassian API
curl -u your-email@example.com:your-api-token \
  https://api.atlassian.com/oauth/token/accessible-resources \
  | jq '.[0].id'
```

Example output: `"1324a887-45db-1bf4-1e99-ef0ff456d421"`

**B. Create API Token**

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Label it: `Code Reader MCP`
4. Copy the token (format: `ATATT3xFfGF0...`)

**C. Your Atlassian Instance URL**

Format: `https://your-domain.atlassian.net`

### Step 3: Configure Environment Variables

Create or update `.env` file:

```bash
# Required for GPT-4 documentation generation
OPENAI_API_KEY=sk-...

# MongoDB (existing)
MONGODB_LOCAL_URI=mongodb://localhost:27017

# Confluence Integration (NEW - optional)
ATLASSIAN_INSTANCE_URL=https://your-domain.atlassian.net
ATLASSIAN_USERNAME=your-email@example.com
ATLASSIAN_API_TOKEN=ATATT3xFfGF0_your_token_here
```

**Note**: If you don't set the Confluence variables, the server will still start but Confluence integration will be disabled.

### Step 4: Build and Start Server

```bash
# Build TypeScript
npm run build

# Start server
npm start
```

**You should see**:

```
[info] Code Reader MCP Server starting...
[info] Connected to MongoDB (local)
[info] Initializing Confluence API client...
[info] Confluence API client connected successfully
[info] Confluence integration enabled and ready
[info] Server listening on http://127.0.0.1:3100
```

**If Confluence is NOT configured**, you'll see:

```
[info] Confluence not configured - documentation will use code analysis only
[info] To enable Confluence: Set ATLASSIAN_INSTANCE_URL, ATLASSIAN_USERNAME, ATLASSIAN_API_TOKEN in .env
```

This is **fine** - documentation generation will work using code analysis only.

---

## Testing Confluence Integration

### Test 1: Verify Server Started

```bash
curl http://localhost:3100/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### Test 2: Create Documentation Plan with Confluence

```bash
# 1. Create extraction task (if not already done)
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/path/to/your/repo",
    "identifier": "my-repo"
  }'

# 2. Process repository
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-repo", "fileLimit": 100}'

# Wait for processing to complete...

# 3. Create documentation plan
PLAN_RESPONSE=$(curl -s -X POST http://localhost:3100/documentation/plan \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryIdentifier": "my-repo",
    "identifier": "my-repo-docs"
  }')

echo $PLAN_RESPONSE | jq .

# Extract plan ID
PLAN_ID=$(echo $PLAN_RESPONSE | jq -r '.data.id')
echo "Plan ID: $PLAN_ID"
```

### Test 3: Configure Confluence for the Plan

```bash
# Get your Confluence Cloud ID (you got this in Step 2A)
CLOUD_ID="1324a887-45db-1bf4-1e99-ef0ff456d421"

# Configure Confluence
curl -X POST http://localhost:3100/documentation/source/configure \
  -H "Content-Type: application/json" \
  -d "{
    \"planId\": \"$PLAN_ID\",
    \"sourceType\": \"confluence\",
    \"configuration\": {
      \"cloudId\": \"$CLOUD_ID\"
    }
  }" | jq .
```

**Expected Response**:

```json
{
  "data": {
    "type": "external_source_config",
    "id": "config-uuid",
    "attributes": {
      "configId": "config-uuid",
      "planId": "plan-uuid",
      "sourceType": "confluence",
      "enabled": true,
      "authDelegation": {
        "protocol": "mcp",
        "upstreamServer": "atlassian"
      }
    }
  },
  "meta": {
    "message": "External source configured. Authentication will be handled by MCP client."
  }
}
```

### Test 4: Execute Task (Will Query Confluence)

```bash
# Execute first documentation task
curl -X POST http://localhost:3100/documentation/execute \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-repo-docs"}' | jq .
```

**Check Server Logs** - you should see:

```
[info] Starting LLM-powered documentation synthesis { domain: 'System Architecture', ... }
[info] Enriching documentation with Confluence data { domain: 'System Architecture', planId: '...' }
[info] Querying Confluence via MCP tool call { cloudId: '...', cqlQuery: '...' }
[info] Executing Confluence API call { tool: 'searchConfluenceUsingCql', ... }
[info] Confluence search successful { resultCount: 3, cql: '...' }
[info] Confluence enrichment successful { domain: 'System Architecture', resultCount: 3, queryTime: 1234 }
```

**If Confluence query fails**, you'll see graceful degradation:

```
[warn] Confluence query failed after retries { error: '...', queryTime: '...' }
[warn] Confluence enrichment failed, continuing without it { domain: '...', error: '...' }
```

The task will **still complete** using code analysis only.

### Test 5: Verify Confluence Data in Artifact

```bash
# Get the artifact ID from the execute response
ARTIFACT_ID=$(echo $TASK_RESPONSE | jq -r '.data.attributes.artifactRef')

# Retrieve artifact
curl -X GET "http://localhost:3100/documentation/artifact/$ARTIFACT_ID" \
  -H "Accept: application/json" | jq '.data.attributes.sections.userStories'
```

**You should see user stories** with `"sources": ["confluence"]`:

```json
[
  {
    "title": "User Authentication Requirements",
    "description": "As a user, I want secure login...",
    "acceptanceCriteria": [],
    "sources": ["confluence"]
  }
]
```

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│  Code Reader Server (Node.js)          │
│                                         │
│  ┌───────────────────────────────┐     │
│  │  Express REST API             │     │
│  └───────────────────────────────┘     │
│              │                          │
│              ├──> MongoDB               │
│              ├──> OpenAI (GPT-4)        │
│              │                          │
│              ├──> Confluence MCP Client │◄─┐
│              │    (subprocess)          │  │
│              │                          │  │
└──────────────┼──────────────────────────┘  │
               │                             │
               └─────────────────────────────┘
                     ▲
                     │ JSON-RPC over stdin/stdout
                     │
        ┌────────────┴───────────────┐
        │ @modelcontextprotocol/     │
        │ server-atlassian           │
        │                            │
        │ - Authenticates with       │
        │   Confluence API           │
        │ - Executes CQL queries     │
        │ - Returns page data        │
        └────────────────────────────┘
```

### Startup Sequence

1. **Server starts** → `npm start`
2. **Loads environment variables** from `.env`
3. **Connects to MongoDB**
4. **Checks Confluence config**:
   - If `ATLASSIAN_*` vars set → spawns MCP subprocess
   - If not set → skips MCP, logs info message
5. **Starts Express server** on port 3100

### Request Flow (with Confluence)

1. **Client requests**: `POST /documentation/execute`
2. **Server selects next task**: "User Authentication" domain
3. **Gathers code chunks**: Semantic search finds 42 code chunks
4. **Checks for Confluence config**: Found! cloudId configured
5. **Builds CQL query**: `text ~ "User Authentication" AND type = page`
6. **Sends to MCP subprocess**:
   ```json
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "searchConfluenceUsingCql",
       "arguments": { "cloudId": "...", "cql": "..." }
     }
   }
   ```
7. **MCP server authenticates** using `ATLASSIAN_API_TOKEN`
8. **MCP queries Confluence** REST API
9. **MCP returns results** via JSON-RPC
10. **Server parses pages**: Extracts user stories
11. **GPT-4 analyzes code**: Business rules, flows, models
12. **Merges sources**: Code analysis + Confluence user stories
13. **Generates artifact**: Markdown with all sections
14. **Returns to client**: Task completed with artifact ID

---

## Graceful Degradation

The system **never fails** due to Confluence issues:

| Scenario | Behavior |
|----------|----------|
| Confluence not configured | ✅ Server starts, docs use code only |
| Invalid API token | ⚠️ MCP connection fails, logs warning, continues |
| Confluence query timeout | ⚠️ Retries 2x, then continues without Confluence data |
| Confluence API rate limit | ⚠️ Returns empty results, logs error, continues |
| Network issues | ⚠️ Retries with backoff, then graceful degradation |

**All scenarios** → Documentation task completes successfully

---

## Troubleshooting

### Issue: "Confluence MCP server not configured"

**Logs show**:
```
[info] [MCP] Confluence not configured - skipping MCP client initialization
```

**Fix**: Add these to `.env`:
```bash
ATLASSIAN_INSTANCE_URL=https://your-domain.atlassian.net
ATLASSIAN_USERNAME=your-email@example.com
ATLASSIAN_API_TOKEN=ATATT3xFfGF0...
```

Restart server: `npm start`

### Issue: "MCP server startup timeout"

**Logs show**:
```
[error] [MCP] Failed to start Confluence server { error: 'MCP server startup timeout (10 seconds)' }
```

**Causes**:
- `npx` is slow (first time downloading package)
- Network issues downloading `@modelcontextprotocol/server-atlassian`

**Fix**:
```bash
# Pre-install the MCP server package
npm install -g @modelcontextprotocol/server-atlassian

# Restart Code Reader server
npm start
```

### Issue: "Authentication Failed" in Confluence queries

**Logs show**:
```
[error] MCP tool call failed { tool: 'searchConfluenceUsingCql', error: 'Authentication failed' }
```

**Fix**:

1. **Verify API token is valid**:
   ```bash
   curl -u your-email@example.com:$ATLASSIAN_API_TOKEN \
     https://your-domain.atlassian.net/wiki/rest/api/space
   ```

   Should return list of spaces (not 401 error)

2. **Check token hasn't expired** - regenerate at:
   https://id.atlassian.com/manage-profile/security/api-tokens

3. **Update `.env`** with new token

4. **Restart server**: `npm start`

### Issue: No User Stories in Artifacts

**Scenario**: Confluence query succeeds but artifacts have empty `userStories` array

**Cause**: No Confluence pages match the domain query

**Fix**:

Create Confluence pages with relevant content:

1. **Go to your Confluence workspace**
2. **Create a space** (recommended: use repository name)
3. **Create pages** with domain names in title/content:
   - Example: "User Authentication Requirements"
   - Example: "Task Management Specifications"
4. **Add user stories** to page content
5. **Re-execute documentation task**

### Issue: Server Won't Start

**Error**: `Error: spawn npx ENOENT`

**Cause**: `npx` not found (Node.js/npm not properly installed)

**Fix**:
```bash
# Verify Node.js version
node --version  # Should be >= 18.0.0

# Verify npm/npx
npx --version

# If missing, reinstall Node.js from https://nodejs.org
```

---

## Environment Variables Reference

```bash
# ============================================================================
# REQUIRED
# ============================================================================
OPENAI_API_KEY=sk-...                    # For GPT-4 documentation analysis
MONGODB_LOCAL_URI=mongodb://localhost:27017  # Database connection

# ============================================================================
# OPTIONAL - Confluence Integration
# ============================================================================
ATLASSIAN_INSTANCE_URL=https://your-domain.atlassian.net
ATLASSIAN_USERNAME=your-email@example.com
ATLASSIAN_API_TOKEN=ATATT3xFfGF0...

# If not set: Server starts, Confluence disabled, docs use code only
# If set but invalid: Warning logged, graceful degradation

# ============================================================================
# OPTIONAL - Other Settings
# ============================================================================
CODE_READER_PORT=3100                    # Server port
LOG_LEVEL=info                           # Logging level (debug, info, warn, error)
```

---

## Performance Notes

### With Confluence Enabled

**Per Documentation Task**:
- Code analysis (GPT-4): ~30-60 seconds
- Confluence query: ~5-10 seconds
- **Total**: ~35-70 seconds per domain

**Cost**:
- GPT-4 analysis: ~$0.15-0.30 per domain
- Confluence queries: Free (no AI involved)

### Without Confluence

**Per Documentation Task**:
- Code analysis only: ~30-60 seconds
- **Total**: ~30-60 seconds per domain

**Cost**:
- GPT-4 analysis: ~$0.15-0.30 per domain

**Recommendation**: Enable Confluence if you have existing requirements/user stories in Confluence. Otherwise, code analysis alone produces excellent documentation.

---

## Next Steps

1. **Generate full documentation**:
   ```bash
   # Execute all tasks in plan
   for i in {1..20}; do
     curl -X POST http://localhost:3100/documentation/execute \
       -H "Content-Type: application/json" \
       -d '{"identifier": "my-repo-docs"}'
     sleep 2  # Rate limiting
   done
   ```

2. **Export to files**:
   ```bash
   curl -X POST http://localhost:3100/documentation/export \
     -H "Content-Type: application/json" \
     -d '{"identifier": "my-repo-docs"}'
   ```

3. **Review documentation** in `/path/to/repo/docs/*.md`

4. **Check Confluence integration** - verify user stories are included

---

## Related Documentation

- [Confluence Setup Guide](./confluence-setup-guide.md) - Detailed Confluence configuration
- [API Reference](../API.md) - Complete API documentation
- [Architecture Overview](../README.md) - System architecture

---

**Confluence integration is now running embedded in your Code Reader server!** 🎉
