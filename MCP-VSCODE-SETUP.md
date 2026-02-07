# Claude Code VSCode Extension - MCP Server Setup

## ✅ Configuration Complete!

**The Code Reader MCP server is now configured and ready to use with Claude Code!**

**Configuration File**: `C:\Users\admin\.claude.json` (lines 200-211)
**Status**: ✅ Configured with dual MongoDB connection (Atlas + fallback)

---

## Configuration File Location

Claude Code stores MCP servers in:
- **Windows**: `C:\Users\admin\.claude.json`
- **macOS/Linux**: `~/.claude.json`

**NOT in VSCode settings.json** - Claude Code uses its own global configuration file.

---

## Next Steps to Start Using

### 1. Reload Claude Code

**Restart this VSCode session** for the MCP server to load:
- Close VSCode completely
- Reopen VSCode
- Claude Code will automatically start the Code Reader server

**OR use the /mcp command:**
- Type `/mcp` in Claude Code
- You should see "code-reader" in the list
- Check if it shows "✔ connected"

### 2. Verify Server Started

Open terminal and check:

```bash
curl http://localhost:3100/health
```

**Expected:**
```json
{"status":"ok","timestamp":"2026-02-07T..."}
```

### 3. Check Server Logs

```bash
# View connection logs
tail -f C:\Users\admin\Repositories\code-reader\logs\combined.log
```

**You should see:**
```
[info]: Code Reader MCP Server starting...
[info]: Attempting connection to Atlas Local (Docker): mongodb://localhost:58746...
[info]: ✓ Connected to MongoDB (Atlas Local): mongodb://localhost:58746...
[info]: Server listening on http://localhost:3100
```

**OR if Atlas is not running:**
```
[info]: Attempting connection to Atlas Local (Docker): mongodb://localhost:58746...
[warn]: ✗ Connection to Atlas Local (Docker) failed: connect ECONNREFUSED
[info]: Trying fallback connection...
[info]: Attempting connection to Local MongoDB: mongodb://localhost:27017
[info]: ✓ Connected to MongoDB (Local MongoDB): mongodb://localhost:27017
```

---

## Index Your First Repository

Before Claude can search, you need to index repositories:

```bash
# Index the Code Reader repository itself
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d "{\"repositoryPath\": \"C:\\\\Users\\\\admin\\\\Repositories\\\\code-reader\", \"identifier\": \"code-reader\"}"

# Response will show totalFiles and recommendedFileLimit
# Example: {"recommendedFileLimit": 133, "progress": {"totalFiles": 45}}

# Start processing with recommended file limit
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d "{\"identifier\": \"code-reader\", \"fileLimit\": 133}"

# Monitor progress (wait for status: "completed")
curl http://localhost:3100/task/by-identifier/code-reader
```

---

## Using Code Reader with Claude

### Check MCP Server Status

Type in Claude Code:
```
/mcp
```

You should see:
```
code-reader · ✔ connected
confluence · ✔ connected
```

### Search Your Code

Once a repository is indexed (status: "completed"), ask me:

- **"Search code-reader for the MongoDB connection logic"**
- **"Find identifier validation in code-reader"**
- **"Look for the search service implementation in code-reader"**
- **"Search code-reader for error handling patterns"**

I'll automatically:
1. Use the `/search_code` endpoint
2. Search by identifier
3. Filter results (minScore: 0.7)
4. Return relevant code with file paths and line numbers

---

## Managing MCPs

### View All MCPs

```
/mcp
```

Shows all configured servers with connection status.

### Edit Configuration

```bash
# Open in editor
code C:\Users\admin\.claude.json

# Or Notepad
notepad C:\Users\admin\.claude.json
```

### Reload After Changes

- Close and reopen VSCode
- OR use VSCode Developer: Reload Window (`Ctrl+Shift+P`)

---

## Configuration Details

### Current Setup

**File**: `C:\Users\admin\.claude.json`

```json
{
  "mcpServers": {
    "code-reader": {
      "command": "node",
      "args": ["C:\\Users\\admin\\Repositories\\code-reader\\dist\\index.js"],
      "env": {
        "OPENAI_API_KEY": "your-key",
        "MONGODB_ATLAS_URI": "mongodb://localhost:58746/?directConnection=true",
        "MONGODB_LOCAL_URI": "mongodb://localhost:27017",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Environment Variables

| Variable | Purpose | Your Value |
|----------|---------|------------|
| `OPENAI_API_KEY` | OpenAI embeddings | Your API key (configured) |
| `MONGODB_ATLAS_URI` | Primary connection | mongodb://localhost:58746 |
| `MONGODB_LOCAL_URI` | Fallback connection | mongodb://localhost:27017 |
| `LOG_LEVEL` | Logging verbosity | info |

---

## Troubleshooting

### Server Not Showing in /mcp

**Check build is up to date:**
```bash
cd C:\Users\admin\Repositories\code-reader
npm run build
```

**Check file exists:**
```bash
dir C:\Users\admin\Repositories\code-reader\dist\index.js
```

**Check .claude.json syntax:**
- No trailing commas
- Valid JSON format
- Use `/mcp` to see error messages

### Server Shows "✗ disconnected"

**Check server logs:**
```bash
tail -f C:\Users\admin\Repositories\code-reader\logs\combined.log
```

**Common issues:**
- MongoDB not running (either Atlas or local)
- Port 3100 already in use
- Missing OPENAI_API_KEY
- Wrong path to dist/index.js

**Test manually:**
```bash
node C:\Users\admin\Repositories\code-reader\dist\index.js
```

### Search Not Working

**Verify repository is indexed:**
```bash
curl http://localhost:3100/task/by-identifier/your-repo-name
```

**Check status is "completed":**
```json
{
  "data": {
    "attributes": {
      "status": "completed"  // Must be completed to search
    }
  }
}
```

**If still processing:**
- Wait for processing to complete
- Check logs for errors
- Ensure OPENAI_API_KEY is valid

---

## Index Multiple Repositories

You can index all your projects:

```bash
# Index each repository
curl -X POST http://localhost:3100/task \
  -d "{\"repositoryPath\": \"C:\\\\Users\\\\admin\\\\Repositories\\\\project1\", \"identifier\": \"project1\"}"

curl -X POST http://localhost:3100/task \
  -d "{\"repositoryPath\": \"C:\\\\Users\\\\admin\\\\Repositories\\\\project2\", \"identifier\": \"project2\"}"

# Process them with file limits
curl -X POST http://localhost:3100/process -d "{\"identifier\": \"project1\", \"fileLimit\": 133}"
curl -X POST http://localhost:3100/process -d "{\"identifier\": \"project2\", \"fileLimit\": 133}"
```

Then ask Claude:
- "Search project1 for authentication code"
- "Find API routes in project2"
- "Look for database models in project1"

---

## Connection Fallback Behavior

Your configuration automatically handles MongoDB failover:

**Scenario 1: Atlas Docker Running**
```
[info]: Attempting connection to Atlas Local (Docker): mongodb://localhost:58746...
[info]: ✓ Connected to MongoDB (Atlas Local)
→ Uses native vector search (fast!)
```

**Scenario 2: Atlas Docker Stopped**
```
[info]: Attempting connection to Atlas Local (Docker): mongodb://localhost:58746...
[warn]: ✗ Connection to Atlas Local (Docker) failed
[info]: Trying fallback connection...
[info]: Attempting connection to Local MongoDB: mongodb://localhost:27017
[info]: ✓ Connected to MongoDB (Local MongoDB)
→ Uses in-memory search (still works!)
```

**Scenario 3: Both MongoDB Unavailable**
```
[error]: Failed to connect to MongoDB. Tried: Atlas Local (Docker), Local MongoDB
→ Server won't start (as expected)
```

---

## Quick Reference

### Files

- **MCP Config**: `C:\Users\admin\.claude.json`
- **Server Entry**: `C:\Users\admin\Repositories\code-reader\dist\index.js`
- **Server Logs**: `C:\Users\admin\Repositories\code-reader\logs\combined.log`
- **Environment**: `C:\Users\admin\Repositories\code-reader\.env` (optional)

### Commands

```bash
# Check MCP status
/mcp

# Build server
npm run build

# Check health
curl http://localhost:3100/health

# View logs
tail -f logs\combined.log

# List tasks
curl http://localhost:3100/task/by-identifier/{identifier}
```

### Example Queries for Claude

- "Search {identifier} for {query}"
- "Find {code type} in {identifier}"
- "Look for {functionality} in {identifier}"
- "Search {identifier} for {pattern}"

---

## What's Next?

1. ✅ Configuration added to `.claude.json`
2. ⏳ Restart VSCode to load the MCP server
3. ⏳ Index your repositories
4. ⏳ Ask Claude to search your code!

**After restart, type `/mcp` to verify "code-reader" appears in the list with "✔ connected"**

Then you're ready to search your code with Claude! 🚀
