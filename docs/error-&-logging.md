# Domain: Error &amp; Logging

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:36:30.950Z

---

## Business Rules

### Centralized Error Handling with Structured Logging

All unhandled errors in HTTP request processing are captured by a centralized error handler. Errors are classified by HTTP status code: server errors (5xx) are logged as &#x27;error&#x27; level with stack traces, while client errors (4xx) are logged as &#x27;warn&#x27; level with error codes and request context. The handler always returns a JSON:API-compliant error response to the client.

**Rationale**: Centralizing error handling ensures consistent observability, simplifies troubleshooting, and enforces a standard error contract for all API consumers. Differentiating between client and server errors supports effective alerting and root cause analysis.

**Sources**: code_chunks

---

### JSON:API Error Response Format Enforcement

All error responses must conform to the JSON:API error object schema, including status, code, title, detail, and optional meta fields. This applies to both custom (AppError) and generic errors, with generic errors returning a sanitized message in production.

**Rationale**: A standardized error format enables reliable client-side error handling, automated UI feedback, and integration with external monitoring tools. It also prevents information leakage in production environments.

**Sources**: code_chunks

---

### Explicit Error Typing and Status Code Mapping

Domain-specific errors (e.g., NotFoundError, ValidationError, ProcessingError) inherit from a base AppError class, each carrying a semantic error code and HTTP status. Only recognized error types influence the status code; unknown errors default to 500.

**Rationale**: Explicit error typing allows for precise control over API behavior, facilitates internationalization, and ensures that clients can programmatically distinguish between error causes.

**Sources**: code_chunks

---

### Route Not Found Handling

Any request to an undefined route is intercepted and responded to with a 404 error, using a specific code (&#x27;ROUTE_NOT_FOUND&#x27;) and a descriptive message including the HTTP method and path.

**Rationale**: Explicitly handling unmatched routes prevents ambiguous client errors and aids in debugging incorrect API usage or misconfigured clients.

**Sources**: code_chunks

---

### Error Details Persistence for Failed Tasks

When a processing or documentation task fails, the error message is recorded in the task&#x27;s persistent state (e.g., the &#x27;error&#x27; field in MongoDB). This enables post-mortem analysis and supports workflow resumption.

**Rationale**: Persisting error details is critical for auditability, troubleshooting, and ensuring that failures do not result in silent data loss or untraceable states.

**Sources**: code_chunks

---


## Program Flows

### HTTP Request Error Handling Flow

Every incoming HTTP request passes through a middleware chain that ends with a centralized error handler. This handler inspects the error, determines its type, logs it with structured context, and returns a standardized error response to the client.

**Steps**:
1. An error is thrown or passed to next(error) during request processing.
2. The errorHandler middleware is invoked with the error and the request context.
3. The handler determines the HTTP status code using getStatusCode, based on error type.
4. A JSON:API error response is constructed using formatErrorResponse.
5. The error is logged at &#x27;error&#x27; or &#x27;warn&#x27; level with relevant metadata.
6. The client receives a structured error response with appropriate status.

**Sources**: code_chunks

---

### Task and Plan Failure Compensation Flow

When a batch processing or documentation generation task encounters an error, the system rolls back any partial data for the current batch, updates the task status to &#x27;failed&#x27;, and persists the error details for later inspection. The error is logged for observability.

**Steps**:
1. A processing error is caught during batch or task execution.
2. The system invokes compensation logic (e.g., rollbackBatch) to remove partial data.
3. The task&#x27;s status is updated to &#x27;failed&#x27;, and the error message is saved in the database.
4. A structured error log entry is emitted.
5. The error is rethrown or passed to the HTTP error handler for client notification.

**Sources**: code_chunks

---

### Validation Error Handling in API Endpoints

API endpoints validate incoming requests using schemas. If validation fails, a ValidationError is thrown, which is then handled by the centralized error handler, resulting in a 400 response with details about the invalid input.

**Steps**:
1. Incoming request is validated against a schema (e.g., using Zod).
2. On validation failure, a ValidationError is constructed with a descriptive message.
3. The error propagates to the errorHandler middleware.
4. A 400 error response is returned, including the specific validation issue.

**Sources**: code_chunks

---


## Domain Models

### AppError (and Domain Error Types)

AppError is the root error abstraction for all domain and infrastructure errors. It encodes the HTTP status, a semantic error code, and optional metadata. Subclasses represent specific error conditions (e.g., NotFoundError, ValidationError, ProcessingError).

**Attributes**:
- `statusCode`: integer - HTTP status for API response and logging
- `code`: string - Semantic error code for programmatic handling
- `meta`: object - Optional context for debugging or client display

**Sources**: code_chunks

---

### JsonApiError / JsonApiErrorResponse

Represents the standardized error payload returned to API clients. Encapsulates one or more error objects, each with status, code, title, detail, and optional meta.

**Attributes**:
- `status`: string - HTTP status code as string
- `code`: string - Machine-readable error code
- `title`: string - Short, human-readable summary
- `detail`: string - Detailed explanation of the error
- `meta`: object - Additional context for debugging

**Sources**: code_chunks

---


## Contracts & Interfaces

### Error Response Contract (JSON:API)

**Purpose**: Defines the structure and semantics of all error responses returned by the API.

**Inputs**:
- `Any error encountered during request processing (domain, validation, infrastructure, or unexpected).` (string) - **required**

**Outputs**:
- `A JSON object with an &#x27;errors&#x27; array, each entry containing status, code, title, detail, and optional meta.` (string)

**Sources**: code_chunks

---

### Logging Interface

**Purpose**: Provides structured, leveled logging for all error and warning events, including request context and stack traces for server errors.

**Inputs**:
- `Error objects, request metadata (path, method), and custom log messages.` (string) - **required**

**Outputs**:
- `Structured log entries written to persistent log files or external aggregators.` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- Centralized Error Handling with Structured Logging: All unhandled errors in HTTP request processing are captured by a centralized error handler. Errors are classified by HTTP status code: server errors (5xx) are logged as &#x27;error&#x27; level with stack traces, while client errors (4xx) are logged as &#x27;warn&#x27; level with error codes and request context. The handler always returns a JSON:API-compliant error response to the client.
- JSON:API Error Response Format Enforcement: All error responses must conform to the JSON:API error object schema, including status, code, title, detail, and optional meta fields. This applies to both custom (AppError) and generic errors, with generic errors returning a sanitized message in production.
- Explicit Error Typing and Status Code Mapping: Domain-specific errors (e.g., NotFoundError, ValidationError, ProcessingError) inherit from a base AppError class, each carrying a semantic error code and HTTP status. Only recognized error types influence the status code; unknown errors default to 500.
- Route Not Found Handling: Any request to an undefined route is intercepted and responded to with a 404 error, using a specific code (&#x27;ROUTE_NOT_FOUND&#x27;) and a descriptive message including the HTTP method and path.
- Error Details Persistence for Failed Tasks: When a processing or documentation task fails, the error message is recorded in the task&#x27;s persistent state (e.g., the &#x27;error&#x27; field in MongoDB). This enables post-mortem analysis and supports workflow resumption.
- The error and logging subsystem is architected for strict separation of concerns: error construction, logging, and response formatting are decoupled. This enables independent evolution of error semantics, log destinations, and API contracts.
- All error handling is centralized in middleware, ensuring that no error can escape unobserved or unformatted. This is critical for compliance, auditability, and operational reliability.
- Domain errors are explicitly typed and versioned, supporting forward-compatible extension and deprecation of error codes.
- The system enforces local data sovereignty: error details are persisted only in local storage, never sent to external systems except via logs, in compliance with constitutional requirements.
- The design anticipates future extension (e.g., new error types, additional log sinks) without breaking existing API contracts or requiring changes to business logic.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:36:30.950Z)
- **code_chunks**: 48 code chunks analyzed by GPT-4 for Error &amp; Logging (retrieved 2026-02-09T14:36:30.950Z)
