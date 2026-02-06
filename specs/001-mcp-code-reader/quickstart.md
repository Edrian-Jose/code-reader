# Quickstart: Code Reader MCP System

**Feature**: 001-mcp-code-reader
**Date**: 2026-02-07

## Prerequisites

Before installing Code Reader, ensure you have:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 18.0+ | `node --version` |
| npm | 9.0+ | `npm --version` |
| MongoDB | 6.0+ | `mongod --version` |
| OpenAI API Key | - | Set in environment |

## Installation

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd code-reader

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
# Required: OpenAI API key for embeddings
OPENAI_API_KEY=sk-your-api-key-here

# Optional: Override defaults
# MONGODB_URI=mongodb://localhost:27017
# CODE_READER_PORT=3100
```

### 3. Start MongoDB

Ensure MongoDB is running locally:

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Windows
net start MongoDB

# Docker
docker run -d -p 27017:27017 --name mongodb mongo:6
```

### 4. Initialize Database

```bash
npm run db:init
```

This creates:
- Database: `code_reader`
- Collections: `tasks`, `files`, `chunks`, `embeddings`
- Required indexes

### 5. Start the Server

```bash
npm start
```

Expected output:
```
[INFO] Code Reader MCP Server starting...
[INFO] Connected to MongoDB at localhost:27017
[INFO] Server listening on http://localhost:3100
```

## Quick Usage

### Create an Extraction Task

```bash
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/path/to/your/repository"
  }'
```

Response:
```json
{
  "data": {
    "type": "task",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "attributes": {
      "taskId": "550e8400-e29b-41d4-a716-446655440000",
      "version": 1,
      "status": "pending"
    }
  }
}
```

### Start Processing

```bash
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

Response:
```json
{
  "data": {
    "type": "process",
    "attributes": {
      "status": "processing",
      "message": "Processing started"
    }
  }
}
```

### Check Progress

```bash
curl http://localhost:3100/task/550e8400-e29b-41d4-a716-446655440000
```

Response:
```json
{
  "data": {
    "type": "task",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "attributes": {
      "taskId": "550e8400-e29b-41d4-a716-446655440000",
      "version": 1,
      "status": "processing",
      "progress": {
        "totalFiles": 150,
        "processedFiles": 75,
        "currentBatch": 2,
        "totalBatches": 3,
        "percentComplete": 50
      }
    }
  }
}
```

### Search Code

```bash
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "query": "function that handles user authentication",
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "limit": 5
  }'
```

Response:
```json
{
  "data": {
    "type": "search_results",
    "attributes": {
      "query": "function that handles user authentication",
      "taskId": "550e8400-e29b-41d4-a716-446655440000",
      "resultCount": 5,
      "results": [
        {
          "filePath": "src/auth/login.ts",
          "content": "export async function authenticateUser(credentials: Credentials): Promise<User> {\n  // Validate credentials...\n}",
          "startLine": 15,
          "endLine": 45,
          "score": 0.92
        }
      ]
    }
  }
}
```

## Configuration Options

Edit `config.json` to customize behavior:

```json
{
  "mongodb": {
    "uri": "mongodb://localhost:27017",
    "database": "code_reader"
  },
  "openai": {
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

## Troubleshooting

### MongoDB Connection Failed

```
Error: MongoServerError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution**: Start MongoDB service (see Step 3 above)

### OpenAI API Error

```
Error: OpenAI API error: 401 Unauthorized
```

**Solution**: Verify `OPENAI_API_KEY` is set correctly in `.env`

### Port Already in Use

```
Error: EADDRINUSE: address already in use :::3100
```

**Solution**: Change port in `config.json` or stop the conflicting process:
```bash
lsof -i :3100  # Find process
kill -9 <PID>  # Stop it
```

### Out of Memory

```
Error: JavaScript heap out of memory
```

**Solution**: Reduce `batchSize` in configuration:
```json
{
  "extraction": {
    "batchSize": 25
  }
}
```

## Development

### Run Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires MongoDB)
npm run test:integration

# All tests
npm test
```

### Watch Mode

```bash
npm run dev
```

### Lint and Format

```bash
npm run lint
npm run format
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/task` | POST | Create extraction task |
| `/task/{id}` | GET | Get task status/progress |
| `/process` | POST | Start/resume processing |
| `/search_code` | POST | Semantic code search |

See [contracts/openapi.yaml](contracts/openapi.yaml) for full API documentation.

## Next Steps

1. Process your first repository
2. Experiment with search queries
3. Try different chunk sizes for your codebase
4. Set up as an MCP server in your AI workflow
