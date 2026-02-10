/**
 * Source Synthesizer Service
 * Combines information from CLAUDE.md, code chunks, and external sources (Confluence)
 * to produce comprehensive documentation using GPT-4 analysis
 *
 * CRITICAL: Calls LLM analysis ONCE per domain to get all documentation types
 * (business rules, flows, models, contracts) in a single API call
 */

import type { SourceType } from '../models/documentation-task.js';
import type { BusinessRule, ProgramFlow, DomainModel, Contract, UserStory, Citation } from '../models/documentation-artifact.js';
import { logger } from '../utils/logger.js';
import { searchService } from './search.js';
import { taskService } from './task.js';
import { analyzeWithLLM } from './llm-analyzer.js';

export interface ArchitectureContext {
  hasClaudeFile: boolean;
  fullContent: string | null;
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
export async function analyzeCLAUDEmd(
 repositoryIdentifier: string,
): Promise<ArchitectureContext> {
 logger.info("Analyzing CLAUDE.md for repository", { repositoryIdentifier });

 try {
  // Get extraction task for this repository
  const task = await taskService.getByIdentifier(repositoryIdentifier);
  if (!task) {
   logger.warn("Code extraction task not found", { repositoryIdentifier });
   return {
    hasClaudeFile: false,
    fullContent: null,
   };
  }

  // Search for CLAUDE.md in code chunks
  const claudeChunks = await searchService.search({
   query: "CLAUDE.md",
   taskId: task.taskId,
   limit: 20,
   minScore: 0.7,
  });

  if (claudeChunks.length === 0) {
   logger.info("CLAUDE.md not found in repository", { repositoryIdentifier });
   return {
    hasClaudeFile: false,
    fullContent: null,
   };
  }

  // Reconstruct full content from chunks (sorted by line number)
  const sortedChunks = claudeChunks.sort((a, b) => a.startLine - b.startLine);
  const fullContent = sortedChunks.map((chunk) => chunk.content).join("\n");

  logger.info("CLAUDE.md content retrieved", {
   contentLength: fullContent.length,
   chunkCount: claudeChunks.length,
  });

  return {
   hasClaudeFile: true,
   fullContent,
  };
 } catch (error) {
  logger.error("Error getting CLAUDE.md", { error, repositoryIdentifier });
  return {
   hasClaudeFile: false,
   fullContent: null,
  };
 }
}

/**
 * Synthesize user stories (primarily from external sources like Confluence)
 */
// Removed unused `synthesizeUserStories` implementation — user stories
// are not synthesized in this service yet. Implementation lived here
// but was unused elsewhere in the codebase.

export interface DomainMetadata {
 description?: string;
 isFoundational?: boolean;
 dependencies?: string[];
}

/**
 * Step 1 (POC-aligned): Gather comprehensive code context for a domain
 * Uses the same approach as POC: multiple targeted queries with business focus
 */
async function gatherDomainCode(repositoryIdentifier: string, domain: string) {
 logger.info("Gathering code for domain analysis", {
  domain,
  repositoryIdentifier,
 });

 const task = await taskService.getByIdentifier(repositoryIdentifier);
 if (!task) {
  throw new Error(`Repository not found: ${repositoryIdentifier}`);
 }

 // IMPROVED: Adaptive search strategy - specific first, then broader if needed
 const allChunks = new Set<string>();

 // Phase 1: Get highly specific chunks (just domain name)
 try {
  const specificResults = await searchService.search({
   query: domain, // Just the domain name for maximum specificity
   taskId: task.taskId,
   limit: 40,
   minScore: 0.65, // Balanced - specific but not too strict
  });

  for (const result of specificResults) {
   allChunks.add(formatChunkWithContext(result));
  }

  logger.info("Phase 1: Domain-specific chunks", {
   domain,
   found: specificResults.length,
   minScore: 0.65,
  });
 } catch (error) {
  logger.warn("Phase 1 query failed", { domain, error });
 }

 // Phase 2: Broader search if we need more chunks
 if (allChunks.size < 15) {
  logger.info("Phase 2: Broader search triggered", { currentCount: allChunks.size });

  const broaderQueries = [
   `${domain} implementation`,
   `${domain} service logic`,
  ];

  for (const query of broaderQueries) {
   try {
    const results = await searchService.search({
     query,
     taskId: task.taskId,
     limit: 20,
     minScore: 0.55, // Lower threshold for broader search
    });

    for (const result of results) {
     allChunks.add(formatChunkWithContext(result));
    }

    logger.info("Phase 2: Broader query", { query, found: results.length });
   } catch (error) {
    logger.warn("Phase 2 query failed", { query, error });
   }

   // Stop if we have enough
   if (allChunks.size >= 30) break;
  }
 }

 const finalChunks = Array.from(allChunks).slice(0, 40);

 logger.info("Code gathering complete", {
  domain,
  totalChunks: finalChunks.length,
  strategy: allChunks.size >= 15 ? "specific-only" : "specific+broader",
 });

 return finalChunks;
}

function formatChunkWithContext(result: {
 filePath: string;
 startLine: number;
 endLine: number;
 score: number;
 content: string;
}) {
 return `FILE: ${result.filePath} (lines ${result.startLine}-${result.endLine})\nRELEVANCE: ${(result.score * 100).toFixed(1)}%\n\n${result.content}`;
}

/**
 * Step 2 (POC-aligned): Analyze CLAUDE.md for system context
 * Returns full context string like POC, not structured object
 */
async function getCLAUDEContext(repositoryIdentifier: string): Promise<string> {
 logger.info("Retrieving CLAUDE.md context");

 const result = await analyzeCLAUDEmd(repositoryIdentifier);
 return result.fullContent || "";
}

/**
 * T034-T035: Synthesize complete documentation for a domain
 * REFACTORED to match POC approach: gather → analyze with LLM → map results
 * Simplified flow, no over-engineering, proven to work
 */
export async function synthesizeDocumentation(
 domain: string,
 sourcesRequired: SourceType[],
 repositoryIdentifier: string,
 domainMetadata?: DomainMetadata,
): Promise<SynthesizedDocumentation> {
 logger.info("Starting documentation synthesis (POC-aligned approach)", {
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

 // Initialize empty results
 let businessRules: BusinessRule[] = [];
 let programFlows: ProgramFlow[] = [];
 let domainModels: DomainModel[] = [];
 let contracts: Contract[] = [];
 const userStories: UserStory[] = [];
 let invariants: string[] = [];
 let citations: Citation[] = [];
 let llmCost = emptyCost;

 // Helper mappers
 function mapBusinessRules(items: any[]): BusinessRule[] {
  return items.map((r) => ({
   name: r.name,
   description: r.description,
   rationale: r.rationale,
   sources: r.codeReference,
  }));
 }

 function mapProgramFlows(items: any[]): ProgramFlow[] {
  return items.map((f) => ({
   name: f.name,
   description: f.description,
   steps: f.steps,
   sources: f.codeReference,
  }));
 }

 function mapDomainModels(items: any[]): DomainModel[] {
  return items.map((m) => ({
   name: m.name,
   description: m.description,
   attributes: (m.attributes || []).map((a: any) => ({
    name: a.name,
    type: a.type,
    description: a.purpose,
   })),
   sources: m.codeReference,
  }));
 }

 function mapContracts(items: any[]): Contract[] {
  return items.map((c) => ({
   name: c.name,
   purpose: c.purpose,
   inputs: (c.inputs || []).map((i: any) => ({
    name: typeof i === "string" ? i : i,
    type: "object",
    required: true,
   })),
   outputs: (c.outputs || []).map((o: any) => ({
    name: typeof o === "string" ? o : o,
    type: "object",
   })),
   sources: c.codeReference,
  }));
 }

 function collectCodeReferences(doc: any) {
  const refs = new Set<string>();
  (doc.businessRules || []).forEach((r: any) =>
   (r.codeReference || []).forEach((ref: string) => refs.add(ref)),
  );
  (doc.programFlows || []).forEach((f: any) =>
   (f.codeReference || []).forEach((ref: string) => refs.add(ref)),
  );
  (doc.domainModels || []).forEach((m: any) =>
   (m.codeReference || []).forEach((ref: string) => refs.add(ref)),
  );
  (doc.contracts || []).forEach((c: any) =>
   (c.codeReference || []).forEach((ref: string) => refs.add(ref)),
  );
  return Array.from(refs);
 }

 // Only run analysis if code_chunks are requested
 if (sourcesRequired.includes("code_chunks")) {
  try {
   const codeChunks = await gatherDomainCode(repositoryIdentifier, domain);

   if (codeChunks.length === 0) {
    logger.warn("No code chunks found for domain", { domain });
   } else {
    const claudeContext = sourcesRequired.includes("claude_md")
     ? await getCLAUDEContext(repositoryIdentifier)
     : "";

    logger.info("Analyzing with LLM", {
     domain,
     codeChunkCount: codeChunks.length,
     claudeContextLength: claudeContext.length,
    });

    const analysisType = domain.toLowerCase().includes("architecture")
     ? "architecture"
     : "domain";

    const llmResult = await analyzeWithLLM({
     domain,
     domainDescription: domainMetadata?.description,
     isFoundational: domainMetadata?.isFoundational,
     dependencies: domainMetadata?.dependencies,
     codeChunks,
     claudeContext: claudeContext || undefined,
     analysisType,
    });

    // Map LLM output
    businessRules = mapBusinessRules(
     llmResult.documentation.businessRules || [],
    );
    programFlows = mapProgramFlows(llmResult.documentation.programFlows || []);
    domainModels = mapDomainModels(llmResult.documentation.domainModels || []);
    contracts = mapContracts(llmResult.documentation.contracts || []);

    invariants = [
     ...(llmResult.documentation.architecturalInsights || []),
     ...(llmResult.documentation.designPatterns || []),
    ];

    const codeRefs = collectCodeReferences(llmResult.documentation || {});
    const now = new Date();

    if (sourcesRequired.includes("claude_md")) {
     citations.push({
      source: "claude_md",
      reference: "CLAUDE.md (analyzed via code chunks and LLM)",
      retrievedAt: now,
     });
    }

    codeRefs.forEach((r) =>
     citations.push({ source: "code_chunks", reference: r, retrievedAt: now }),
    );

    // Capture LLM cost (if available)
    if (llmResult.actualCost) {
     llmCost = {
      inputTokens: llmResult.actualCost.inputTokens,
      outputTokens: llmResult.actualCost.outputTokens,
      totalTokens: llmResult.actualCost.totalTokens,
      costUSD: llmResult.actualCost.costUSD,
     };
    }

    logger.info("LLM analysis complete for domain", {
     domain,
     businessRulesCount: businessRules.length,
     flowsCount: programFlows.length,
     modelsCount: domainModels.length,
     contractsCount: contracts.length,
     invariantsCount: invariants.length,
     cost: `$${llmCost.costUSD.toFixed(4)}`,
     tokens: llmCost.totalTokens,
    });
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
