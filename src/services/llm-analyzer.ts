/**
 * LLM Analyzer Service
 * Uses GPT-4 to analyze code and generate meaningful documentation
 * This is the CORRECT approach - AI-powered understanding, not keyword matching
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export interface LLMAnalysisRequest {
 domain: string;
 domainDescription?: string;
 isFoundational?: boolean;
 dependencies?: string[];
 codeChunks: string[];
 claudeContext?: string;
 analysisType: "architecture" | "domain" | "comprehensive";
}

export interface LLMDocumentationResult {
  domain: string;
  businessRules: Array<{
    name: string;
    description: string;
    rationale: string;
    codeReference: string[];
  }>;
  programFlows: Array<{
    name: string;
    description: string;
    steps: string[];
    codeReference: string[];
  }>;
  domainModels: Array<{
    name: string;
    description: string;
    attributes: Array<{ name: string; type: string; purpose: string }>;
    lifecycleRules: string[];
    codeReference: string[];
  }>;
  contracts: Array<{
    name: string;
    purpose: string;
    inputs: string[];
    outputs: string[];
    guarantees: string[];
    codeReference: string[];
  }>;
  architecturalInsights: string[];
  designPatterns: string[];
}

export interface CostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
  model: string;
}

export interface LLMAnalysisResult {
  documentation: LLMDocumentationResult;
  actualCost: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUSD: number;
    model: string;
  };
}

/**
 * Build comprehensive analysis prompt for GPT-4
 */
function buildAnalysisPrompt(request: LLMAnalysisRequest): string {
  const {
   domain,
   domainDescription,
   isFoundational,
   dependencies,
   codeChunks,
   claudeContext,
  } = request;

  // Build domain context section
  let domainContextSection = `Your task: Analyze the "${domain}" domain in this codebase and produce detailed, insightful documentation suitable for system reconstruction (v2 rebuild).`;

  if (domainDescription) {
    domainContextSection += `\n\nDOMAIN DESCRIPTION: ${domainDescription}`;
  }

  if (isFoundational) {
    domainContextSection += `\n\nNOTE: This is a FOUNDATIONAL domain - other domains depend on it.`;
  }

  if (dependencies && dependencies.length > 0) {
    domainContextSection += `\n\nDEPENDENCIES: This domain depends on: ${dependencies.join(', ')}`;
  }

  const systemArchitecturePrompt = `You are a technical documentation expert specializing in reconstruction-grade documentation.

${domainContextSection}

${claudeContext ? `CONTEXT FROM CLAUDE.MD:\n${claudeContext.slice(0, 4000)}\n\n` : ""}

CODE TO ANALYZE FOR "${domain}" DOMAIN (${codeChunks.length} relevant code chunks):

${codeChunks.slice(0, 40).join('\n\n---NEXT CHUNK---\n\n')}

---

INSTRUCTIONS:

1. BUSINESS RULES:
   - Identify ACTUAL business rules enforced in the code (not just "validation found in file X")
   - For each rule, explain: WHAT it is, WHY it exists (business rationale), WHAT breaks if violated
   - Reference specific code locations (file paths, function names)

2. PROGRAM FLOWS:
   - Identify key workflows/processes
   - Explain the CONCEPTUAL flow (not line-by-line code walkthrough)
   - Describe each step in business terms
   - Note error handling and compensation logic

3. DOMAIN MODELS:
   - Identify core entities and value objects
   - Explain what each represents in business terms
   - Document relationships and lifecycle rules
   - Note state transitions and invariants

4. CONTRACTS & INTERFACES:
   - Identify public APIs, event contracts, integration points
   - Document inputs, outputs, guarantees
   - Explain stability and evolution rules

5. ARCHITECTURAL INSIGHTS:
   - Identify design patterns used
   - Explain architectural decisions and trade-offs
   - Note constraints and rationale

CRITICAL REQUIREMENTS:

⚠️ DOMAIN SPECIFICITY - MOST IMPORTANT:
- Extract information SPECIFIC to "${domain}" ONLY - not general patterns
- AVOID generic statements like "validates input", "handles errors", "stores data"
- DO include specific details: exact validation rules, specific error codes, concrete data constraints
- Each domain doc should be UNIQUE - if you removed the domain name, it should still be obvious which domain this is
- Ask yourself: "Could this apply to ANY domain?" → If yes, DON'T include it or make it more specific

QUALITY REQUIREMENTS:
- Be DETAILED and INSIGHTFUL with domain-specific details (numbers, names, exact constraints)
- Focus on WHY things exist in THIS domain specifically, not just WHAT
- Use technology-agnostic language (explain patterns, not frameworks)
- Include enough detail that a new engineer can understand THIS SPECIFIC domain without seeing code
- For each item, include codeReference as an ARRAY of file paths from the code chunks where you found evidence

Return ONLY a valid JSON object (no markdown code fences) matching this structure:
{
  "domain": "${domain}",
  "businessRules": [
    {
      "name": "Descriptive rule name",
      "description": "What the rule enforces in detail (2-3 sentences minimum)",
      "rationale": "Why this rule exists - the business need (1-2 sentences)",
      "codeReference": ["path/to/file1.ts", "path/to/file2.ts"]
    }
  ],
  "programFlows": [
    {
      "name": "Workflow name",
      "description": "What this flow accomplishes (2-3 sentences)",
      "steps": ["Detailed step 1", "Detailed step 2", "..."],
      "codeReference": ["path/to/orchestrator.ts", "path/to/handler.ts"]
    }
  ],
  "domainModels": [
    {
      "name": "Entity name",
      "description": "What this entity represents in business terms",
      "attributes": [
        {"name": "attr", "type": "business type", "purpose": "why it exists"}
      ],
      "lifecycleRules": ["Creation rule", "State transition rule", "Deletion rule"],
      "codeReference": ["path/to/model.ts", "path/to/schema.ts"]
    }
  ],
  "contracts": [
    {
      "name": "API/Interface name",
      "purpose": "What this contract enables",
      "inputs": ["Input with business meaning"],
      "outputs": ["Output with business meaning"],
      "guarantees": ["What this contract promises"],
      "codeReference": ["path/to/api.ts", "path/to/interface.ts"]
    }
  ],
  "architecturalInsights": [
    "Detailed insight about design decisions, patterns, trade-offs"
  ],
  "designPatterns": [
    "Pattern name and how/why it's applied in this domain"
  ]
}`;

  return systemArchitecturePrompt;
}

/**
 * Calculate cost for GPT-4 API usage
 * Pricing: gpt-4 (as of 2024): $10/1M input tokens, $30/1M output tokens
 */
function calculateCost(inputTokens: number, outputTokens: number, _model: string): number {
  // GPT-4 Turbo pricing
  const INPUT_COST_PER_1M = 10.0; // $10 per 1M tokens
  const OUTPUT_COST_PER_1M = 30.0; // $30 per 1M tokens

  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

  return inputCost + outputCost;
}

/**
 * Analyze code using GPT-4 and generate comprehensive documentation
 * This is the CORRECT approach that produces meaningful, insightful documentation
 * Returns documentation + actual cost information
 */
export async function analyzeWithLLM(request: LLMAnalysisRequest): Promise<LLMAnalysisResult> {
  logger.info('Starting LLM analysis', {
    domain: request.domain,
    codeChunkCount: request.codeChunks.length,
    analysisType: request.analysisType,
  });

  const prompt = buildAnalysisPrompt(request);

  try {
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
     model: "gpt-4",
     messages: [
      {
       role: "system",
       content:
        "You are a technical documentation expert. Analyze code deeply and produce detailed, insightful documentation. Focus on business logic, conceptual flows, and architectural understanding. Avoid shallow descriptions. Return ONLY valid JSON without markdown code fences.",
      },
      {
       role: "user",
       content: prompt,
      },
     ],
     temperature: 0.3, // Low temperature for consistency
    });

    const analysisTime = Date.now() - startTime;

    // Calculate actual cost
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;
    const costUSD = calculateCost(inputTokens, outputTokens, "gpt-4");

    logger.info('LLM analysis complete', {
      domain: request.domain,
      analysisTime: `${analysisTime}ms`,
      inputTokens,
      outputTokens,
      totalTokens,
      costUSD: `$${costUSD.toFixed(4)}`,
    });

    // Parse response, handling markdown code fences if present
    let responseContent = completion.choices[0].message.content || '{}';

    // Strip markdown code fences if GPT-4 included them despite instructions
    responseContent = responseContent.replace(/^```json\s*/m, '').replace(/\s*```$/m, '');

    const result = JSON.parse(responseContent);

    // Validate result has expected structure
    if (!result.domain || !Array.isArray(result.businessRules)) {
      logger.warn('LLM response missing expected fields, using defaults', { domain: request.domain });

      const emptyDoc: LLMDocumentationResult = {
        domain: request.domain,
        businessRules: result.businessRules || [],
        programFlows: result.programFlows || [],
        domainModels: result.domainModels || [],
        contracts: result.contracts || [],
        architecturalInsights: result.architecturalInsights || [],
        designPatterns: result.designPatterns || [],
      };

      return {
       documentation: emptyDoc,
       actualCost: {
        inputTokens,
        outputTokens,
        totalTokens,
        costUSD,
        model: "gpt-4",
       },
      };
    }

    logger.info('LLM analysis successful', {
      domain: request.domain,
      businessRulesCount: result.businessRules?.length || 0,
      flowsCount: result.programFlows?.length || 0,
      modelsCount: result.domainModels?.length || 0,
    });

    return {
     documentation: result as LLMDocumentationResult,
     actualCost: {
      inputTokens,
      outputTokens,
      totalTokens,
      costUSD,
      model: "gpt-4",
     },
    };
  } catch (error: any) {
    logger.error('LLM analysis failed', {
      error: error.message,
      domain: request.domain,
      codeChunkCount: request.codeChunks.length,
    });

    // Return empty documentation rather than failing completely
    logger.warn('Returning empty documentation due to LLM failure');

    const emptyDoc: LLMDocumentationResult = {
      domain: request.domain,
      businessRules: [],
      programFlows: [],
      domainModels: [],
      contracts: [],
      architecturalInsights: [`LLM analysis failed: ${error.message}`],
      designPatterns: [],
    };

    return {
     documentation: emptyDoc,
     actualCost: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUSD: 0,
      model: "gpt-4",
     },
    };
  }
}

/**
 * Estimate token usage for a request (for budget tracking)
 */
export function estimateTokens(request: LLMAnalysisRequest): number {
  const promptLength = buildAnalysisPrompt(request).length;
  // Rough estimate: 1 token ≈ 4 characters
  const inputTokens = Math.ceil(promptLength / 4);
  const expectedOutputTokens = 2000; // Typical response size
  return inputTokens + expectedOutputTokens;
}

/**
 * Domain identification result from LLM analysis
 */
export interface DomainIdentificationResult {
  domains: Array<{
    name: string;
    description: string;
    isFoundational: boolean;
    keyFiles: string[];
    dependencies: string[];
  }>;
  cost: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUSD: number;
  };
}

/**
 * Use GPT-4 to identify ALL domains/bounded contexts from CLAUDE.md
 * SIMPLIFIED: Just pass CLAUDE.md to GPT-4, no code sampling needed
 */
export async function identifyDomainsWithLLM(
  claudeContent: string
): Promise<DomainIdentificationResult> {
  logger.info('Using GPT-4 to identify all system domains from CLAUDE.md', {
    claudeContentLength: claudeContent.length,
  });

  const prompt = `You are analyzing a repository's CLAUDE.md file to identify ALL domains/bounded contexts that need documentation.

CLAUDE.md completely describes what the repository is about. Your job is to extract the architecture and all domains/subsystems mentioned or implied.

CLAUDE.MD CONTENT:
${claudeContent}

TASK:
Extract a comprehensive list of domains/bounded contexts from CLAUDE.md. This must include:

1. **System Architecture** - Always include this as the first foundational domain
2. **All business domains** mentioned (features, capabilities, use cases)
3. **All technical layers** mentioned (API, database, services, models, flows, data pipelines, etc.)
4. **All integrations** mentioned (external systems, APIs, third-party services)
5. **All cross-cutting concerns** mentioned (auth, logging, error handling, etc.)

For EACH domain provide:
- **name**: Clear domain name (e.g., "Task Management", "API Layer")
- **description**: What this domain/subsystem does (1-2 sentences from CLAUDE.md)
- **isFoundational**: true if it's infrastructure/architecture that other domains depend on
- **dependencies**: Names of other domains this depends on (infer from CLAUDE.md)

Return ONLY valid JSON (no markdown formatting):
{
  "domains": [
    {
      "name": "System Architecture",
      "description": "Overall system design and architecture (from CLAUDE.md)",
      "isFoundational": true,
      "dependencies": []
    },
    {
      "name": "Domain Name",
      "description": "What it does (from CLAUDE.md)",
      "isFoundational": false,
      "dependencies": ["System Architecture"]
    }
  ]
}

**IMPORTANT**:
- System Architecture should ALWAYS be first and foundational
- Include ALL domains mentioned or implied in CLAUDE.md
- If CLAUDE.md mentions features, those are domains
- If CLAUDE.md mentions layers (API, DB), those are domains
- Be comprehensive - missing domains = incomplete documentation`;

  try {
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
     model: "gpt-4",
     messages: [
      {
       role: "system",
       content:
        "You are a software architect analyzing a codebase. Identify ALL bounded contexts and domains comprehensively. Missing domains means failed system reconstruction. Be thorough.",
      },
      {
       role: "user",
       content: prompt,
      },
     ],
     temperature: 0.2, // Very low for consistent structural analysis
    });

    const analysisTime = Date.now() - startTime;

    // Calculate cost
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;
    const costUSD = calculateCost(inputTokens, outputTokens, "gpt-4");

    logger.info('Domain identification complete', {
      analysisTime: `${analysisTime}ms`,
      inputTokens,
      outputTokens,
      totalTokens,
      costUSD: `$${costUSD.toFixed(4)}`,
    });

    // Parse response
    let responseContent = completion.choices[0].message.content || '{ "domains": [] }';
    responseContent = responseContent.replace(/^```json\s*/m, '').replace(/\s*```$/m, '');

    const result = JSON.parse(responseContent);

    if (!result.domains || !Array.isArray(result.domains)) {
      logger.error('LLM domain identification returned invalid structure');
      return {
        domains: [
          {
            name: 'System Architecture',
            description: 'Fallback domain due to LLM parsing error',
            isFoundational: true,
            keyFiles: [],
            dependencies: [],
          },
        ],
        cost: { inputTokens, outputTokens, totalTokens, costUSD },
      };
    }

    logger.info('Domains identified by GPT-4', {
      domainCount: result.domains.length,
      domains: result.domains.map((d: any) => d.name),
    });

    return {
      domains: result.domains,
      cost: { inputTokens, outputTokens, totalTokens, costUSD },
    };
  } catch (error: any) {
    logger.error('Domain identification with LLM failed', { error: error.message });

    // Return minimal fallback
    return {
      domains: [
        {
          name: 'System Architecture',
          description: 'Fallback - LLM analysis failed',
          isFoundational: true,
          keyFiles: [],
          dependencies: [],
        },
      ],
      cost: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUSD: 0 },
    };
  }
}
