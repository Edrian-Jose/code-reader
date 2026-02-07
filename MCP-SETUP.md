# Adding Code Reader to Claude Code MCP Servers

This guide explains how to integrate the Code Reader MCP server with Claude Code (Claude Desktop or CLI).

## Overview

The Code Reader MCP server provides semantic code search capabilities to Claude, enabling it to:
- Search your codebase using natural language
- Find relevant code snippets across repositories
- Understand code context without reading entire files
- Access embedded code knowledge via vector search

---

## Quick Setup

### 1. Build the Server

```bash
cd /path/to/code-reader
npm install
npm run build
```

### 2. Configure Claude Code

Add the Code Reader server to your Claude Code MCP configuration:

**For Claude Desktop (`claude_desktop_config.json`):**

**Option A: Dual Connection with Automatic Fallback (Recommended)**

```json
{
  "mcpServers": {
    "code-reader": {
      "command": "node",
      "args": ["/absolute/path/to/code-reader/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key",
        "MONGODB_ATLAS_URI": "mongodb://localhost:58746/?directConnection=true",
        "MONGODB_LOCAL_URI": "mongodb://localhost:27017"
      }
    }
  }
}
```

**How it works:**
- Tries Atlas Local first (better performance with vector search)
- Falls back to standard MongoDB if Atlas is unavailable
- Best of both worlds: performance + reliability

**Option B: Single Connection (Legacy)**

```json
{
  "mcpServers": {
    "code-reader": {
      "command": "node",
      "args": ["/absolute/path/to/code-reader/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key",
        "MONGODB_URI": "mongodb://localhost:27017"
      }
    }
  }
}
```

**For Claude Code CLI (`~/.config/claude-code/mcp_settings.json`):**

Same configuration as above - use Option A for automatic fallback!

### 3. Start Claude Code

The Code Reader server will start automatically when Claude Code launches.

**Verify it's running:**
```bash
# Check if server is responding
curl http://localhost:3100/health

# Expected response:
# {"status":"ok","timestamp":"2026-02-07T..."}
```

---

## Configuration Options

### Environment Variables

Configure these in the `env` section of your MCP configuration:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | **Yes** | - | Your OpenAI API key for embeddings |
| **`MONGODB_ATLAS_URI`** | **No** | - | **Primary: Atlas Local connection (tried first)** |
| **`MONGODB_LOCAL_URI`** | **No** | mongodb://localhost:27017 | **Fallback: Standard MongoDB (if Atlas fails)** |
| `MONGODB_URI` | No | - | Legacy: Single URI (overrides Atlas/Local if set) |
| `OPENAI_BASE_URL` | No | - | Custom OpenAI endpoint (Azure, proxy, etc.) |
| `CODE_READER_PORT` | No | 3100 | Server port |
| `LOG_LEVEL` | No | info | Logging level (error, warn, info, debug) |

**Connection Priority:**
1. If `MONGODB_URI` is set → Use it exclusively (legacy mode)
2. Otherwise, try `MONGODB_ATLAS_URI` first
3. If Atlas fails, fall back to `MONGODB_LOCAL_URI`
4. If neither set, default to `mongodb://localhost:27017`

### Example with Dual Connection (Recommended)

```json
{
  "mcpServers": {
    "code-reader": {
      "command": "node",
      "args": ["/Users/username/code-reader/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-key-here",
        "MONGODB_ATLAS_URI": "mongodb://localhost:58746/?directConnection=true",
        "MONGODB_LOCAL_URI": "mongodb://localhost:27017",
        "CODE_READER_PORT": "3100",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Benefits:**
- ✅ Uses Atlas Local when available (fast vector search)
- ✅ Automatically falls back to standard MongoDB if Atlas Docker is stopped
- ✅ No manual intervention needed
- ✅ Best reliability + performance

---

## Using Code Reader with Claude

### 1. Index Your First Repository

```bash
# Create extraction task
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/path/to/your/project",
    "identifier": "my-project"
  }'

# Note the recommendedFileLimit from response

# Start processing with file limit
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-project",
    "fileLimit": 133
  }'

# Monitor progress
curl http://localhost:3100/task/by-identifier/my-project
```

### 2. Ask Claude to Search Your Code

Once your repository is indexed, you can ask Claude to search it:

**Example prompts:**
- "Search my-project for authentication middleware"
- "Find error handling code in my-project"
- "Look for JWT validation in my-project"
- "Search my-project for database connection logic"

**Behind the scenes, Claude will:**
1. Call `POST /search_code` with your query and identifier
2. Get relevant code chunks with file paths and line numbers
3. Analyze the results and provide context-aware responses

---

## Workflow Integration

### Initial Setup (One-Time)

```bash
# 1. Build the server
cd /path/to/code-reader
npm run build

# 2. Initialize database
npm run db:init

# 3. Check prerequisites
npm run prereqs

# 4. (Optional) Set up Atlas Local for better performance
# See ATLAS-SETUP.md for instructions
```

### Daily Usage

**Morning: Index new code**
```bash
# Process your day's file limit
curl -X POST http://localhost:3100/process \
  -d '{"identifier": "my-project", "fileLimit": 133}'
```

**Throughout the day: Ask Claude questions**
```
User: "Search my-project for authentication logic"
Claude: *searches and analyzes your code*
```

**Anytime: Monitor progress**
```bash
curl http://localhost:3100/task/by-identifier/my-project | jq .
```

---

## Multiple Repositories

You can index multiple repositories with different identifiers:

```bash
# Index frontend
curl -X POST http://localhost:3100/task \
  -d '{"repositoryPath": "/path/to/frontend", "identifier": "frontend"}'

# Index backend
curl -X POST http://localhost:3100/task \
  -d '{"repositoryPath": "/path/to/backend", "identifier": "backend"}'

# Index shared libraries
curl -X POST http://localhost:3100/task \
  -d '{"repositoryPath": "/path/to/lib", "identifier": "shared-lib"}'
```

Then ask Claude:
- "Search frontend for login components"
- "Search backend for API routes"
- "Search shared-lib for utility functions"

---

## Troubleshooting

### MCP Server Won't Start

**Check Claude Code logs:**
```bash
# Claude Desktop
~/Library/Logs/Claude/mcp.log  # macOS
%APPDATA%/Claude/logs/mcp.log  # Windows

# Claude Code CLI
~/.config/claude-code/logs/
```

**Common issues:**
- Wrong path to dist/index.js (must be absolute)
- Missing OPENAI_API_KEY
- MongoDB not running
- Port 3100 already in use

### Server Starts But Claude Can't Search

**Verify server is accessible:**
```bash
curl http://localhost:3100/health
```

**Check if repositories are indexed:**
```bash
curl http://localhost:3100/task/by-identifier/my-project
```

**Ensure task is completed:**
```json
{
  "data": {
    "attributes": {
      "status": "completed"  // Must be completed to search
    }
  }
}
```

### Search Returns No Results

**Check minScore threshold:**
```bash
# Try with lower threshold
curl -X POST http://localhost:3100/search_code \
  -d '{
    "identifier": "my-project",
    "query": "your query",
    "minScore": 0.5
  }'
```

**Verify embeddings exist:**
```bash
mongosh "mongodb://localhost:58746/?directConnection=true" --eval "
  use code_reader;
  db.embeddings.countDocuments({taskId: 'your-task-id'});
"
```

---

## Advanced: Auto-Start with System

### macOS (launchd)

Create `~/Library/LaunchAgents/com.code-reader.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.code-reader</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/code-reader/dist/index.js</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>OPENAI_API_KEY</key>
        <string>your-key</string>
        <key>MONGODB_URI</key>
        <string>mongodb://localhost:58746/?directConnection=true</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/code-reader.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/code-reader.error.log</string>
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.code-reader.plist
```

### Linux (systemd)

Create `/etc/systemd/system/code-reader.service`:

```ini
[Unit]
Description=Code Reader MCP Server
After=network.target mongod.service

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/code-reader
Environment="OPENAI_API_KEY=your-key"
Environment="MONGODB_URI=mongodb://localhost:27017"
ExecStart=/usr/bin/node /path/to/code-reader/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable code-reader
sudo systemctl start code-reader
```

### Windows (Task Scheduler)

Use Task Scheduler to run on startup:
1. Open Task Scheduler
2. Create Basic Task → "Code Reader MCP"
3. Trigger: "When I log on"
4. Action: "Start a program"
5. Program: `C:\Program Files\nodejs\node.exe`
6. Arguments: `C:\path\to\code-reader\dist\index.js`
7. Set environment variables in task properties

---

## API Endpoints Available to Claude

Once configured, Claude can access these endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/task` | POST | Create new extraction task |
| `/task/by-identifier/:id` | GET | Get task status |
| `/process` | POST | Start/resume processing |
| `/process/stop` | POST | Stop processing gracefully |
| `/search_code` | POST | Search embedded code |
| `/health` | GET | Health check |

**Claude typically uses:**
- `POST /search_code` - Main functionality for code search
- `GET /task/by-identifier/:id` - Check indexing status
- `POST /task` - Suggest indexing new repositories

---

## Best Practices

### 1. Index Repositories You Work With

```bash
# Index all your active projects
for repo in frontend backend shared-lib; do
  curl -X POST http://localhost:3100/task \
    -d "{\"repositoryPath\": \"/path/to/$repo\", \"identifier\": \"$repo\"}"
done
```

### 2. Respect Token Budgets

```bash
# Use recommended file limits
curl -X POST http://localhost:3100/process \
  -d '{"identifier": "my-project", "fileLimit": 133}'
```

### 3. Re-index When Code Changes

```bash
# Create new version after major changes
curl -X POST http://localhost:3100/task \
  -d '{"repositoryPath": "/path/to/project", "identifier": "my-project"}'

# Then process it
curl -X POST http://localhost:3100/process \
  -d '{"identifier": "my-project", "fileLimit": 133}'
```

### 4. Use Specific Identifiers

**Good identifiers:**
- `my-app` (for "My Application")
- `auth-service` (for authentication microservice)
- `frontend-v2` (for specific version)
- `api_gateway` (for API gateway)

**These help Claude understand context better!**

---

## Example: Claude Interaction

**You:** "Index my authentication service at /Users/me/projects/auth-service"

**Claude:** *creates task*
```bash
POST /task {
  "repositoryPath": "/Users/me/projects/auth-service",
  "identifier": "auth-service"
}
```

**You:** "Search auth-service for JWT validation"

**Claude:** *searches your code*
```bash
POST /search_code {
  "identifier": "auth-service",
  "query": "JWT token validation",
  "minScore": 0.7
}
```

**Claude:** "I found JWT validation in `src/middleware/auth.ts` at line 45..."

---

## Performance Tips

### 1. Use Atlas Local (Recommended)

For best search performance, set up Atlas Local vector search:

```bash
# See ATLAS-SETUP.md for detailed instructions
atlas deployments setup
# ... create vector search index with taskId filter
```

Update your MCP config:
```json
{
  "env": {
    "MONGODB_URI": "mongodb://localhost:58746/?directConnection=true"
  }
}
```

### 2. Monitor Resource Usage

```bash
# Check server logs
tail -f logs/combined.log

# Monitor memory
ps aux | grep "node.*code-reader"
```

### 3. Optimize for Large Repositories

```bash
# Process incrementally
curl -X POST http://localhost:3100/process \
  -d '{"identifier": "large-repo", "fileLimit": 100}'

# Stop if needed
curl -X POST http://localhost:3100/process/stop \
  -d '{"identifier": "large-repo"}'
```

---

## Security Considerations

### Localhost Only

The Code Reader server **only binds to localhost** for security:
- Not accessible from network
- Safe for local development
- No authentication needed (localhost-only)

### API Key Protection

Your OpenAI API key is only used server-side:
- Never exposed to Claude Code client
- Stored in environment variables
- Never logged or persisted

### Repository Access

The server can only access repositories:
- With explicit paths provided by you
- On your local filesystem
- That you have read permissions for

---

## Updates and Maintenance

### Updating the Server

```bash
cd /path/to/code-reader

# Pull latest changes
git pull

# Rebuild
npm install
npm run build

# Restart Claude Code to reload MCP server
```

### Re-indexing After Updates

```bash
# Create new version
curl -X POST http://localhost:3100/task \
  -d '{"repositoryPath": "/path/to/repo", "identifier": "my-project"}'

# Process it
curl -X POST http://localhost:3100/process \
  -d '{"identifier": "my-project", "fileLimit": 133}'

# Old versions auto-deleted (keeps last 3)
```

---

## Alternative: Run as Standalone Server

If you prefer to run Code Reader independently (not as MCP):

```bash
# Start server directly
npm run dev

# Or in production
npm start
```

Then configure Claude Code to use the HTTP endpoints directly, or integrate via custom tools/functions.

---

## Troubleshooting

### "Cannot find module" Error

**Fix:** Use absolute paths in MCP config
```json
{
  "command": "node",
  "args": ["/Users/yourname/code-reader/dist/index.js"]  // ✓ Absolute
  // Not: ["./dist/index.js"]  // ✗ Relative
}
```

### Server Not Starting

**Check logs:**
```bash
# Claude Desktop logs
tail -f ~/Library/Logs/Claude/mcp.log

# Code Reader logs
tail -f /path/to/code-reader/logs/combined.log
```

**Common fixes:**
- Ensure MongoDB is running
- Check OPENAI_API_KEY is set
- Verify port 3100 is available
- Run `npm run prereqs` to check

### Search Not Working

**Verify task is indexed:**
```bash
curl http://localhost:3100/task/by-identifier/your-identifier
# Check: status should be "completed"
```

**Check embeddings exist:**
```bash
mongosh --eval "
  use code_reader;
  db.embeddings.countDocuments();
"
# Should return > 0
```

---

## FAQ

**Q: Do I need to rebuild when code changes?**
A: No, just re-index that repository (creates new version automatically).

**Q: Can multiple Claude instances use the same server?**
A: Yes, the server is stateless and can handle concurrent requests.

**Q: How much does indexing cost?**
A: Approximately $0.10 per 1 million tokens with text-embedding-3-small. A 500-file repo typically costs $0.01-0.05.

**Q: Can I index private repositories?**
A: Yes, everything runs locally. Code never leaves your machine (except embeddings sent to OpenAI).

**Q: What happens if I restart my computer?**
A: If using auto-start (launchd/systemd), server starts automatically. Otherwise, start it manually or let Claude Code start it.

---

## Getting Help

- **Documentation**: See README.md, USAGE-GUIDE.md, API.md
- **Issues**: Check logs/combined.log for errors
- **API Reference**: http://localhost:3100/openapi.yaml (when running)
- **Health Check**: http://localhost:3100/health

---

## Example MCP Configuration (Complete)

**For macOS/Linux (Dual Connection with Fallback):**
```json
{
  "mcpServers": {
    "code-reader": {
      "command": "node",
      "args": ["/Users/yourname/projects/code-reader/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-proj-your-key-here",
        "MONGODB_ATLAS_URI": "mongodb://localhost:58746/?directConnection=true",
        "MONGODB_LOCAL_URI": "mongodb://localhost:27017",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**For Windows (Dual Connection with Fallback):**
```json
{
  "mcpServers": {
    "code-reader": {
      "command": "node",
      "args": ["C:\\Users\\admin\\Repositories\\code-reader\\dist\\index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-proj-your-key-here",
        "MONGODB_ATLAS_URI": "mongodb://localhost:58746/?directConnection=true",
        "MONGODB_LOCAL_URI": "mongodb://localhost:27017",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Connection Behavior:**
- Server tries Atlas Local first
- Logs: "Attempting connection to Atlas Local (Docker): mongodb://localhost:58746..."
- If Atlas succeeds: "✓ Connected to MongoDB (Atlas Local)"
- If Atlas fails: "Trying fallback connection..." → "✓ Connected to MongoDB (Local MongoDB)"
- Completely automatic - no manual intervention needed!

---

## Next Steps

1. ✅ Build the server: `npm run build`
2. ✅ Configure MCP settings (see examples above)
3. ✅ Start Claude Code
4. ✅ Index your first repository
5. ✅ Ask Claude to search your code!

**Happy coding with AI-powered code search!** 🚀
