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
  codeChunks: string[];
  claudeContext?: string;
  analysisType: 'architecture' | 'domain' | 'comprehensive';
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
  const { domain, codeChunks, claudeContext } = request;

  const systemArchitecturePrompt = `You are a technical documentation expert specializing in reconstruction-grade documentation.

Your task: Analyze the "${domain}" domain in this codebase and produce detailed, insightful documentation suitable for system reconstruction (v2 rebuild).

${claudeContext ? `CONTEXT FROM CLAUDE.MD:\n${claudeContext}\n\n` : ''}

CODE TO ANALYZE (${codeChunks.length} relevant code chunks):
${codeChunks.slice(0, 20).join('\n\n---\n\n')}

${codeChunks.length > 20 ? `\n(${codeChunks.length - 20} additional chunks omitted to stay within token limits)` : ''}

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
- Be DETAILED and INSIGHTFUL, not generic
- Focus on WHY, not just WHAT
- Use technology-agnostic language (explain patterns, not frameworks)
- Make it useful for someone rebuilding the system from scratch
- Include enough detail that a new engineer can understand the domain without seeing code
- For each item, include codeReference as an ARRAY of file paths from the code chunks where you found evidence for this item

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
 * Pricing: gpt-4-turbo (as of 2024): $10/1M input tokens, $30/1M output tokens
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
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a technical documentation expert. Analyze code deeply and produce detailed, insightful documentation. Focus on business logic, conceptual flows, and architectural understanding. Avoid shallow descriptions. Return ONLY valid JSON without markdown code fences.',
        },
        {
          role: 'user',
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
    const costUSD = calculateCost(inputTokens, outputTokens, 'gpt-4-turbo');

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
          model: 'gpt-4-turbo',
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
        model: 'gpt-4-turbo',
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
        model: 'gpt-4-turbo',
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
 * Use GPT-4 to identify ALL domains/bounded contexts in the repository
 * This ensures COMPLETE coverage, not just random files from search results
 */
export async function identifyDomainsWithLLM(
  claudeContent: string,
  codeStructureSample: string[]
): Promise<DomainIdentificationResult> {
  logger.info('Using GPT-4 to identify all system domains', {
    claudeContentLength: claudeContent.length,
    codeSampleCount: codeStructureSample.length,
  });

  const prompt = `You are analyzing a codebase to identify ALL major bounded contexts/domains for comprehensive system documentation.

Your goal: Identify EVERY significant subsystem that needs documentation. Missing domains means incomplete documentation and failed V2 reconstruction.

CLAUDE.MD CONTENT (system overview):
${claudeContent || 'Not available - analyze code structure only'}

CODE STRUCTURE SAMPLE (representative files):
${codeStructureSample.join('\n\n---\n\n')}

ANALYSIS REQUIREMENTS:

1. Identify ALL major bounded contexts/domains including:
   - Core business domains (e.g., User Management, Order Processing)
   - Infrastructure layers (e.g., Database Layer, API Layer, Configuration)
   - Cross-cutting concerns (e.g., Authentication, Logging, Error Handling)
   - Data models and persistence
   - External integrations

2. For each domain:
   - Name: Clear, descriptive name
   - Description: What this domain/subsystem is responsible for
   - isFoundational: true if other domains depend on it (architecture, core models, config)
   - keyFiles: Representative file paths that belong to this domain
   - dependencies: Names of other domains this depends on

3. Think systematically:
   - What layers exist? (API, Business Logic, Data, Infrastructure)
   - What are the main features/capabilities?
   - What shared infrastructure exists?
   - Don't miss anything - comprehensive coverage is critical

Return ONLY valid JSON (no markdown):
{
  "domains": [
    {
      "name": "System Architecture",
      "description": "Overall system design, architecture patterns, core principles",
      "isFoundational": true,
      "keyFiles": ["src/index.ts", "src/config/", "CLAUDE.md"],
      "dependencies": []
    },
    {
      "name": "Task Management",
      "description": "Creation, versioning, and lifecycle management of extraction tasks",
      "isFoundational": true,
      "keyFiles": ["src/services/task.ts", "src/models/task.ts"],
      "dependencies": ["System Architecture"]
    },
    ... // CONTINUE until ALL domains are identified
  ]
}

CRITICAL: Include ALL subsystems. Missing domains = incomplete documentation = failed V2 reconstruction.`;

  try {
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a software architect analyzing a codebase. Identify ALL bounded contexts and domains comprehensively. Missing domains means failed system reconstruction. Be thorough.',
        },
        {
          role: 'user',
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
    const costUSD = calculateCost(inputTokens, outputTokens, 'gpt-4-turbo');

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
