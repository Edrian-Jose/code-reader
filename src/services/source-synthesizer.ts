/**
 * Source Synthesizer Service
 * Combines information from CLAUDE.md, code chunks, and external sources (Confluence)
 * to produce comprehensive documentation using GPT-4 analysis
 *
 * CRITICAL: Calls LLM analysis ONCE per domain to get all documentation types
 * (business rules, flows, models, contracts) in a single API call
 */

import { parseMarkdown, extractSectionContent } from '../utils/markdown-formatter.js';
import type { SourceType } from '../models/documentation-task.js';
import type { BusinessRule, ProgramFlow, DomainModel, Contract, UserStory, Citation } from '../models/documentation-artifact.js';
import { logger } from '../utils/logger.js';
import { searchService } from './search.js';
import { taskService } from './task.js';
import { analyzeWithLLM } from './llm-analyzer.js';

export interface ArchitectureContext {
  hasClaudeFile: boolean;
  architecture: string | null;
  boundedContexts: string[];
  systemIntent: string | null;
}

export interface SynthesizedDocumentation {
  businessRules: BusinessRule[];
  programFlows: ProgramFlow[];
  domainModels: DomainModel[];
  contracts: Contract[];
  userStories: UserStory[];
  invariants: string[];
  citations: Citation[];
  llmCost?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUSD: number;
  };
}

/**
 * T018, T034: Analyze CLAUDE.md using code chunk search
 * Parses markdown structure to extract architecture sections
 */
export async function analyzeCLAUDEmd(repositoryIdentifier: string): Promise<ArchitectureContext> {
  logger.info('Analyzing CLAUDE.md for repository', { repositoryIdentifier });

  try {
    // Get extraction task for this repository
    const task = await taskService.getByIdentifier(repositoryIdentifier);
    if (!task) {
      logger.warn('Code extraction task not found', { repositoryIdentifier });
      return {
        hasClaudeFile: false,
        architecture: null,
        boundedContexts: [],
        systemIntent: null,
      };
    }

    // Search for CLAUDE.md in code chunks
    const claudeChunks = await searchService.search({
      query: 'CLAUDE.md project architecture system',
      taskId: task.taskId,
      limit: 10,
      minScore: 0.5,
    });

    if (claudeChunks.length === 0) {
      logger.info('CLAUDE.md not found in repository', { repositoryIdentifier });
      return {
        hasClaudeFile: false,
        architecture: null,
        boundedContexts: [],
        systemIntent: null,
      };
    }

    // Reconstruct full content from chunks
    const sortedChunks = claudeChunks.sort((a, b) => a.startLine - b.startLine);
    const fullContent = sortedChunks.map((chunk) => chunk.content).join('\n');

    // Parse markdown structure
    const ast = parseMarkdown(fullContent);

    // Extract architecture sections
    const architecture = extractSectionContent(ast, 'architecture') || extractSectionContent(ast, 'technical context');

    const boundedContextsContent = extractSectionContent(ast, 'bounded context') || extractSectionContent(ast, 'domain');
    const boundedContexts = boundedContextsContent
      ? boundedContextsContent
          .split('\n')
          .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('*'))
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter((line) => line.length > 0)
      : [];

    const systemIntent = extractSectionContent(ast, 'purpose') || extractSectionContent(ast, 'overview');

    logger.info('CLAUDE.md analysis complete', {
      hasArchitecture: !!architecture,
      boundedContextCount: boundedContexts.length,
      hasIntent: !!systemIntent,
    });

    return {
      hasClaudeFile: true,
      architecture,
      boundedContexts,
      systemIntent,
    };
  } catch (error) {
    logger.error('Error analyzing CLAUDE.md', { error, repositoryIdentifier });
    return {
      hasClaudeFile: false,
      architecture: null,
      boundedContexts: [],
      systemIntent: null,
    };
  }
}

/**
 * Synthesize user stories (primarily from external sources like Confluence)
 */
export async function synthesizeUserStories(
  domain: string,
  sourcesRequired: SourceType[],
  _repositoryIdentifier: string
): Promise<UserStory[]> {
  logger.info('Synthesizing user stories', { domain, sources: sourcesRequired });

  // User stories typically come from external documentation
  // For MVP, return empty - will be implemented when Confluence integration is added
  return [];
}

export interface DomainMetadata {
 description?: string;
 isFoundational?: boolean;
 dependencies?: string[];
}

/**
 * T034-T035: Synthesize complete documentation for a domain
 * Uses LLM analysis ONCE to get all documentation types
 * Orchestrates code chunk gathering, CLAUDE.md context, and LLM analysis
 */
export async function synthesizeDocumentation(
 domain: string,
 sourcesRequired: SourceType[],
 repositoryIdentifier: string,
 domainMetadata?: DomainMetadata,
): Promise<SynthesizedDocumentation> {
 logger.info("Starting documentation synthesis with LLM", {
  domain,
  repositoryIdentifier,
  domainMetadata,
 });

 const startTime = Date.now();
 const emptyCost = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  costUSD: 0,
 };

 // Get CLAUDE.md context if available
 let claudeContext: string | undefined;
 if (sourcesRequired.includes("claude_md")) {
  try {
   const architectureContext = await analyzeCLAUDEmd(repositoryIdentifier);
   if (architectureContext.hasClaudeFile) {
    claudeContext = [
     architectureContext.architecture,
     architectureContext.systemIntent,
     `Bounded Contexts: ${architectureContext.boundedContexts.join(", ")}`,
    ]
     .filter(Boolean)
     .join("\n\n");
   }
  } catch (error) {
   logger.warn("Failed to load CLAUDE.md context", { error, domain });
  }
 }

 // Initialize empty results
 let businessRules: BusinessRule[] = [];
 let programFlows: ProgramFlow[] = [];
 let domainModels: DomainModel[] = [];
 let contracts: Contract[] = [];
 const userStories: UserStory[] = []; // From external sources only
 let invariants: string[] = []; // Business rules + architectural insights + design patterns
 let citations: Citation[] = []; // File references from LLM analysis
 let llmCost = emptyCost;

 // Only run LLM analysis if code_chunks are required
 if (sourcesRequired.includes("code_chunks")) {
  try {
   const task = await taskService.getByIdentifier(repositoryIdentifier);

   if (task) {
    // Gather comprehensive code chunks for the domain using specialized queries
    // Each query targets a specific documentation section for better coverage
    const searchQueries = [
     {
      section: "Business Rules",
      query: `${domain} service implementation business logic`,
      limit: 10,
     },
     {
      section: "Program Flows",
      query: `${domain} model entity data structure`,
      limit: 10,
     },
     {
      section: "Domain Models",
      query: `${domain} model entity interface class type schema definition`,
      limit: 10,
     },
     {
      section: "Contracts",
      query: `${domain} API endpoint route handler contract interface service`,
      limit: 10,
     },
     {
      section: "Invariants",
      query: `${domain} architecture pattern design decision configuration deployment`,
      limit: 10,
     },
    ];

    // Execute all searches in parallel and combine results
    const allSearchResults = await Promise.all(
     searchQueries.map(async ({ section, query, limit }) => {
      logger.info("Executing specialized search", { domain, section, query });
      const results = await searchService.search({
       query,
       taskId: task.taskId,
       limit,
       minScore: 0.6,
      });
      return results;
     }),
    );

    // Flatten and deduplicate results by chunk ID
    const searchResults = Array.from(
     new Map(
      allSearchResults
       .flat()
       .map((result) => [
        `${result.filePath}:${result.startLine}:${result.endLine}`,
        result,
       ]),
     ).values(),
    );

    if (searchResults.length > 0) {
     logger.info("Gathered code chunks for LLM analysis", {
      domain,
      chunkCount: searchResults.length,
      queriesExecuted: searchQueries.length,
     });

     // Format code chunks with file context
     const codeChunks = searchResults.map(
      (result) =>
       `// File: ${result.filePath} (lines ${result.startLine}-${result.endLine})\n${result.content}`,
     );

     // Call LLM ONCE to analyze and extract ALL documentation types
     const llmResult = await analyzeWithLLM({
      domain,
      domainDescription: domainMetadata?.description,
      isFoundational: domainMetadata?.isFoundational,
      dependencies: domainMetadata?.dependencies,
      codeChunks,
      claudeContext,
      analysisType: "domain",
     });

     // Extract business rules with actual file sources from LLM
     businessRules = llmResult.documentation.businessRules.map((rule) => ({
      name: rule.name,
      description: rule.description,
      rationale: rule.rationale,
      sources: rule.codeReference, // Use actual file paths from LLM
     }));

     // Extract program flows with actual file sources from LLM
     programFlows = llmResult.documentation.programFlows.map((flow) => ({
      name: flow.name,
      description: flow.description,
      steps: flow.steps,
      sources: flow.codeReference, // Use actual file paths from LLM
     }));

     // Extract domain models with actual file sources from LLM
     domainModels = llmResult.documentation.domainModels.map((model) => ({
      name: model.name,
      description: model.description,
      attributes: model.attributes.map((attr) => ({
       name: attr.name,
       type: attr.type,
       description: attr.purpose,
      })),
      sources: model.codeReference, // Use actual file paths from LLM
     }));

     // Extract contracts with actual file sources from LLM
     contracts = llmResult.documentation.contracts.map((contract) => ({
      name: contract.name,
      purpose: contract.purpose,
      inputs: contract.inputs.map((input) => ({
       name: typeof input === "string" ? input : input,
       type: "object", // LLM provides business-level inputs
       required: true,
      })),
      outputs: contract.outputs.map((output) => ({
       name: typeof output === "string" ? output : output,
       type: "object",
      })),
      sources: contract.codeReference, // Use actual file paths from LLM
     }));

     // Combine architectural insights and design patterns into invariants
     // These represent system-level constraints and patterns
     const architecturalInvariants = [
      ...llmResult.documentation.architecturalInsights,
      ...llmResult.documentation.designPatterns,
     ];

     // Merge with business rule invariants
     invariants.push(...architecturalInvariants);

     // Collect all file references from LLM analysis for citations
     const allCodeReferences = new Set<string>();

     llmResult.documentation.businessRules.forEach((rule) =>
      rule.codeReference.forEach((ref) => allCodeReferences.add(ref)),
     );
     llmResult.documentation.programFlows.forEach((flow) =>
      flow.codeReference.forEach((ref) => allCodeReferences.add(ref)),
     );
     llmResult.documentation.domainModels.forEach((model) =>
      model.codeReference.forEach((ref) => allCodeReferences.add(ref)),
     );
     llmResult.documentation.contracts.forEach((contract) =>
      contract.codeReference.forEach((ref) => allCodeReferences.add(ref)),
     );

     // Build detailed citations from code references
     citations.length = 0; // Clear any existing citations
     const now = new Date();

     if (sourcesRequired.includes("claude_md")) {
      citations.push({
       source: "claude_md",
       reference: "CLAUDE.md (analyzed via code chunks and LLM)",
       retrievedAt: now,
      });
     }

     // Add individual file citations from LLM analysis
     Array.from(allCodeReferences).forEach((filePath) => {
      citations.push({
       source: "code_chunks",
       reference: filePath,
       retrievedAt: now,
      });
     });

     // Capture LLM cost
     llmCost = {
      inputTokens: llmResult.actualCost.inputTokens,
      outputTokens: llmResult.actualCost.outputTokens,
      totalTokens: llmResult.actualCost.totalTokens,
      costUSD: llmResult.actualCost.costUSD,
     };

     logger.info("LLM analysis complete for domain", {
      domain,
      businessRulesCount: businessRules.length,
      flowsCount: programFlows.length,
      modelsCount: domainModels.length,
      contractsCount: contracts.length,
      architecturalInsightsCount:
       llmResult.documentation.architecturalInsights.length,
      designPatternsCount: llmResult.documentation.designPatterns.length,
      cost: `$${llmCost.costUSD.toFixed(4)}`,
      tokens: llmCost.totalTokens,
     });
    } else {
     logger.warn("No code chunks found for domain", { domain });
    }
   } else {
    logger.warn("Code extraction task not found", { repositoryIdentifier });
   }
  } catch (error) {
   logger.error("Error during LLM synthesis", { error, domain });
  }
 }

 // Build fallback citations if LLM analysis didn't run
 if (citations.length === 0) {
  const now = new Date();

  if (sourcesRequired.includes("claude_md")) {
   citations.push({
    source: "claude_md",
    reference: "CLAUDE.md (analyzed via code chunks)",
    retrievedAt: now,
   });
  }

  if (sourcesRequired.includes("code_chunks")) {
   citations.push({
    source: "code_chunks",
    reference: `Semantic search results for ${domain}`,
    retrievedAt: now,
   });
  }
 }

 const synthesisTime = Date.now() - startTime;
 logger.info("Documentation synthesis complete", {
  domain,
  synthesisTime: `${synthesisTime}ms`,
  businessRulesCount: businessRules.length,
  flowsCount: programFlows.length,
  modelsCount: domainModels.length,
  contractsCount: contracts.length,
  llmCalls: llmCost.costUSD > 0 ? 1 : 0,
  totalLLMCost: `$${llmCost.costUSD.toFixed(4)}`,
  totalTokens: llmCost.totalTokens,
 });

 return {
  businessRules,
  programFlows,
  domainModels,
  contracts,
  userStories,
  invariants,
  citations,
  llmCost: llmCost.costUSD > 0 ? llmCost : undefined,
 };
}
