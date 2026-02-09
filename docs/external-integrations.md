# Domain: External Integrations

**Sources**: claude_md, code_chunks
**Generated**: 2026-02-09T14:40:05.472Z

---

## Business Rules

### No Credential Storage for External Sources

The system must never store authentication credentials (such as passwords, API tokens, or refresh tokens) for external documentation sources like Confluence. All authentication is delegated to the client environment via the MCP protocol, and only non-sensitive connection parameters (e.g., cloudId) are persisted.

**Rationale**: This rule exists to enforce local data sovereignty and minimize security risk, ensuring that sensitive credentials are never persisted on the server and that the system remains stateless with respect to authentication.

**Sources**: code_chunks

---

### Authentication Delegation via MCP Protocol

All requests to external sources (e.g., Confluence) must be routed through the MCP client, which handles authentication and session management. The server only issues tool calls with non-credential parameters and expects authenticated results from the client.

**Rationale**: This ensures that the server remains agnostic to authentication mechanisms, reducing attack surface and complying with the constitutional requirement to delegate all external authentication.

**Sources**: code_chunks

---

### Graceful Degradation on External Source Failure

If an external source (such as Confluence) is unavailable, returns malformed data, or the client’s authentication is expired, the system must not fail the overall documentation workflow. Instead, it logs the issue, marks the affected artifact section as requiring manual review, and continues processing.

**Rationale**: This rule ensures high availability and resilience, so that external dependencies do not block core documentation generation, and users are informed of partial enrichment rather than experiencing total failure.

**Sources**: code_chunks

---

### External Source Configuration is Optional and Isolated

The documentation generation feature must function fully using only internal sources (CLAUDE.md, code chunks) if no external source is configured. External source enrichment is strictly optional and does not affect the core artifact lifecycle.

**Rationale**: This ensures that the system is robust, works in air-gapped/local-only modes, and that external integrations are additive rather than required.

**Sources**: code_chunks

---


## Program Flows

### External Source Configuration Workflow

This flow allows users to configure an external documentation source (such as Confluence) for a documentation plan. The configuration is stored without credentials and enables subsequent enrichment during documentation synthesis.

**Steps**:
1. User submits a configuration request specifying the plan, source type, and connection parameters (e.g., cloudId).
2. System validates that only non-credential parameters are present.
3. System persists the configuration with a unique configId, linking it to the plan.
4. Authentication delegation is set to MCP protocol, referencing the upstream server.
5. System returns a confirmation, indicating that authentication will be handled by the MCP client.

**Sources**: code_chunks

---

### External Source Enrichment During Documentation Synthesis

When generating documentation artifacts, the system checks for enabled external source configurations. If present, it issues a tool call via the MCP protocol to the client, which authenticates and retrieves external content (e.g., Confluence pages) for enrichment.

**Steps**:
1. Documentation executor loads the relevant documentation task and checks for an enabled external source config.
2. If configured, constructs a tool call (e.g., searchConfluenceUsingCql) with non-credential parameters.
3. MCP client handles authentication and executes the tool call against the external API.
4. Results are returned to the server, parsed, and incorporated into the documentation artifact.
5. If the call fails or returns malformed data, the system logs the issue and marks the artifact section as needing manual review, but continues processing.

**Sources**: code_chunks

---


## Domain Models

### ExternalSourceConfig

Represents a configuration for an external documentation source (e.g., Confluence) associated with a documentation plan. It contains only non-sensitive connection parameters and delegates authentication to the client.

**Attributes**:
- `configId`: UUID - Unique identifier for the configuration, enables referencing and updates
- `planId`: UUID - Links the configuration to a specific documentation plan
- `sourceType`: enum - Type of external source (e.g., &#x27;confluence&#x27;), allows future extensibility
- `enabled`: boolean - Indicates if this configuration is active for enrichment
- `connectionParams`: object - Non-credential parameters required to connect (e.g., cloudId)
- `authDelegation`: object - Details of the authentication delegation protocol (always MCP)
- `createdAt`: Date - Timestamp of configuration creation
- `updatedAt`: Date - Timestamp of last update

**Sources**: code_chunks

---


## Contracts & Interfaces

### External Source Configuration API

**Purpose**: Allows clients to configure, enable, or disable external documentation sources for a documentation plan, without transmitting or storing credentials.

**Inputs**:
- `planId (UUID identifying the documentation plan)` (string) - **required**
- `sourceType (e.g., &#x27;confluence&#x27;)` (string) - **required**
- `enabled (boolean to activate/deactivate)` (string) - **required**
- `connectionParams (object with non-credential fields such as cloudId)` (string) - **required**

**Outputs**:
- `ExternalSourceConfigResponse (includes configId, planId, sourceType, enabled, authDelegation details)` (string)

**Sources**: code_chunks

---

### MCP Tool Call Contract for External Source Access

**Purpose**: Defines how the server requests external documentation data via the MCP protocol, ensuring the client handles authentication and the server remains stateless.

**Inputs**:
- `server (e.g., &#x27;atlassian&#x27; for Confluence)` (string) - **required**
- `tool (e.g., &#x27;searchConfluenceUsingCql&#x27;, &#x27;getConfluencePage&#x27;)` (string) - **required**
- `args (parameters such as cloudId, cql, pageId)` (string) - **required**

**Outputs**:
- `Authenticated result from the external API (e.g., Confluence page content, search results)` (string)

**Sources**: code_chunks

---


## User Stories


## System Invariants

- No Credential Storage for External Sources: The system must never store authentication credentials (such as passwords, API tokens, or refresh tokens) for external documentation sources like Confluence. All authentication is delegated to the client environment via the MCP protocol, and only non-sensitive connection parameters (e.g., cloudId) are persisted.
- Authentication Delegation via MCP Protocol: All requests to external sources (e.g., Confluence) must be routed through the MCP client, which handles authentication and session management. The server only issues tool calls with non-credential parameters and expects authenticated results from the client.
- Graceful Degradation on External Source Failure: If an external source (such as Confluence) is unavailable, returns malformed data, or the client’s authentication is expired, the system must not fail the overall documentation workflow. Instead, it logs the issue, marks the affected artifact section as requiring manual review, and continues processing.
- External Source Configuration is Optional and Isolated: The documentation generation feature must function fully using only internal sources (CLAUDE.md, code chunks) if no external source is configured. External source enrichment is strictly optional and does not affect the core artifact lifecycle.
- The system enforces strict separation of business logic and infrastructure by isolating all external source access to a single service and never coupling authentication logic to the server. This minimizes security risk and simplifies compliance.
- All external integrations are implemented as optional enrichments, ensuring that the core documentation generation pipeline is robust and does not depend on external availability or configuration.
- Authentication delegation via the MCP protocol is a deliberate architectural choice to keep the server stateless and compliant with local-only data sovereignty requirements.
- The use of explicit orchestration and idempotent operations for external enrichment ensures that failures in external systems do not cascade or corrupt documentation artifacts.
- The domain model for external source configuration is designed for extensibility, allowing new source types to be added without breaking existing contracts or requiring schema changes.

---

## Source Citations

- **claude_md**: CLAUDE.md (analyzed via code chunks and LLM) (retrieved 2026-02-09T14:40:05.472Z)
- **code_chunks**: 50 code chunks analyzed by GPT-4 for External Integrations (retrieved 2026-02-09T14:40:05.472Z)
