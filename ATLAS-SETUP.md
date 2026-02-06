# MongoDB Atlas Vector Search Setup Guide

This guide explains how to set up vector search indexes for optimal performance with the Code Reader MCP system.

## Overview

The Code Reader system supports two search modes:

1. **MongoDB Atlas Vector Search** (Recommended) - Native vector indexing with optimized performance
2. **In-Memory Cosine Similarity** (Fallback) - Works with standard MongoDB but slower for large datasets

---

## Atlas Local Setup (Docker)

Atlas Local runs MongoDB with Atlas features locally via Docker. This is the recommended setup for development.

### Prerequisites

- Docker Desktop installed and running
- Atlas CLI installed: `brew install mongodb-atlas-cli` (Mac) or download from MongoDB

### 1. Start Atlas Local

```bash
# Start a local Atlas deployment
atlas deployments setup

# Follow the prompts:
# - Deployment name: local
# - Deployment type: LOCAL
# - MongoDB version: 7.0 or higher

# Start the deployment
atlas deployments start local
```

### 2. Connect to Atlas Local

```bash
# Get connection string
atlas deployments connect local

# Update your .env or config.json with the connection string
# Example: mongodb://localhost:27017/?directConnection=true
```

### 3. Create Vector Search Index

#### Option A: Using MongoDB Shell (Recommended - Simplest)

```bash
# Connect to Atlas Local (replace port with yours - check logs or .env)
mongosh "mongodb://localhost:58746/?directConnection=true"

# In mongosh, run:
use code_reader

db.embeddings.createSearchIndex({
  name: "vector_index",
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        path: "vector",
        numDimensions: 1536,
        similarity: "cosine"
      },
      {
        type: "filter",
        path: "taskId"
      }
    ]
  }
});

# Exit mongosh
exit
```

**Important:** The `taskId` filter field is required because search queries filter by task!

#### Option B: Using Atlas CLI

```bash
# Method 1: Direct command (no file needed)
atlas deployments search indexes create \
  --deploymentName local8145 \
  --type vectorSearch \
  -h

# Method 2: Via MongoDB shell (Atlas CLI wraps this)
atlas deployments connect local8145 --eval "
  use code_reader;
  db.embeddings.createSearchIndex({
    name: 'vector_index',
    type: 'vectorSearch',
    definition: {
      fields: [
        { type: 'vector', path: 'vector', numDimensions: 1536, similarity: 'cosine' },
        { type: 'filter', path: 'taskId' }
      ]
    }
  });
"
```

**Note:** Replace `local8145` with your actual deployment name from `atlas deployments list`

---

### 🔧 Fixing Existing Index (If You Already Created One Without taskId Filter)

If you created the index without the `taskId` filter field, you'll get errors when searching. **Drop and recreate it:**

```bash
# Connect to MongoDB
mongosh "mongodb://localhost:58746/?directConnection=true"

# Drop old index
use code_reader
db.embeddings.dropSearchIndex("vector_index")

# Create new index with filter field
db.embeddings.createSearchIndex({
  name: "vector_index",
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        path: "vector",
        numDimensions: 1536,
        similarity: "cosine"
      },
      {
        type: "filter",
        path: "taskId"
      }
    ]
  }
});

# Exit
exit
```

Then restart your Code Reader server.

---

### 4. Verify Index Creation

```bash
# List search indexes
mongosh "mongodb://localhost:27017" --eval "
  db = db.getSiblingDB('code_reader');
  db.embeddings.getSearchIndexes();
"

# You should see:
# [
#   {
#     id: '...',
#     name: 'vector_index',
#     type: 'vectorSearch',
#     status: 'READY'
#   }
# ]
```

### 5. Test Vector Search

Start your Code Reader server and check the logs:

```bash
npm run dev

# Look for this message in the logs:
# [info]: MongoDB Atlas Vector Search index detected - using native vector search
```

If you see the fallback message instead, wait a few minutes for the index to finish building, then restart the server.

---

## MongoDB Atlas Cloud Setup

### 1. Create Atlas Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free M0 cluster or higher
3. Create a database user
4. Whitelist your IP address

### 2. Get Connection String

```
mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
```

Update your `.env`:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
```

### 3. Create Vector Search Index via UI

1. In Atlas UI, go to your cluster
2. Click "Search" tab
3. Click "Create Search Index"
4. Choose "JSON Editor"
5. Select database: `code_reader`, collection: `embeddings`
6. Paste this index definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "vector",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "taskId"
    }
  ]
}
```

**Important:** Include the `taskId` filter field - search queries filter by taskId!

7. Name the index: `vector_index`
8. Click "Create Search Index"
9. Wait for status to show "Active" (may take a few minutes)

### 4. Verify

Start the Code Reader server and check logs for:
```
[info]: MongoDB Atlas Vector Search index detected - using native vector search
```

---

## Troubleshooting

### "No Atlas Vector Search index found" with Atlas Local

**Check Atlas Local is Running:**
```bash
atlas deployments list

# Should show status: RUNNING
```

**Verify Index Exists:**
```bash
mongosh "mongodb://localhost:27017" --eval "
  db = db.getSiblingDB('code_reader');
  db.embeddings.getSearchIndexes();
"
```

**Check Index Status:**
- Index must show `status: 'READY'` or `status: 'ACTIVE'`
- Initial index building can take 1-5 minutes
- Restart Code Reader server after index is ready

**Verify Collection Has Data:**
```bash
mongosh "mongodb://localhost:27017" --eval "
  db = db.getSiblingDB('code_reader');
  db.embeddings.countDocuments();
"

# Index is only created when collection has data
# If count is 0, process a task first, then create the index
```

### "Could not detect Atlas Vector Search"

**Check MongoDB Version:**
```bash
mongosh --eval "db.version()"

# Atlas Local requires MongoDB 7.0+
# Regular MongoDB won't support vector search regardless of version
```

**Check Server Build Info:**
```bash
mongosh --eval "db.adminCommand({buildInfo: 1})"

# Look for:
# - modules: ['enterprise'] or ['atlas']
# - gitVersion containing 'atlas'
```

### Performance is Slow with Fallback

The in-memory fallback works well for up to ~10,000 embeddings. For larger datasets:

1. **Use Atlas Local** (free, local):
   ```bash
   atlas deployments setup local
   ```

2. **Use Atlas Cloud** (free M0 tier available):
   - Sign up at mongodb.com/cloud/atlas
   - Create M0 cluster (free forever)
   - Create vector search index

3. **Batch Your Searches**:
   - Limit results to what you need
   - Use specific, targeted queries
   - Process smaller repositories separately

---

## Index Configuration Reference

### Required Index Definition (For Code Reader)

**⚠️ IMPORTANT:** Code Reader requires the `taskId` filter field because searches filter by task.

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "vector",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "taskId"
    }
  ]
}
```

### Basic Vector Index (Not Sufficient for Code Reader)

This basic definition **will NOT work** with Code Reader because it's missing the `taskId` filter:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "vector",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

**Error you'll get:** "Path 'taskId' needs to be indexed as filter"

### Index Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `name` | `vector_index` | Must match the name used in search queries |
| `type` | `vectorSearch` | Indicates this is a vector search index |
| `path` | `vector` | Field containing the embedding vector |
| `numDimensions` | `1536` | OpenAI text-embedding-3-small dimensions |
| `similarity` | `cosine` | Distance metric for similarity calculation |

---

## Performance Comparison

### Atlas Vector Search (Recommended)

- **Speed**: Sub-second queries even with 100,000+ embeddings
- **Memory**: Minimal (index stored on disk)
- **Scalability**: Handles millions of vectors
- **Cost**: Free with M0 tier (cloud) or Atlas Local (Docker)

### In-Memory Fallback

- **Speed**: Good for <10,000 embeddings, slows beyond that
- **Memory**: Loads all embeddings into RAM during search
- **Scalability**: Limited by available memory
- **Cost**: Free (uses standard MongoDB)

---

## Quick Setup Commands

### Atlas Local (Recommended for Development)

```bash
# Install Atlas CLI
brew install mongodb-atlas-cli  # macOS
# or download from https://www.mongodb.com/try/download/atlascli

# Setup local deployment
atlas deployments setup
# Choose: LOCAL deployment, MongoDB 7.0+

# Start deployment
atlas deployments start local

# Get connection string
atlas deployments connect local
# Example: mongodb://localhost:27017

# Create vector index with taskId filter (REQUIRED!)
mongosh "mongodb://localhost:27017" --eval "
  use code_reader;
  db.embeddings.createSearchIndex({
    name: 'vector_index',
    type: 'vectorSearch',
    definition: {
      fields: [
        { type: 'vector', path: 'vector', numDimensions: 1536, similarity: 'cosine' },
        { type: 'filter', path: 'taskId' }
      ]
    }
  });
"

# Verify index was created
mongosh "mongodb://localhost:27017" --eval "
  use code_reader;
  db.embeddings.getSearchIndexes();
"

# Update Code Reader connection (use your actual port!)
export MONGODB_URI="mongodb://localhost:27017"
npm run dev

# Look for: "✓ MongoDB Atlas Vector Search index is READY - using native vector search"
```

### Atlas Cloud (Free Tier)

1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create M0 (free) cluster
3. In Atlas UI → Search → Create Search Index
4. Select: Database `code_reader`, Collection `embeddings`
5. Use JSON Editor, paste index definition above
6. Name it `vector_index`
7. Update `.env` with your connection string
8. Run `npm run dev`

---

## FAQ

**Q: Do I need Atlas for Code Reader to work?**
A: No, the in-memory fallback works fine for smaller repositories (<10,000 embeddings).

**Q: Is Atlas Local really free?**
A: Yes, Atlas Local runs entirely on your machine using Docker. No cloud costs.

**Q: How do I know which mode I'm using?**
A: Check the server logs on startup. It will explicitly state "using native vector search" or "using fallback".

**Q: Can I switch from fallback to Atlas later?**
A: Yes, just create the index and restart the server. All existing data works immediately.

**Q: What if my index is still building?**
A: The system will use fallback until the index status is READY/ACTIVE. Restart the server once building completes.

---

## Support

For Atlas Local issues:
- Docs: https://www.mongodb.com/docs/atlas/cli/current/atlas-cli-deploy-local/
- CLI Help: `atlas deployments --help`

For Atlas Cloud issues:
- Docs: https://www.mongodb.com/docs/atlas/atlas-vector-search/
- Support: https://www.mongodb.com/community/forums/
