/**
 * Documentation Planner Service
 * Creates documentation plans with task decomposition and prioritization
 */

import { v4 as uuidv4 } from 'uuid';
import type { DocumentationPlan, CreatePlanInput } from '../models/documentation-plan.js';
import { DEFAULT_HEURISTIC } from '../models/documentation-plan.js';
import type { DocumentationTask, SourceType } from '../models/documentation-task.js';
import { getDocumentationPlansCollection, getDocumentationTasksCollection } from '../db/documentation-collections.js';
import { analyzeCLAUDEmd } from './source-synthesizer.js';
import { assignPriorityScores } from './task-prioritizer.js';
import { detectCycle, mergeCyclicNodes } from '../utils/dependency-graph.js';
import { logger } from '../utils/logger.js';
import { identifyDomainsWithLLM } from './llm-analyzer.js';

/**
 * Create a new documentation plan for a repository
 * Implements T020-T023: task decomposition, dependency detection, priority scoring, version sequencing
 */
export async function createDocumentationPlan(input: CreatePlanInput): Promise<DocumentationPlan> {
  logger.info('Creating documentation plan', {
    identifier: input.identifier,
    repository: input.repositoryIdentifier,
  });

  const planId = uuidv4();

  // T023: Implement version sequencing (max + 1 pattern)
  const existingPlans = await getDocumentationPlansCollection()
    .find({ identifier: input.identifier })
    .sort({ version: -1 })
    .limit(1)
    .toArray();
  const version = existingPlans.length > 0 ? existingPlans[0].version + 1 : 1;

  logger.info('Calculated plan version', { identifier: input.identifier, version });

  // T020: Implement task decomposition with LLM
  // SIMPLIFIED: Just pass CLAUDE.md to GPT-4, let it extract all domains
  const architectureContext = await analyzeCLAUDEmd(input.repositoryIdentifier);
  const claudeContent = architectureContext.fullContent || '';

  if (!claudeContent) {
    throw new Error('CLAUDE.md not found or empty - cannot identify domains without it');
  }

  // Use GPT-4 to identify ALL domains from CLAUDE.md
  const domainAnalysis = await identifyDomainsWithLLM(claudeContent);

  logger.info('GPT-4 identified domains from CLAUDE.md', {
    domainCount: domainAnalysis.domains.length,
    domains: domainAnalysis.domains.map((d) => d.name),
    llmCost: `$${domainAnalysis.cost.costUSD.toFixed(4)}`,
  });

  // Create tasks for each identified domain
  const tasks = createTasksFromDomainAnalysis(domainAnalysis.domains, planId);

  // T021: Implement dependency detection
  detectAndAssignDependencies(tasks);

  // Check for cycles
  const graphNodes = tasks.map((t) => ({ id: t.taskId, dependencies: t.dependencies }));
  const cycle = detectCycle(graphNodes);

  if (cycle) {
    logger.warn('Cyclic dependency detected, merging tasks', { cycle });
    // Merge cyclic tasks into one larger task
    const mergedNode = mergeCyclicNodes(graphNodes, cycle);
    // Update tasks array to reflect merged task
    // For simplicity, we'll mark one task as having all work and remove others
    const cycleSet = new Set(cycle);
    const tasksToKeep = tasks.filter((t) => !cycleSet.has(t.taskId));
    const firstCyclicTask = tasks.find((t) => cycleSet.has(t.taskId));

    if (firstCyclicTask) {
      firstCyclicTask.description += ` (merged with ${cycle.length - 1} other tasks due to cycle)`;
      firstCyclicTask.dependencies = mergedNode.dependencies;
      firstCyclicTask.estimatedComplexity = Math.min(10, firstCyclicTask.estimatedComplexity * cycle.length);
      tasksToKeep.push(firstCyclicTask);
    }

    tasks.length = 0;
    tasks.push(...tasksToKeep);
  }

  // T022: Implement priority score calculation
  assignPriorityScores(tasks, DEFAULT_HEURISTIC);

  logger.info('Assigned priority scores', { taskCount: tasks.length });

  // Parse externalSources from input
  const externalSources = parseExternalSources(input.externalSources, planId);

  // If Confluence is configured, add 'confluence' to all tasks' sourcesRequired
  const hasConfluence = externalSources && externalSources.some((src) => src.sourceType === 'confluence' && src.enabled);
  if (hasConfluence) {
    tasks.forEach((task) => {
      if (!task.sourcesRequired.includes('confluence')) {
        task.sourcesRequired.push('confluence');
      }
    });
    logger.info('Added Confluence to sourcesRequired for all tasks', { taskCount: tasks.length });
  }

  // Create plan entity with planning cost
  const now = new Date();
  const plan: DocumentationPlan = {
    planId,
    identifier: input.identifier,
    version,
    repositoryIdentifier: input.repositoryIdentifier,
    status: 'planning',
    progress: {
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      currentTask: null,
    },
    heuristic: DEFAULT_HEURISTIC,
    externalSources, // Include external sources if configured
    planningCost: {
      inputTokens: domainAnalysis.cost.inputTokens,
      outputTokens: domainAnalysis.cost.outputTokens,
      totalTokens: domainAnalysis.cost.totalTokens,
      costUSD: domainAnalysis.cost.costUSD,
    },
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    error: null,
  };

  // Persist plan and tasks
  await getDocumentationPlansCollection().insertOne(plan);

  if (tasks.length > 0) {
    await getDocumentationTasksCollection().insertMany(tasks);
    logger.info('Persisted documentation tasks', { count: tasks.length });
  }

  // Update status to 'executing'
  plan.status = 'executing';
  await getDocumentationPlansCollection().updateOne({ planId }, { $set: { status: 'executing', updatedAt: new Date() } });

  logger.info('Documentation plan created successfully', {
    planId,
    identifier: input.identifier,
    version,
    taskCount: tasks.length,
  });

  return plan;
}

/**
 * Create documentation tasks from LLM domain analysis
 * Uses GPT-4's comprehensive domain identification from CLAUDE.md
 */
function createTasksFromDomainAnalysis(
  domains: Array<{ name: string; description: string; isFoundational: boolean; dependencies: string[] }>,
  planId: string
): DocumentationTask[] {
  const tasks: DocumentationTask[] = [];
  const now = new Date();
  const taskMap = new Map<string, string>(); // domain name → taskId

  // Create tasks for all domains
  for (const domain of domains) {
    const taskId = uuidv4();
    taskMap.set(domain.name, taskId);

    // Dependencies will be resolved in next step
    tasks.push({
      taskId,
      planId,
      domain: domain.name,
      description: domain.description,
      priorityScore: 0, // Will be calculated by prioritizer
      dependencies: [], // Will be populated based on domain.dependencies
      sourcesRequired: ['claude_md', 'code_chunks'] as SourceType[],
      isFoundational: domain.isFoundational,
      estimatedComplexity: domain.isFoundational ? 7 : 5,
      status: 'pending',
      artifactRef: null,
      startedAt: null,
      completedAt: null,
      error: null,
      createdAt: now,
    });
  }

  // Resolve dependencies (convert domain names to taskIds)
  for (let i = 0; i < tasks.length; i++) {
    const domain = domains[i];
    const task = tasks[i];

    for (const depName of domain.dependencies) {
      const depTaskId = taskMap.get(depName);
      if (depTaskId) {
        task.dependencies.push(depTaskId);
      } else {
        logger.warn('Dependency not found', { task: task.domain, dependency: depName });
      }
    }
  }

  logger.info('Tasks created from LLM domain analysis', {
    taskCount: tasks.length,
    foundationalCount: tasks.filter((t) => t.isFoundational).length,
  });

  return tasks;
}

/**
 * Detect dependencies between tasks
 * Simple heuristic: domain tasks depend on architecture task
 */
function detectAndAssignDependencies(tasks: DocumentationTask[]): void {
  // Already assigned in createTasksForDomains
  // More sophisticated dependency detection could analyze code relationships
  logger.debug('Dependencies assigned', { taskCount: tasks.length });
}

/**
 * Parse external sources from plan input and convert to ExternalSourceConfig format
 */
function parseExternalSources(
  externalSourcesInput: CreatePlanInput['externalSources'] | undefined,
  planId: string
): import('../models/external-source-config.js').ExternalSourceConfig[] | undefined {
  if (!externalSourcesInput) {
    return undefined;
  }

  const configs: import('../models/external-source-config.js').ExternalSourceConfig[] = [];

  // Parse Confluence config
  if (externalSourcesInput.confluence?.enabled && externalSourcesInput.confluence.cloudId) {
    configs.push({
      configId: uuidv4(), // Use existing uuidv4 import from top of file
      planId: planId,
      sourceType: 'confluence',
      enabled: true,
      connectionParams: {
        cloudId: externalSourcesInput.confluence.cloudId,
      },
      authDelegation: {
        protocol: 'mcp',
        upstreamServer: 'atlassian',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return configs.length > 0 ? configs : undefined;
}

/**
 * Get documentation plan by identifier (latest version)
 */
export async function getPlanByIdentifier(identifier: string): Promise<DocumentationPlan | null> {
  const plan = await getDocumentationPlansCollection()
    .find({ identifier })
    .sort({ version: -1 })
    .limit(1)
    .next();

  return plan;
}

/**
 * Get all tasks for a plan with optional filtering
 */
export async function getTasksForPlan(planId: string, statusFilter?: string[]): Promise<DocumentationTask[]> {
  const query: any = { planId };

  if (statusFilter && statusFilter.length > 0) {
    query.status = { $in: statusFilter };
  }

  return await getDocumentationTasksCollection().find(query).toArray();
}