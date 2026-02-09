# Research: Reconstruction-Grade Documentation Generator

**Feature**: 003-reconstruction-docs
**Date**: 2026-02-07
**Purpose**: Resolve technical unknowns and establish implementation patterns

## Research Questions

This document resolves the NEEDS CLARIFICATION items identified in the Technical Context section of plan.md.

---

## 1. Task Prioritization Library

**Question**: Which library/approach should be used for weighted graph traversal and information gain calculation in task prioritization?

**Decision**: Implement custom prioritization heuristic without external graph library

**Rationale**:
- Prioritization requirements are domain-specific (foundational knowledge first, dependency awareness, information gain, cross-source reinforcement, chunk size control)
- External graph libraries (e.g., graphlib, ngraph.graph) add dependency weight for features we don't need (cycle detection, shortest path, etc.)
- Task dependencies form a simple DAG (directed acyclic graph) that can be represented with adjacency lists in plain TypeScript
- Information gain scoring is custom to documentation domain (not a standard library function)
- Performance not critical - prioritization happens once per plan creation, not per task execution

**Implementation Approach**:

```typescript
// Simplified priority score calculation
interface TaskPriority {
  taskId: string;
  score: number;
  isReady: boolean; // All dependencies satisfied
}

function calculatePriorityScore(task: DocumentationTask, context: PlanContext): number {
  let score = 0;

  // 1. Foundational knowledge first (+100 if establishes architecture/vocabulary)
  if (task.isFoundational) score += 100;

  // 2. Dependency awareness (+50 for each dependent task unlocked)
  score += task.dependentCount * 50;

  // 3. Information gain (+30 if combines multiple sources)
  if (task.sourcesRequired.length > 1) score += 30;

  // 4. Cross-source reinforcement (+20 if validates across CLAUDE.md + code + Confluence)
  if (task.sourcesRequired.includes('confluence') && task.sourcesRequired.length >= 2) score += 20;

  // 5. Chunk size control (penalty for tasks estimated >10 min execution)
  if (task.estimatedComplexity > 10) score -= task.estimatedComplexity;

  return score;
}

// Simple topological sort for dependency-aware execution order
function getNextReadyTask(tasks: DocumentationTask[]): DocumentationTask | null {
  const readyTasks = tasks
    .filter(t => t.status === 'pending' && allDependenciesComplete(t))
    .map(t => ({ task: t, score: calculatePriorityScore(t, context) }))
    .sort((a, b) => b.score - a.score); // Highest score first

  return readyTasks[0]?.task || null;
}
```

**Alternatives Considered**:
- **graphlib**: Industry-standard graph library, but overkill for simple DAG traversal. Adds 50KB to bundle.
- **ngraph.graph**: Lightweight, but still unnecessary for our needs.
- **Priority queue with Dijkstra**: Over-engineered - we don't need shortest path, just highest priority.

**Dependencies Added**: None (custom implementation)

---

## 2. Markdown Generation Library

**Question**: Which library should be used for structured markdown output formatting?

**Decision**: Use `remark` ecosystem (remark + remark-stringify + unified)

**Rationale**:
- Industry-standard markdown manipulation toolkit used by major documentation systems
- Produces consistent, well-formatted markdown with proper escaping
- Supports markdown AST (Abstract Syntax Tree) manipulation for programmatic generation
- Extensible with plugins if advanced formatting needed later (tables, frontmatter, etc.)
- Well-maintained, actively developed, TypeScript-first
- Lightweight compared to alternatives (markdown-it, showdown)

**Implementation Approach**:

```typescript
import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import { Root } from 'mdast';

// Build markdown AST programmatically
const documentationAST: Root = {
  type: 'root',
  children: [
    {
      type: 'heading',
      depth: 1,
      children: [{ type: 'text', value: 'Domain: User Authentication' }]
    },
    {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: 'Business Rules' }]
    },
    {
      type: 'list',
      ordered: false,
      children: [
        {
          type: 'listItem',
          children: [
            { type: 'paragraph', children: [{ type: 'text', value: 'Rule 1...' }] }
          ]
        }
      ]
    }
  ]
};

// Convert AST to markdown string
const markdown = unified()
  .use(remarkStringify, { bullet: '-', emphasis: '_', strong: '*' })
  .stringify(documentationAST);
```

**Alternatives Considered**:
- **markdown-it**: Parser-focused, less suited for generation. Heavier (30KB vs remark's 15KB).
- **showdown**: Older, less TypeScript support, more focused on conversion than generation.
- **Simple string concatenation**: Error-prone, no escaping, hard to maintain complex structures.
- **Template literals**: Works for simple cases, but becomes unmaintainable for nested structures (lists, tables, code blocks).

**Dependencies Added**:
- `unified@^11.0.0` (core markdown processing pipeline)
- `remark-stringify@^11.0.0` (AST → markdown serialization)
- `@types/mdast@^4.0.0` (TypeScript types for markdown AST)

---

## 3. Template Engine for Documentation Artifact Generation

**Question**: Which template engine should be used for documentation artifact generation with dynamic sections?

**Decision**: Use `handlebars` for template-based artifact generation

**Rationale**:
- Logic-less templates enforce separation between data (from synthesis) and presentation (artifact structure)
- Familiar syntax for anyone who has used Mustache/Handlebars
- Built-in helpers for iteration, conditionals, partials (reusable sections)
- Can pre-compile templates for performance
- Industry-standard, battle-tested in documentation generation (used by JSDoc, Docusaurus, etc.)
- Lightweight compared to full template engines like Pug or EJS

**Implementation Approach**:

```typescript
import Handlebars from 'handlebars';

// Template for documentation artifact
const domainTemplate = Handlebars.compile(`
# Domain: {{domainName}}

**Source**: {{sources}}
**Generated**: {{timestamp}}

## Business Rules

{{#each businessRules}}
- **{{this.name}}**: {{this.description}}
  - Rationale: {{this.rationale}}
{{/each}}

## Program Flows

{{#each programFlows}}
### {{this.name}}

{{this.description}}

**Steps**:
{{#each this.steps}}
{{@index}}. {{this}}
{{/each}}

{{/each}}

## Domain Models

{{#each models}}
### {{this.name}}

{{this.description}}

**Attributes**:
{{#each this.attributes}}
- \`{{this.name}}\`: {{this.type}} - {{this.description}}
{{/each}}

{{/each}}

## User Stories

{{#each userStories}}
### {{this.title}}

{{this.description}}

**Acceptance Criteria**:
{{#each this.acceptanceCriteria}}
- {{this}}
{{/each}}

{{/each}}

---

**Sources**:
{{#each citations}}
- {{this.source}}: {{this.reference}}
{{/each}}
`);

// Use template with synthesized data
const artifact = domainTemplate({
  domainName: 'User Authentication',
  sources: 'CLAUDE.md, code chunks (auth-service.ts), Confluence (AUTH-001)',
  timestamp: new Date().toISOString(),
  businessRules: [...],
  programFlows: [...],
  models: [...],
  userStories: [...],
  citations: [...]
});
```

**Alternatives Considered**:
- **Mustache**: Simpler than Handlebars, but lacks helpers (iteration, conditionals). Would require more pre-processing.
- **EJS**: More JavaScript-heavy, encourages logic in templates. Against our principle of separation.
- **Pug**: Significant indentation syntax, harder to maintain for markdown-like output.
- **Remark only**: Could build markdown AST directly, but becomes verbose for complex nested structures. Templates are more readable.

**Dependencies Added**:
- `handlebars@^4.7.0` (template engine)
- `@types/handlebars@^4.1.0` (TypeScript types)

**Template Location**: Templates stored in `src/templates/documentation/` directory as `.hbs` files, loaded at startup.

---

## 4. External Source Integration Patterns

**Research Area**: Best practices for integrating with external documentation sources (Confluence) via MCP client

**Decision**: Use MCP Tool Call pattern with client-side authentication delegation

**Rationale**:
- MCP (Model Context Protocol) defines standard patterns for tool calls to remote servers
- Authentication is handled entirely by MCP client (Claude Desktop, IDEs, mcp-remote)
- Server remains stateless, never stores credentials
- Follows OAuth delegation best practices (server only receives authenticated results, not tokens)
- Consistent with constitutional principle: "System MUST delegate all external source authentication to the client environment"

**Implementation Approach**:

```typescript
// Server-side: Request Confluence data via MCP tool call
interface ConfluenceToolCall {
  server: 'atlassian'; // Upstream MCP server name
  tool: 'searchConfluenceUsingCql' | 'getConfluencePage';
  args: {
    cloudId: string; // From external source configuration (not credentials)
    cql?: string;    // Confluence Query Language
    pageId?: string;
  };
}

// Documentation executor service
async function enrichWithConfluence(task: DocumentationTask): Promise<ConfluenceData> {
  // Check if Confluence is configured for this plan
  const config = await getExternalSourceConfig(task.planId, 'confluence');
  if (!config?.enabled) {
    return null; // Confluence not configured, skip enrichment
  }

  // Make MCP tool call (client handles authentication)
  const toolCall: ConfluenceToolCall = {
    server: 'atlassian',
    tool: 'searchConfluenceUsingCql',
    args: {
      cloudId: config.connectionParams.cloudId, // Stored, not credentials
      cql: `title ~ "${task.domain}" AND type = page` // Search for domain documentation
    }
  };

  try {
    const response = await mcpClient.callTool(toolCall);
    return parseConfluenceResponse(response);
  } catch (error) {
    // Authentication expired or Confluence unavailable
    logger.warn('Confluence enrichment failed', { task: task.id, error: error.message });
    return null; // Mark task as requiring manual review, but don't fail
  }
}
```

**Configuration Storage** (MongoDB):

```typescript
interface ExternalSourceConfig {
  _id: ObjectId;
  planId: string; // Link to documentation plan
  sourceType: 'confluence'; // Extensible to other sources
  enabled: boolean;
  connectionParams: {
    cloudId: string; // Confluence cloud instance ID (NOT credentials)
    // Additional non-credential params can be added
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Error Handling**:
- **Authentication expired**: Mark task as "blocked" (not "failed"), allow resume after client refreshes credentials
- **Confluence unavailable**: Log warning, continue without enrichment (graceful degradation)
- **Malformed response**: Log error, mark enrichment section as [NEEDS MANUAL REVIEW] in artifact

**Alternatives Considered**:
- **Direct OAuth implementation**: Violates constitutional requirement - server must not handle authentication
- **Store refresh tokens**: Security risk, violates local-only data principle
- **Prompt user for credentials per request**: Poor UX, defeats purpose of MCP delegation

**Dependencies Added**: None (uses existing @modelcontextprotocol/sdk)

---

## 5. CLAUDE.md Parsing Strategy

**Research Area**: Best approach for extracting architecture and domain information from CLAUDE.md files

**Decision**: Use existing code chunk search + lightweight markdown parsing

**Rationale**:
- CLAUDE.md is typically already embedded in code chunk index (if repository has been extracted)
- Can use existing /search_code endpoint to query CLAUDE.md content semantically
- For structured parsing (headings, sections), use lightweight markdown parser (remark-parse)
- Avoids file system access (constitutional requirement: must use existing code search)
- Consistent with existing architecture patterns

**Implementation Approach**:

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';

async function analyzeCLAUDEmd(repositoryIdentifier: string): Promise<ArchitectureContext> {
  // Option 1: Search for CLAUDE.md in existing code chunks
  const claudeChunks = await searchService.searchCode({
    identifier: repositoryIdentifier,
    query: 'CLAUDE.md architecture system design',
    limit: 10
  });

  if (claudeChunks.length === 0) {
    // CLAUDE.md not found in code chunks - proceed without it
    logger.warn('CLAUDE.md not found in repository', { repository: repositoryIdentifier });
    return { hasClaudeFile: false, architecture: null, boundedContexts: [], systemIntent: null };
  }

  // Option 2: If CLAUDE.md is chunked, reconstruct full content
  const fullContent = claudeChunks
    .sort((a, b) => a.startLine - b.startLine)
    .map(chunk => chunk.content)
    .join('\n');

  // Parse markdown structure
  const ast = unified().use(remarkParse).parse(fullContent);

  // Extract architecture sections
  const sections = {
    architecture: null as string | null,
    boundedContexts: [] as string[],
    systemIntent: null as string | null
  };

  visit(ast, 'heading', (node, index, parent) => {
    const headingText = node.children[0]?.value?.toLowerCase();

    if (headingText?.includes('architecture')) {
      // Capture content until next heading
      sections.architecture = extractSectionContent(parent, index);
    } else if (headingText?.includes('bounded context') || headingText?.includes('domain')) {
      sections.boundedContexts.push(extractSectionContent(parent, index));
    } else if (headingText?.includes('purpose') || headingText?.includes('intent')) {
      sections.systemIntent = extractSectionContent(parent, index));
    }
  });

  return {
    hasClaudeFile: true,
    ...sections
  };
}
```

**Fallback Strategy**:
- If CLAUDE.md not found: Proceed with code-only analysis (mark as [MISSING CLAUDE.MD] in plan)
- If CLAUDE.md malformed: Log warning, extract what's parseable, continue
- If CLAUDE.md contradicts code: Prioritize CLAUDE.md, note discrepancy with [CODE DISCREPANCY] marker

**Alternatives Considered**:
- **Direct file system read**: Violates constitutional requirement (must use code search, not raw files)
- **Require CLAUDE.md always present**: Too restrictive, feature should work without it
- **Complex NLP parsing**: Overkill, markdown structure parsing is sufficient

**Dependencies Added**:
- `remark-parse@^11.0.0` (markdown parsing)
- `unist-util-visit@^5.0.0` (AST traversal utilities)

---

## Summary of Research Decisions

| Research Area | Decision | Dependencies Added |
|---------------|----------|-------------------|
| Task Prioritization | Custom heuristic (no library) | None |
| Markdown Generation | remark ecosystem | unified, remark-stringify, @types/mdast |
| Template Engine | Handlebars | handlebars, @types/handlebars |
| External Source Integration | MCP Tool Call with client auth delegation | None (existing MCP SDK) |
| CLAUDE.md Parsing | Code chunk search + remark-parse | remark-parse, unist-util-visit |

**Total New Dependencies**: 6 packages (all lightweight, well-maintained, TypeScript-first)

**Bundle Size Impact**: ~80KB (acceptable for server-side application)

---

## Next Steps

All NEEDS CLARIFICATION items resolved. Proceed to Phase 1:
1. Generate data-model.md with entities based on research decisions
2. Generate API contracts in contracts/ directory
3. Generate quickstart.md with end-to-end usage examples
4. Update agent context with new dependencies

---

**Research Complete**: 2026-02-07
