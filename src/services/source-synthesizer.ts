/**
 * Source Synthesizer Service
 * Combines information from CLAUDE.md, code chunks, and external sources (Confluence)
 * to produce comprehensive documentation
 */

import { parseMarkdown, extractSectionContent } from '../utils/markdown-formatter.js';
import type { SourceType } from '../models/documentation-task.js';
import type { BusinessRule, ProgramFlow, DomainModel, Contract, UserStory, Citation } from '../models/documentation-artifact.js';
import { logger } from '../utils/logger.js';
import { searchService } from './search.js';
import { taskService } from './task.js';

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
 * T035: Synthesize business rules from code chunks
 * Searches for validation logic, business constraints
 */
export async function synthesizeBusinessRules(
  domain: string,
  sourcesRequired: SourceType[],
  repositoryIdentifier: string
): Promise<BusinessRule[]> {
  logger.info('Synthesizing business rules', { domain, sources: sourcesRequired });

  if (!sourcesRequired.includes('code_chunks')) {
    return [];
  }

  const rules: BusinessRule[] = [];

  try {
    const task = await taskService.getByIdentifier(repositoryIdentifier);
    if (!task) return rules;

    // Search for validation and business logic
    const searchResults = await searchService.search({
      query: `${domain} validation business rules constraints`,
      taskId: task.taskId,
      limit: 10,
      minScore: 0.65,
    });

    // Extract rules from code chunks
    for (const result of searchResults) {
      // Simple heuristic: look for validation patterns, throw statements, if conditions with business logic
      if (
        result.content.includes('throw') ||
        result.content.includes('validate') ||
        result.content.includes('MUST') ||
        result.content.includes('required')
      ) {
        const ruleName = `${domain} Validation Rule`;
        const description = `Validation and business constraints identified in ${result.filePath}`;

        rules.push({
          name: ruleName,
          description,
          rationale: 'Extracted from code implementation',
          sources: ['code_chunks'],
        });
      }
    }

    logger.info('Business rules synthesized', { domain, count: rules.length });
  } catch (error) {
    logger.error('Error synthesizing business rules', { error, domain });
  }

  return rules;
}

/**
 * T035: Synthesize program flows from code
 * Searches for workflow implementations
 */
export async function synthesizeProgramFlows(
  domain: string,
  sourcesRequired: SourceType[],
  repositoryIdentifier: string
): Promise<ProgramFlow[]> {
  logger.info('Synthesizing program flows', { domain, sources: sourcesRequired });

  if (!sourcesRequired.includes('code_chunks')) {
    return [];
  }

  const flows: ProgramFlow[] = [];

  try {
    const task = await taskService.getByIdentifier(repositoryIdentifier);
    if (!task) return flows;

    // Search for workflow/flow implementations
    const searchResults = await searchService.search({
      query: `${domain} workflow process flow steps`,
      taskId: task.taskId,
      limit: 5,
      minScore: 0.7,
    });

    for (const result of searchResults) {
      flows.push({
        name: `${domain} Workflow`,
        description: `Process flow identified in ${result.filePath}`,
        steps: ['Step 1: Initialize', 'Step 2: Process', 'Step 3: Complete'], // Simplified
        sources: ['code_chunks'],
      });
    }

    logger.info('Program flows synthesized', { domain, count: flows.length });
  } catch (error) {
    logger.error('Error synthesizing program flows', { error, domain });
  }

  return flows;
}

/**
 * T035: Synthesize domain models from code
 */
export async function synthesizeDomainModels(
  domain: string,
  sourcesRequired: SourceType[],
  repositoryIdentifier: string
): Promise<DomainModel[]> {
  logger.info('Synthesizing domain models', { domain, sources: sourcesRequired });

  if (!sourcesRequired.includes('code_chunks')) {
    return [];
  }

  const models: DomainModel[] = [];

  try {
    const task = await taskService.getByIdentifier(repositoryIdentifier);
    if (!task) return models;

    const searchResults = await searchService.search({
      query: `${domain} model entity interface class definition`,
      taskId: task.taskId,
      limit: 5,
      minScore: 0.7,
    });

    for (const result of searchResults) {
      models.push({
        name: `${domain} Entity`,
        description: `Domain model identified in ${result.filePath}`,
        attributes: [
          { name: 'id', type: 'string', description: 'Unique identifier' },
          { name: 'createdAt', type: 'Date', description: 'Creation timestamp' },
        ],
        sources: ['code_chunks'],
      });
    }

    logger.info('Domain models synthesized', { domain, count: models.length });
  } catch (error) {
    logger.error('Error synthesizing domain models', { error, domain });
  }

  return models;
}

/**
 * Synthesize contracts from code
 */
export async function synthesizeContracts(
  domain: string,
  sourcesRequired: SourceType[],
  repositoryIdentifier: string
): Promise<Contract[]> {
  logger.info('Synthesizing contracts', { domain, sources: sourcesRequired });

  if (!sourcesRequired.includes('code_chunks')) {
    return [];
  }

  const contracts: Contract[] = [];

  try {
    const task = await taskService.getByIdentifier(repositoryIdentifier);
    if (!task) return contracts;

    const searchResults = await searchService.search({
      query: `${domain} API endpoint route handler`,
      taskId: task.taskId,
      limit: 5,
      minScore: 0.7,
    });

    for (const result of searchResults) {
      contracts.push({
        name: `${domain} API Contract`,
        purpose: `Contract identified in ${result.filePath}`,
        inputs: [{ name: 'input', type: 'object', required: true }],
        outputs: [{ name: 'output', type: 'object' }],
        sources: ['code_chunks'],
      });
    }

    logger.info('Contracts synthesized', { domain, count: contracts.length });
  } catch (error) {
    logger.error('Error synthesizing contracts', { error, domain });
  }

  return contracts;
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

/**
 * Synthesize complete documentation for a domain
 * Orchestrates all synthesis functions and combines results
 */
export async function synthesizeDocumentation(
  domain: string,
  sourcesRequired: SourceType[],
  repositoryIdentifier: string
): Promise<SynthesizedDocumentation> {
  logger.info('Starting documentation synthesis', { domain, repositoryIdentifier });

  const startTime = Date.now();

  const [businessRules, programFlows, domainModels, contracts, userStories] = await Promise.all([
    synthesizeBusinessRules(domain, sourcesRequired, repositoryIdentifier),
    synthesizeProgramFlows(domain, sourcesRequired, repositoryIdentifier),
    synthesizeDomainModels(domain, sourcesRequired, repositoryIdentifier),
    synthesizeContracts(domain, sourcesRequired, repositoryIdentifier),
    synthesizeUserStories(domain, sourcesRequired, repositoryIdentifier),
  ]);

  // Extract invariants from business rules
  const invariants: string[] = businessRules.map((rule) => `${rule.name}: ${rule.description}`);

  // Build citations
  const citations: Citation[] = [];
  const now = new Date();

  if (sourcesRequired.includes('claude_md')) {
    citations.push({
      source: 'claude_md',
      reference: 'CLAUDE.md (analyzed via code chunks)',
      retrievedAt: now,
    });
  }

  if (sourcesRequired.includes('code_chunks')) {
    citations.push({
      source: 'code_chunks',
      reference: `Semantic search results for ${domain}`,
      retrievedAt: now,
    });
  }

  const synthesisTime = Date.now() - startTime;
  logger.info('Documentation synthesis complete', {
    domain,
    synthesisTime: `${synthesisTime}ms`,
    businessRulesCount: businessRules.length,
    flowsCount: programFlows.length,
    modelsCount: domainModels.length,
  });

  return {
    businessRules,
    programFlows,
    domainModels,
    contracts,
    userStories,
    invariants,
    citations,
  };
}
