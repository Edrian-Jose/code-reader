# Code Reader MCP System

A local-first MCP (Model Context Protocol) system for code extraction, embedding generation, and semantic search. Extract code from repositories, generate embeddings using OpenAI's API, and search through your codebase using natural language queries.

> **🎉 NEW!** See [USAGE-GUIDE.md](USAGE-GUIDE.md) for the latest features:
> - **AI-Friendly Identifiers**: Use `"my-app"` instead of UUIDs
> - **Token Budget Control**: Specify file limits per session
> - **Graceful Stop**: Stop processing without losing progress
> - **Smart Recommendations**: Auto-calculated file limits (~200k tokens/session)

## Features

- **Code Extraction**: Scan repositories and extract code files with configurable filters
- **Smart Chunking**: Token-based chunking with boundary detection and overlap
- **Embeddings Generation**: Generate embeddings using OpenAI's text-embedding-3-small model
- **Semantic Search**: Natural language search across your embedded codebase
- **Vector Search Options**: Native Atlas vector search OR in-memory fallback (auto-detected)
- **User-Friendly Identifiers**: Use memorable names like "my-app" instead of UUIDs (perfect for AI agents!)
- **Token Budget Management**: Control costs with file limits and smart recommendations
- **Graceful Stop/Resume**: Stop processing anytime and resume later
- **Resume Capability**: Atomic batch processing with resume from interruption
- **Task Versioning**: Multiple versions per identifier with automatic cleanup
- **Localhost Only**: All endpoints bound to localhost for security

> **📊 For Optimal Performance:** Use MongoDB Atlas Local (free Docker deployment) for native vector search. See [ATLAS-SETUP.md](ATLAS-SETUP.md) for setup instructions. The system works with standard MongoDB too, using an in-memory fallback.

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB 6.0+ running on localhost:27017 **OR** MongoDB Atlas Local (recommended)
- OpenAI API key

> **Performance Tip:** For best search performance, use **MongoDB Atlas Local** (free Docker deployment) which supports native vector search. See [ATLAS-SETUP.md](ATLAS-SETUP.md) for 5-minute setup guide. Standard MongoDB works too with automatic fallback.

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd code-reader

# Install dependencies
npm install

# Check prerequisites
npm run prereqs

# Initialize database
npm run db:init

# Set up environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### Configuration

Create a `config.json` file in the project root (or use environment variables):

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
    "extensions": [".js", ".ts", ".py", ".go", ".rs", ".java", ".cpp", ".c", ".h", ".md"],
    "excludeDirs": ["node_modules", ".git", "dist", "build"]
  },
  "server": {
    "port": 3100,
    "host": "localhost"
  },
  "logging": {
    "level": "info",
    "directory": "logs",
    "maxFileSize": 10485760,
    "maxFiles": 5
  }
}
```

### Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start
```

## Usage Example

```bash
# 1. Create task with user-friendly identifier
curl -X POST http://localhost:3100/task \
  -H "Content-Type: application/json" \
  -d '{
    "repositoryPath": "/path/to/your/repo",
    "identifier": "my-app"
  }'

# Response includes totalFiles and recommendedFileLimit:
# {
#   "data": {
#     "attributes": {
#       "identifier": "my-app",
#       "progress": { "totalFiles": 450 },
#       "recommendedFileLimit": 133  # ~200k tokens per session
#     }
#   }
# }

# 2. Start processing with file limit (budget control)
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "fileLimit": 133
  }'

# 3. Check status by identifier
curl http://localhost:3100/task/by-identifier/my-app

# 4. Search code using identifier (AI-agent friendly!)
curl -X POST http://localhost:3100/search_code \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "query": "authentication middleware",
    "limit": 5
  }'

# 5. Stop processing gracefully (if needed)
curl -X POST http://localhost:3100/process/stop \
  -H "Content-Type: application/json" \
  -d '{"identifier": "my-app"}'

# 6. Resume later with another batch
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-app",
    "fileLimit": 133
  }'
```

**See [USAGE-GUIDE.md](USAGE-GUIDE.md) for complete workflow examples and AI agent integration patterns.**

## API Documentation

### Complete API Reference

See [API.md](API.md) for comprehensive API documentation including:
- All endpoint details
- Request/response examples
- Common workflows
- Error handling
- Code examples in multiple languages

### OpenAPI Specification

- **File**: [openapi.yaml](openapi.yaml)
- **Runtime URL**: http://localhost:3100/openapi.yaml

You can use the OpenAPI spec with:
- Swagger Editor: https://editor.swagger.io/
- Postman: Import the OpenAPI file
- VS Code: REST Client or Thunder Client extensions

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start development server with watch mode |
| `npm run build` | Compile TypeScript to dist/ |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run db:init` | Initialize MongoDB collections and indexes |
| `npm run prereqs` | Check system prerequisites |
| `npm run lint` | Lint source code |

## Project Structure

```
code-reader/
├── src/
│   ├── config/          # Configuration management
│   ├── db/              # MongoDB client and collections
│   ├── models/          # Data models and types
│   ├── services/        # Business logic (scanning, chunking, embedding)
│   ├── server/          # Express server and routes
│   ├── utils/           # Utility functions
│   └── index.ts         # Main entry point
├── scripts/
│   ├── db-init.ts       # Database initialization
│   └── check-prereqs.ts # Prerequisite checker
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── fixtures/        # Test data
├── config.json          # Configuration file
├── openapi.yaml         # OpenAPI 3.0 specification
└── API.md               # API documentation

```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/task` | Create task (requires `identifier`) |
| `GET` | `/task/:taskId` | Get task by UUID |
| `GET` | `/task/by-identifier/:identifier` | **Get task by identifier** |
| `POST` | `/process` | Start/resume with `fileLimit` |
| `POST` | `/process/stop` | **Stop processing gracefully** |
| `POST` | `/search_code` | Search by `identifier` or `taskId` |
| `GET` | `/openapi.yaml` | OpenAPI specification |

**Key Changes:**
- All endpoints now support `identifier` (AI-agent friendly!)
- `fileLimit` parameter controls token budget
- New stop endpoint for graceful interruption

See [API.md](API.md) and [USAGE-GUIDE.md](USAGE-GUIDE.md) for detailed documentation.

## Architecture

### Processing Flow

1. **Task Creation**: User creates a task with repository path
2. **File Scanning**: System scans repository for matching files
3. **Batch Processing**: Files divided into configurable batches
4. **Content Extraction**: Read file contents, detect language, compute hash
5. **Chunking**: Split content into token-sized chunks with overlap
6. **Embedding**: Generate embeddings using OpenAI API
7. **Storage**: Persist all data to MongoDB with batch atomicity
8. **Resume**: Can resume from last completed batch on interruption

### Key Features

- **Atomic Batches**: Each batch is processed atomically with rollback on failure
- **Progress Tracking**: Real-time progress updates via task status endpoint
- **Version Management**: Automatic versioning per repository (keeps last 3)
- **Error Handling**: Comprehensive error handling with retry logic
- **Rate Limiting**: Exponential backoff for OpenAI API rate limits

## Technology Stack

- **Runtime**: Node.js 18+, TypeScript 5.x
- **Server**: Express 5.x
- **Database**: MongoDB 6.0+
- **Embeddings**: OpenAI API (text-embedding-3-small)
- **Testing**: Jest with ts-jest
- **Validation**: Zod
- **Logging**: Winston

## Development

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm test -- --watch
```

### Building

```bash
# Compile TypeScript
npm run build

# Output in dist/ directory
```

### Linting

```bash
npm run lint
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required) | - |
| `OPENAI_BASE_URL` | Custom OpenAI endpoint (optional) | - |
| `MONGODB_URI` | MongoDB connection URI | mongodb://localhost:27017 |
| `CODE_READER_PORT` | Server port | 3100 |
| `LOG_LEVEL` | Logging level | info |

**OPENAI_BASE_URL Examples:**
- Azure OpenAI: `https://your-resource.openai.azure.com`
- Proxy: `https://your-proxy.com/v1`
- Custom endpoint: `https://api.your-service.com/v1`

### File Extensions

Default supported extensions:
- JavaScript/TypeScript: `.js`, `.ts`, `.jsx`, `.tsx`
- Python: `.py`
- Go: `.go`
- Rust: `.rs`
- Java: `.java`
- C/C++: `.c`, `.cpp`, `.h`, `.hpp`
- Markdown: `.md`
- Config: `.json`, `.yaml`, `.yml`

### Excluded Directories

Default excluded directories:
- `node_modules`
- `.git`
- `dist`
- `build`

## Troubleshooting

### Server won't start

```bash
# Check prerequisites
npm run prereqs

# Verify MongoDB is running
mongod --version

# Check if port is available
lsof -i :3100  # Unix/Linux/Mac
netstat -ano | findstr :3100  # Windows
```

### Database connection failed

```bash
# Verify MongoDB is running
mongo --eval "db.adminCommand('ping')"

# Check MongoDB URI in config.json or .env
# Default: mongodb://localhost:27017

# Initialize database
npm run db:init
```

### Processing gets stuck

```bash
# Check task status
curl http://localhost:3100/task/{taskId}

# View logs
tail -f logs/combined.log

# Resume processing
curl -X POST http://localhost:3100/process \
  -H "Content-Type: application/json" \
  -d '{"taskId": "your-task-id"}'
```

### OpenAI API errors

- Verify `OPENAI_API_KEY` is set in `.env`
- Check OpenAI account rate limits
- Review logs for specific error messages

## Performance

### Expected Performance

- **Processing Speed**: ~1000 files in <10 minutes (excluding OpenAI API time)
- **Search Performance**: <3 seconds for 100,000 chunks
- **Memory Usage**: <100MB per batch

### Optimization Tips

- Adjust `batchSize` based on available memory
- Use smaller `chunkSize` for faster processing
- Reduce `chunkOverlap` if context is less important
- Filter extensions to only necessary file types

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- GitHub Issues: [Create an issue](../../issues)
- Documentation: [API.md](API.md)
- OpenAPI Spec: [openapi.yaml](openapi.yaml)

---

**Built with TypeScript, Express, MongoDB, and OpenAI API**
