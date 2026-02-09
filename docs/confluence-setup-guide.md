# Confluence Integration Setup Guide

**Purpose**: Step-by-step guide to configure Confluence as an external documentation source for enriching generated documentation with user stories and requirements from Confluence wiki pages.

**Last Updated**: 2026-02-09

---

## Overview

The Code Reader documentation generator can optionally pull user stories and requirements from Confluence Cloud to enrich generated documentation. This integration:

- ✅ Adds user stories from Confluence pages to documentation artifacts
- ✅ Includes proper citations for Confluence data
- ✅ Works via MCP (Model Context Protocol) tool calls
- ✅ Delegates authentication to MCP client (no credentials stored)
- ✅ Gracefully degrades if Confluence is unavailable

**Cost**: Confluence queries add ~5-10 seconds per domain (no additional GPT-4 cost)

---

## Prerequisites

Before configuring Confluence integration, you need:

1. **Confluence Cloud Account**
   - Organization/workspace with admin access
   - Cloud instance (not Confluence Server/Data Center)

2. **MCP Client with Atlassian/Confluence Server**
   - MCP-compatible client (e.g., Claude Desktop, custom MCP client)
   - Atlassian MCP server installed and configured
   - Authentication configured in MCP client

3. **Code Reader Setup**
   - Repository already extracted (code chunks + embeddings created)
   - Documentation plan created via `POST /documentation/plan`
   - OpenAI API key configured for GPT-4 analysis

---

## Step 1: Get Your Confluence Cloud ID

The Confluence Cloud ID is a unique identifier for your Confluence instance. You need this to configure the integration.

### Option A: Find Cloud ID in Confluence URL

1. **Log in to Confluence Cloud**
   - Go to your Confluence workspace (e.g., `https://your-domain.atlassian.net/wiki`)

2. **Navigate to any space or page**

3. **Check the URL** - it will look like:
   ```
   https://your-domain.atlassian.net/wiki/spaces/MYSPACE/overview
   ```

4. **Get your cloud ID via API**:
   ```bash
   # Use Atlassian's accessible resources API
   curl -u your-email@example.com:your-api-token \
     https://api.atlassian.com/oauth/token/accessible-resources
   ```

   **Response**:
   ```json
   [
     {
       "id": "1324a887-45db-1bf4-1e99-ef0ff456d421",  // ← This is your Cloud ID
       "url": "https://your-domain.atlassian.net",
       "name": "Your Workspace Name",
       "scopes": ["read:confluence-content.all"],
       "avatarUrl": "https://..."
     }
   ]
   ```

5. **Copy the `id` field** - this is your Confluence Cloud ID (UUID format)

### Option B: Use Confluence API

1. **Get your site URL** (e.g., `https://your-domain.atlassian.net`)

2. **Call the cloudId endpoint**:
   ```bash
   curl -u your-email@example.com:your-api-token \
     "https://your-domain.atlassian.net/_edge/tenant_info"
   ```

   **Response**:
   ```json
   {
     "cloudId": "1324a887-45db-1bf4-1e99-ef0ff456d421"  // ← Your Cloud ID
   }
   ```

---

## Step 2: Create Confluence API Token

The MCP client needs an API token to authenticate with Confluence.

1. **Go to Atlassian Account Settings**
   - Visit: https://id.atlassian.com/manage-profile/security/api-tokens

2. **Create API Token**
   - Click "Create API token"
   - Label: `Code Reader Documentation MCP` (or any descriptive name)
   - Click "Create"

3. **Copy the token immediately**
   - Token format: `ATATT3xFfGF0...` (long alphanumeric string)
   - ⚠️ **Save it securely** - you cannot view it again after closing the dialog

4. **Store securely**
   - Add to password manager
   - Will be used in MCP client configuration (not in Code Reader)

---

## Step 3: Configure MCP Client with Atlassian Server

The Atlassian MCP server handles Confluence authentication and queries. You need to configure it in your MCP client.

### For Claude Desktop (Example)

1. **Locate MCP configuration file**:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Add Atlassian MCP server**:
   ```json
   {
     "mcpServers": {
       "atlassian": {
         "command": "npx",
         "args": [
           "-y",
           "@modelcontextprotocol/server-atlassian"
         ],
         "env": {
           "ATLASSIAN_INSTANCE_URL": "https://your-domain.atlassian.net",
           "ATLASSIAN_USERNAME": "your-email@example.com",
           "ATLASSIAN_API_TOKEN": "ATATT3xFfGF0..."
         }
       }
     }
   }
   ```

3. **Replace placeholders**:
   - `your-domain`: Your Atlassian subdomain
   - `your-email@example.com`: Your Atlassian account email
   - `ATATT3xFfGF0...`: Your API token from Step 2

4. **Restart MCP client** (e.g., restart Claude Desktop)

5. **Verify MCP server is connected**:
   - Check MCP client logs for "Atlassian server connected"
   - Some clients show available MCP servers in settings

### For Custom MCP Client

If using a custom MCP client implementation:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Configure Atlassian MCP server
const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-atlassian'],
  env: {
    ATLASSIAN_INSTANCE_URL: 'https://your-domain.atlassian.net',
    ATLASSIAN_USERNAME: 'your-email@example.com',
    ATLASSIAN_API_TOKEN: process.env.ATLASSIAN_API_TOKEN,
  },
});

const client = new Client({
  name: 'code-reader-client',
  version: '1.0.0',
}, {
  capabilities: {}
});

await client.connect(transport);
```

---

## Step 4: Configure Confluence in Code Reader

Once your MCP client is configured with Atlassian authentication, configure Confluence in your documentation plan.

### API Request

```bash
# Get your plan ID from the plan creation response
# Then configure Confluence:

curl -X POST http://localhost:3100/documentation/source/configure \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "550e8400-e29b-41d4-a716-446655440000",
    "sourceType": "confluence",
    "configuration": {
      "cloudId": "1324a887-45db-1bf4-1e99-ef0ff456d421"
    }
  }'
```

### Request Parameters

| Parameter | Description | Where to Get It |
|-----------|-------------|-----------------|
| `planId` | Documentation plan UUID | Response from `POST /documentation/plan` |
| `sourceType` | Must be `"confluence"` | Fixed value |
| `configuration.cloudId` | Confluence cloud instance ID | Step 1 above |

### Success Response

```json
{
  "data": {
    "type": "external_source_config",
    "id": "config-uuid-here",
    "attributes": {
      "configId": "config-uuid-here",
      "planId": "550e8400-e29b-41d4-a716-446655440000",
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

**What This Means:**
- ✅ Confluence is now configured for this documentation plan
- ✅ When tasks execute, they will query Confluence automatically
- ✅ User stories from Confluence will be included in artifacts
- ✅ Authentication happens via MCP client (Code Reader stores no credentials)

---

## Step 5: Execute Documentation Tasks

Now when you execute documentation tasks, Confluence enrichment happens automatically.

```bash
# Execute next task (includes Confluence enrichment if configured)
curl -X POST http://localhost:3100/documentation/execute \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-app-docs"}'
```

### What Happens During Execution

For each domain:

1. **Code Analysis** (always runs):
   - Gathers 20-50 code chunks via semantic search
   - Analyzes with GPT-4 for business rules, flows, models
   - ~30-60 seconds

2. **Confluence Enrichment** (if configured):
   - Builds CQL query: `text ~ "Domain Name" AND type = page`
   - Queries Confluence via MCP tool call
   - Timeout: 30 seconds
   - Retries: 2 attempts with exponential backoff (1s, 2s delays)
   - Extracts up to 5 user stories from matching pages
   - ~5-10 seconds

3. **Artifact Generation**:
   - Merges GPT-4 analysis + Confluence user stories
   - Includes citations for both sources
   - Quality scoring and validation

### Response with Confluence Data

```json
{
  "data": {
    "type": "documentation_task",
    "attributes": {
      "domain": "User Authentication",
      "status": "completed",
      "artifactRef": "artifact-uuid-here"
    }
  },
  "meta": {
    "planProgress": {
      "completed": 1,
      "remaining": 7,
      "percentComplete": 12
    },
    "llmCost": {
      "inputTokens": 8234,
      "outputTokens": 1876,
      "totalTokens": 10110,
      "costUSD": "$0.1387"
    }
  }
}
```

---

## Step 6: Verify Confluence Data in Artifacts

Retrieve the generated artifact to verify Confluence data was included.

```bash
# Get artifact (use artifactRef from execute response)
curl -X GET http://localhost:3100/documentation/artifact/artifact-uuid-here \
  -H "Accept: application/json"
```

### Artifact Structure with Confluence

```json
{
  "data": {
    "type": "documentation_artifact",
    "attributes": {
      "domainName": "User Authentication",
      "sections": {
        "businessRules": [...],      // From GPT-4 code analysis
        "programFlows": [...],        // From GPT-4 code analysis
        "domainModels": [...],        // From GPT-4 code analysis
        "contracts": [...],           // From GPT-4 code analysis
        "userStories": [              // ← From Confluence enrichment
          {
            "title": "As a user, I want secure login",
            "description": "User authentication should support...",
            "acceptanceCriteria": [],
            "sources": ["confluence"]  // ← Marked as Confluence source
          }
        ],
        "invariants": [...]
      },
      "citations": [
        {
          "source": "code_chunks",
          "reference": "42 code chunks analyzed by GPT-4 for User Authentication",
          "retrievedAt": "2026-02-09T10:30:00Z"
        },
        {
          "source": "confluence",  // ← Confluence citation
          "reference": "Confluence query: text ~ \"User Authentication\" AND type = page (3 results)",
          "retrievedAt": "2026-02-09T10:30:15Z"
        }
      ]
    }
  }
}
```

---

## Troubleshooting

### Problem: "Confluence MCP server not configured"

**Symptom**: Logs show `[EXTERNAL SOURCE UNAVAILABLE] Confluence MCP server not configured`

**Cause**: MCP client doesn't have Atlassian server configured or isn't running

**Solution**:
1. Verify MCP client configuration file has `atlassian` server entry
2. Restart MCP client
3. Check MCP client logs for connection errors
4. Verify API token is valid (test with direct Confluence API call)

**Graceful Behavior**: Documentation generation continues using code analysis only

### Problem: Authentication Failed / 401 Unauthorized

**Symptom**: Logs show authentication errors when querying Confluence

**Cause**: Invalid or expired API token

**Solution**:
1. Regenerate API token at https://id.atlassian.com/manage-profile/security/api-tokens
2. Update MCP client configuration with new token
3. Restart MCP client

### Problem: No User Stories Found

**Symptom**: Confluence query succeeds but no user stories in artifacts

**Cause**: No Confluence pages match the domain name query

**Solution**:
1. **Check Confluence spaces** - ensure pages exist for the domain
2. **Verify page titles** - CQL query searches for domain name in page text
3. **Example**: For domain "User Authentication", create Confluence pages with:
   - Title: "User Authentication Requirements"
   - Content: User stories, acceptance criteria, business rules

### Problem: Timeout / Slow Queries

**Symptom**: Confluence queries timeout after 30 seconds

**Cause**: Large Confluence instance or complex CQL queries

**Solution**:
- Query timeout is currently fixed at 30 seconds
- System retries 2 times with exponential backoff
- After 3 failed attempts, gracefully degrades (continues without Confluence)
- Consider creating dedicated Confluence spaces for documentation source data

### Problem: Wrong Confluence Instance

**Symptom**: Configured but queries return no results

**Cause**: cloudId doesn't match your actual Confluence instance

**Solution**:
1. Verify cloudId using Step 1 methods above
2. Reconfigure with correct cloudId:
   ```bash
   curl -X POST http://localhost:3100/documentation/source/configure \
     -d '{
       "planId": "your-plan-id",
       "sourceType": "confluence",
       "configuration": {"cloudId": "correct-cloud-id-here"}
     }'
   ```

---

## Testing Your Confluence Setup

### Test 1: Verify MCP Server Connection

**Using Claude Desktop or MCP-enabled client:**

Try making a direct Confluence query:
```
Search Confluence for "authentication" pages
```

If this works, your MCP Atlassian server is properly configured.

### Test 2: Verify Cloud ID

```bash
# Test direct Confluence API access with your cloudId
curl -u your-email@example.com:your-api-token \
  "https://api.atlassian.com/ex/confluence/{cloudId}/wiki/rest/api/search?cql=type=page" \
  | jq .
```

If this returns results, your cloudId is correct.

### Test 3: End-to-End Documentation with Confluence

```bash
# 1. Create documentation plan
PLAN_RESPONSE=$(curl -s -X POST http://localhost:3100/documentation/plan \
  -H "Content-Type: application/json" \
  -d '{"repositoryIdentifier": "my-repo", "identifier": "my-repo-docs"}')

PLAN_ID=$(echo $PLAN_RESPONSE | jq -r '.data.id')

# 2. Configure Confluence
curl -X POST http://localhost:3100/documentation/source/configure \
  -H "Content-Type: application/json" \
  -d "{
    \"planId\": \"$PLAN_ID\",
    \"sourceType\": \"confluence\",
    \"configuration\": {
      \"cloudId\": \"your-cloud-id-here\"
    }
  }"

# 3. Execute a task
TASK_RESPONSE=$(curl -s -X POST http://localhost:3100/documentation/execute \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-repo-docs"}')

ARTIFACT_ID=$(echo $TASK_RESPONSE | jq -r '.data.attributes.artifactRef')

# 4. Check artifact for Confluence data
curl -X GET "http://localhost:3100/documentation/artifact/$ARTIFACT_ID" \
  -H "Accept: application/json" \
  | jq '.data.attributes.sections.userStories'

# Should show user stories with "sources": ["confluence"]
```

---

## Confluence Data Structure

### What Gets Extracted from Confluence

**From Each Matching Page:**
- **Title** → User story title
- **Content** (first 500 chars) → User story description
- **Space key** → Included in citation
- **Page URL** → Could be added to citation (future enhancement)

**Limit**: Up to 5 user stories per domain

### CQL Query Format

The system automatically generates CQL (Confluence Query Language) queries:

**Format**:
```cql
text ~ "Domain Name" AND type = page ORDER BY lastModified DESC
```

**Example** for domain "User Authentication":
```cql
text ~ "User Authentication" AND type = page ORDER BY lastModified DESC
```

**With Repository Name**:
```cql
text ~ "User Authentication" AND (text ~ "my-app" OR space = "my-app") AND type = page ORDER BY lastModified DESC
```

### Optimizing Confluence Pages for Documentation

**Best Practices**:

1. **Create dedicated spaces** for each repository:
   - Space key: Repository name (e.g., "MYAPP")
   - Makes queries more precise

2. **Use consistent page titles**:
   - Include domain names in page titles
   - Example: "User Authentication - Requirements"

3. **Structure user stories clearly**:
   ```markdown
   # User Authentication Requirements

   ## User Story 1: Secure Login
   As a user, I want to log in securely so that my data is protected.

   Acceptance Criteria:
   - Password must be at least 8 characters
   - Support 2FA authentication
   - Session timeout after 24 hours

   ## User Story 2: Password Reset
   ...
   ```

4. **Tag pages appropriately**:
   - Use labels: `requirements`, `user-stories`, `domain-{name}`
   - Improves search precision (future enhancement)

---

## Configuration Reference

### Required Confluence Permissions

The API token needs these Confluence scopes:
- ✅ `read:confluence-content.all` - Read pages and spaces
- ✅ `search:confluence` - Execute CQL queries

**Not Required**:
- ❌ Write permissions (read-only integration)
- ❌ Admin permissions

### Configuration Storage

When you configure Confluence, Code Reader stores:

```json
{
  "configId": "uuid-v4",
  "planId": "plan-uuid",
  "sourceType": "confluence",
  "enabled": true,
  "connectionParams": {
    "cloudId": "1324a887-45db-1bf4-1e99-ef0ff456d421"  // Only this is stored
  },
  "authDelegation": {
    "protocol": "mcp",
    "upstreamServer": "atlassian"  // Indicates MCP client handles auth
  }
}
```

**Security**:
- ✅ No API tokens stored in Code Reader
- ✅ No credentials in database
- ✅ Only cloudId (non-sensitive) persisted
- ✅ Authentication delegated to MCP client

---

## Complete Workflow Example

```bash
# =============================================================================
# COMPLETE WORKFLOW: Code Repository → Documentation with Confluence
# =============================================================================

# Step 1: Extract repository (creates code chunks + embeddings)
curl -X POST http://localhost:3100/task \
  -d '{"repositoryPath": "/path/to/my-app", "identifier": "my-app"}'

curl -X POST http://localhost:3100/process \
  -d '{"identifier": "my-app", "fileLimit": 200}'

# Wait for processing to complete (poll GET /task/by-identifier/my-app)

# Step 2: Create documentation plan
PLAN_RESPONSE=$(curl -s -X POST http://localhost:3100/documentation/plan \
  -d '{"repositoryIdentifier": "my-app", "identifier": "my-app-docs"}')

PLAN_ID=$(echo $PLAN_RESPONSE | jq -r '.data.id')
echo "Plan created: $PLAN_ID"

# Step 3: Configure Confluence (optional but recommended)
curl -X POST http://localhost:3100/documentation/source/configure \
  -d "{
    \"planId\": \"$PLAN_ID\",
    \"sourceType\": \"confluence\",
    \"configuration\": {
      \"cloudId\": \"1324a887-45db-1bf4-1e99-ef0ff456d421\"
    }
  }"

# Step 4: Execute all documentation tasks
# Run this multiple times until all tasks complete
for i in {1..10}; do
  TASK_RESPONSE=$(curl -s -X POST http://localhost:3100/documentation/execute \
    -d '{"identifier": "my-app-docs"}')

  STATUS=$(echo $TASK_RESPONSE | jq -r '.data.attributes.status')
  DOMAIN=$(echo $TASK_RESPONSE | jq -r '.data.attributes.domain')

  echo "Task $i: $DOMAIN - $STATUS"

  # Check if no more tasks
  if [ "$STATUS" == "null" ]; then
    echo "All tasks complete!"
    break
  fi

  # Wait between tasks (GPT-4 rate limits)
  sleep 2
done

# Step 5: Export documentation to files
curl -X POST http://localhost:3100/documentation/export \
  -d '{"identifier": "my-app-docs"}'

# Documentation now available in /path/to/my-app/docs/*.md
```

---

## Confluence Query Examples

### Basic Domain Query

**Domain**: "Task Management"

**Generated CQL**:
```cql
text ~ "Task Management" AND type = page ORDER BY lastModified DESC
```

**Matches**:
- Page title: "Task Management Requirements"
- Page content: "The Task Management subsystem handles..."
- Any page mentioning "Task Management"

### Repository-Scoped Query

**Domain**: "User Authentication"
**Repository**: "my-app"

**Generated CQL**:
```cql
text ~ "User Authentication" AND (text ~ "my-app" OR space = "my-app") AND type = page ORDER BY lastModified DESC
```

**Matches**:
- Pages in "my-app" space about User Authentication
- Pages mentioning both "User Authentication" and "my-app"

---

## FAQ

### Q: Is Confluence required?

**No.** Confluence is completely optional. The documentation generator works perfectly without it using only code analysis and CLAUDE.md.

### Q: What if Confluence is down?

The system **gracefully degrades**:
1. Attempts query (30s timeout)
2. Retries 2 times with backoff
3. If all attempts fail, logs warning
4. Continues documentation generation without Confluence data
5. Task still completes successfully

### Q: Can I use Confluence Server (on-premises)?

**Not currently.** Only Confluence Cloud is supported. The integration uses:
- Atlassian Cloud API (`api.atlassian.com`)
- Cloud ID format (UUID)

Confluence Server support would require a different MCP server implementation.

### Q: How much does Confluence add to generation time?

**Per Domain**:
- Code analysis: ~30-60 seconds (GPT-4)
- Confluence query: ~5-10 seconds (API call + retries)
- **Total**: ~35-70 seconds per domain

### Q: Can I configure multiple Confluence instances?

**Not currently.** One Confluence cloudId per documentation plan. You can:
- Create different plans for different cloudIds
- Version plans if cloudId changes (v1 → v2)

### Q: What if I change cloudId later?

Reconfigure using the same endpoint:
```bash
curl -X POST http://localhost:3100/documentation/source/configure \
  -d '{
    "planId": "existing-plan-id",
    "sourceType": "confluence",
    "configuration": {"cloudId": "new-cloud-id"}
  }'
```

This **overwrites** the previous configuration. Future task executions will use the new cloudId.

### Q: How are Confluence permissions handled?

**Permissions are enforced by the MCP client**:
- MCP client authenticates with your Confluence account
- CQL queries respect your Confluence permissions
- You can only access pages you have permission to read
- Code Reader never bypasses Confluence permissions

---

## Next Steps

After configuring Confluence:

1. **Execute documentation tasks** - run `POST /documentation/execute` multiple times
2. **Review artifacts** - check that user stories from Confluence are included
3. **Export to files** - run `POST /documentation/export` to write docs to `/docs` folder
4. **Iterate** - update Confluence pages and regenerate docs (create new plan version)

---

## Related Documentation

- [API Reference](../API.md) - Complete API documentation
- [OpenAPI Spec](../openapi.yaml) - Machine-readable API schema
- [Feature Specification](../specs/003-reconstruction-docs/spec.md) - Requirements and design
- [Refactoring Notes](../specs/003-reconstruction-docs/REFACTORING-NOTES.md) - LLM implementation details

---

**Setup Complete!** Your documentation generator can now pull user stories from Confluence to create comprehensive, reconstruction-grade system documentation.
