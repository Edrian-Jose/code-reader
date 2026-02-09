/**
 * Artifact Generator Service
 * Generates documentation artifacts using Handlebars templates
 * Validates quality and assigns scores
 */

import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { DocumentationArtifact } from '../models/documentation-artifact.js';
import type { SynthesizedDocumentation } from './source-synthesizer.js';
import { validateRequiredSections, detectImplementationDetails } from '../utils/markdown-formatter.js';
import { logger } from '../utils/logger.js';

// Register Handlebars helpers
Handlebars.registerHelper('add', (a: number, b: number) => a + b);

// Load template
const templatePath = join(process.cwd(), 'src', 'templates', 'documentation', 'domain-artifact.hbs');
let domainTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate(): HandlebarsTemplateDelegate {
  if (!domainTemplate) {
    try {
      const templateContent = readFileSync(templatePath, 'utf-8');
      domainTemplate = Handlebars.compile(templateContent);
      logger.debug('Loaded Handlebars template', { templatePath });
    } catch (error) {
      logger.error('Failed to load template', { error, templatePath });
      throw new Error(`Failed to load documentation template: ${error}`);
    }
  }
  return domainTemplate;
}

/**
 * T036: Generate documentation artifact from synthesized data
 * Builds template data, renders markdown, validates quality
 */
export async function generateArtifact(
  taskId: string,
  planId: string,
  domain: string,
  synthesized: SynthesizedDocumentation
): Promise<DocumentationArtifact> {
  logger.info('Generating documentation artifact', { domain, taskId });

  const artifactId = uuidv4();
  const now = new Date();

  // Build template data
  const templateData = {
    domainName: domain,
    sources: synthesized.citations.map((c) => c.source).join(', '),
    timestamp: now.toISOString(),
    businessRules: synthesized.businessRules,
    programFlows: synthesized.programFlows,
    domainModels: synthesized.domainModels,
    contracts: synthesized.contracts,
    userStories: synthesized.userStories,
    invariants: synthesized.invariants,
    citations: synthesized.citations.map((c) => ({
      ...c,
      retrievedAt: c.retrievedAt.toISOString(),
    })),
  };

  // Render markdown using template
  const template = getTemplate();
  const markdownContent = template(templateData);

  logger.debug('Markdown content generated', { domain, contentLength: markdownContent.length });

  // T030: Validate required sections
  const missingSections = validateRequiredSections(markdownContent);
  if (missingSections.length > 0) {
    logger.warn('Missing required sections in artifact', { domain, missingSections });
    // Continue but note in quality score
  }

  // T030: Detect implementation details
  const implementationDetails = detectImplementationDetails(markdownContent);
  if (implementationDetails.length > 0) {
    logger.warn('Implementation details detected in artifact', { domain, details: implementationDetails });
    // Mark with warnings but continue
  }

  // T031: Calculate quality score
  const qualityScore = calculateQualityScore(
    synthesized.businessRules,
    synthesized.programFlows,
    synthesized.domainModels,
    synthesized.contracts,
    synthesized.userStories,
    synthesized.invariants,
    synthesized.citations,
    markdownContent,
    missingSections,
    implementationDetails
  );

  logger.info('Quality score calculated', { domain, qualityScore, missingSections: missingSections.length, implDetails: implementationDetails.length });

  // Reject if quality < 70%
  if (qualityScore < 70) {
    const qualityIssues = [];
    if (missingSections.length > 0) {
      qualityIssues.push(`Missing sections: ${missingSections.join(', ')}`);
    }
    if (implementationDetails.length > 0) {
      qualityIssues.push(`Implementation details detected: ${implementationDetails.join(', ')}`);
    }

    throw new Error(
      `Artifact quality score (${qualityScore}%) is below 70% threshold. Issues: ${qualityIssues.join('; ')}`
    );
  }

  const artifact: DocumentationArtifact = {
    artifactId,
    taskId,
    planId,
    domainName: domain,
    sections: {
      businessRules: synthesized.businessRules,
      programFlows: synthesized.programFlows,
      domainModels: synthesized.domainModels,
      contracts: synthesized.contracts,
      userStories: synthesized.userStories,
      invariants: synthesized.invariants,
    },
    citations: synthesized.citations,
    markdownContent,
    qualityScore,
    llmCost: synthesized.llmCost,
    generatedAt: now,
  };

  logger.info('Artifact generated successfully', {
    domain,
    artifactId,
    qualityScore,
    llmCost: synthesized.llmCost ? `$${synthesized.llmCost.costUSD.toFixed(4)}` : 'N/A',
  });

  return artifact;
}

/**
 * Calculate quality score for generated artifact
 * T031: Scoring: 40% section completeness, 30% no implementation details, 20% citation coverage, 10% acceptance criteria clarity
 */
function calculateQualityScore(
  businessRules: any[],
  programFlows: any[],
  domainModels: any[],
  contracts: any[],
  userStories: any[],
  invariants: string[],
  citations: any[],
  markdownContent: string,
  missingSections: string[],
  implementationDetails: string[]
): number {
  let score = 0;

  // 40% - Section completeness
  const requiredSectionCount = 6; // business rules, flows, models, contracts, stories, invariants
  const missingSectionCount = missingSections.length;
  const presentSectionCount = requiredSectionCount - missingSectionCount;
  score += (presentSectionCount / requiredSectionCount) * 40;

  // 30% - Absence of implementation details
  const implDetailsPenalty = Math.min(implementationDetails.length * 5, 30); // -5% per detail, max -30%
  score += 30 - implDetailsPenalty;

  // 20% - Citation coverage
  // Expect at least 2 citations (CLAUDE.md + code chunks)
  const citationScore = Math.min((citations.length / 2) * 20, 20);
  score += citationScore;

  // 10% - Acceptance criteria clarity (in user stories)
  if (userStories.length > 0) {
    const storiesWithCriteria = userStories.filter((s) => s.acceptanceCriteria && s.acceptanceCriteria.length > 0).length;
    const criteriaScore = (storiesWithCriteria / userStories.length) * 10;
    score += criteriaScore;
  } else {
    // No user stories yet - don't penalize in MVP
    score += 5; // Partial credit
  }

  return Math.round(score);
}
