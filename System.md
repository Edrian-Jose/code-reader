You are an expert AI engineer. Your task is to **generate Speckit prompts** that will define and orchestrate a local MCP system to extract and embed a codebase, track progress, and expose an API for Speckit to request new code versions.

Do **not** implement the code yourself. Instead, create **prompts for Speckit** that will later generate the necessary scripts and MCP server functionality.

Requirements:

1. **Prompt for `/constitution`**
   - Define the **rules and structure** for the MCP system.
   - Include:
     - How batch code extraction should work
     - How progress tracking should be persisted in MongoDB
     - The MCP server responsibilities
     - API endpoints for Speckit
   - Specify constraints:
     - Code extraction in batches
     - Resume capability
     - Local-only execution (except OpenAI API calls)
     - Task and output versioning
   - All user stories must be modular and incremental
   - start simple

2. **Prompt for `/specify`**
   - Define **detailed specifications** for each component:
     - Setup scripts (installing dependencies, initializing MongoDB)
     - Code extraction and chunking logic
     - Embeddings generation
     - Progress tracking schema in MongoDB
     - MCP server endpoints (`/task`, `/process`, `/task/{id}`, `/search_code`)
   - Include:
     - Input/output formats
     - Required fields in MongoDB collections
     - Configurable parameters (batch size, API keys, server settings)

3. **Prompt for `/plan`**
   - Generate a **step-by-step plan** to implement the MCP system using Speckit:
     - Order of tasks (setup, code extraction, embedding, MCP server, API endpoints)
     - How to handle long-running tasks
