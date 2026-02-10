# Analysis: Generic Documentation Issue

## Problem

Generated documentation for all domains is too similar and generic, not domain-specific.

## Root Causes

### Issue 1: **Code Chunks Not Included in LLM Prompt** 🔴 CRITICAL

**Location**: [src/services/llm-analyzer.ts:98-185](../src/services/llm-analyzer.ts#L98-L185)

**Problem**:
The prompt says "CODE TO ANALYZE (X relevant code chunks)" but then **never actually includes the code**!

```typescript
const systemArchitecturePrompt = `...
CODE TO ANALYZE (${codeChunks.length} relevant code chunks):

INSTRUCTIONS:  // ← Goes straight to instructions!
...
}`;

return systemArchitecturePrompt; // ← Returns without adding code chunks!
```

**Impact**: GPT-4 analyzes based on:
- ✅ CLAUDE.md context (generic for all domains)
- ✅ Domain name only (e.g., "Task Management")
- ❌ **NO ACTUAL CODE** (the chunks are gathered but never sent!)

**This explains why all documentation is generic** - GPT-4 is guessing based on domain names, not analyzing actual code!

---

### Issue 2: **Generic Chunk Selection Queries**

**Location**: [src/services/source-synthesizer.ts:125-132](../src/services/source-synthesizer.ts#L125-L132)

**Problem**:
All domains use the same generic query patterns:

```typescript
const queries = [
  `${domain} service implementation business logic`,  // Generic!
  `${domain} model entity data structure`,            // Generic!
  `${domain} workflow process flow`,                 // Generic!
  `${domain} command function implementation`,        // Generic!
  `${domain} validation rules constraints`,          // Generic!
  `${domain} API endpoint interface`,                // Generic!
];
```

**Issues**:
- Every domain gets chunks from "service", "model", "workflow", "validation", "API"
- Doesn't account for domain-specific patterns
- minScore: 0.6 is too low (allows loosely related chunks)
- limit: 10 per query = up to 60 chunks total (too much noise)

**Example Problem**:
- Domain: "Task Management" → finds task-related code ✅
- Domain: "User Management" → finds user-related code ✅
- Domain: "Email Notifications" → finds... task/user code? ❌ (semantic search returns nearest match)

---

### Issue 3: **Prompt Doesn't Emphasize Domain Specificity**

**Location**: [src/services/llm-analyzer.ts:92-135](../src/services/llm-analyzer.ts#L92-L135)

**Problem**:
The prompt says "Analyze the X domain" but doesn't:
- Emphasize extracting domain-SPECIFIC information only
- Warn against generic statements
- Request unique aspects of this domain vs others
- Ask for differentiators

**Current prompt**:
```
Your task: Analyze the "Task Management" domain...
[generic instructions]
```

**Missing**:
```
CRITICAL: Extract information SPECIFIC to "Task Management" only.
- AVOID generic statements that apply to all domains
- Focus on what makes THIS domain unique
- If something applies to multiple domains, DON'T include it here
- Be specific: "Tasks have priority 1-5" NOT "The system handles tasks"
```

---

## Proposed Fixes

### Fix 1: Include Code Chunks in Prompt ✅ HIGH PRIORITY

```typescript
function buildAnalysisPrompt(request: LLMAnalysisRequest): string {
  const { domain, codeChunks, claudeContext } = request;

  const prompt = `You are analyzing the "${domain}" domain.

CLAUDE.MD:
${claudeContext}

CODE CHUNKS FOR "${domain}":
${codeChunks.join('\n\n---\n\n')}  // ← ADD THIS!

INSTRUCTIONS:
[extract domain-specific information from the CODE above]
...
`;

  return prompt;
}
```

### Fix 2: Improve Chunk Selection Strategy

**Option A: Domain-Specific Queries**
```typescript
function buildDomainQueries(domain: string): string[] {
  // Base query - always include
  const baseQueries = [domain];

  // Add domain-specific patterns based on domain name
  if (domain.toLowerCase().includes('api') || domain.toLowerCase().includes('endpoint')) {
    return [
      ...baseQueries,
      `${domain} route handler controller`,
      `${domain} request response validation`,
      `${domain} endpoint definition`,
    ];
  }

  if (domain.toLowerCase().includes('database') || domain.toLowerCase().includes('data')) {
    return [
      ...baseQueries,
      `${domain} schema model collection`,
      `${domain} query repository`,
      `${domain} migration index`,
    ];
  }

  // Default for business domains
  return [
    domain, // Just the domain name - most specific
    `${domain} service`,
    `${domain} model`,
  ];
}
```

**Option B: Two-Phase Search (Recommended)**
```typescript
async function gatherDomainCode(repositoryIdentifier: string, domain: string) {
  const task = await taskService.getByIdentifier(repositoryIdentifier);

  // Phase 1: Get highly specific chunks (high threshold)
  const specificChunks = await searchService.search({
    query: domain, // Just the domain name
    taskId: task.taskId,
    limit: 30,
    minScore: 0.75, // Very specific matches only
  });

  // Phase 2: Get broader context if needed (lower threshold)
  if (specificChunks.length < 20) {
    const broaderChunks = await searchService.search({
      query: `${domain} implementation`,
      taskId: task.taskId,
      limit: 20,
      minScore: 0.6,
    });
    specificChunks.push(...broaderChunks);
  }

  return specificChunks.slice(0, 40); // Cap at 40 most relevant chunks
}
```

### Fix 3: Update LLM Prompt for Domain Specificity

```typescript
const prompt = `You are analyzing the "${domain}" domain.

CONTEXT FROM CLAUDE.MD:
${claudeContext}

CODE CHUNKS FOR "${domain}" DOMAIN:
${codeChunks.join('\n\n---\n\n')}

CRITICAL INSTRUCTIONS:

Extract information that is SPECIFIC to the "${domain}" domain ONLY:

❌ AVOID: Generic statements like "validates input", "handles errors", "stores in database"
✅ DO: Specific statements like "validates task priority is 1-5", "retries failed tasks 3 times"

❌ AVOID: Information that applies to multiple domains
✅ DO: Information unique to "${domain}"

For each item (business rule, flow, model, contract):
1. Is this SPECIFIC to "${domain}"? (If no, skip it)
2. What makes this UNIQUE to this domain?
3. What are the SPECIFIC constraints/rules/logic?

QUALITY CHECK:
- Would a developer be able to distinguish this domain from others by reading this doc?
- Does each item contain domain-specific details (numbers, names, constraints)?
- If you removed the domain name, would it still be clear which domain this describes?

[rest of prompt...]
`;
```

---

## Recommendations

**Immediate Priority**:
1. ✅ **Fix buildAnalysisPrompt** - Actually include code chunks (5 min fix)
2. ✅ **Increase minScore** - Change from 0.6 to 0.75 for more specific chunks
3. ✅ **Update prompt** - Add domain-specificity instructions

**Medium Priority**:
4. Implement two-phase search strategy
5. Add domain-specific query builders

**Low Priority**:
6. Add post-analysis deduplication (remove generic items across domains)

---

## Testing

After fixes, test with your repository:
```bash
# Generate docs for 2 domains
POST /documentation/execute (Task Management)
POST /documentation/execute (Email Notifications)

# Compare artifacts - they should be VERY different
GET /documentation/artifact/{task-mgmt-id}
GET /documentation/artifact/{email-notif-id}
```

**Success criteria**:
- ✅ Different business rules
- ✅ Different program flows
- ✅ Different models
- ✅ Domain-specific details (not generic)
- ✅ Unique constraints/numbers/names
