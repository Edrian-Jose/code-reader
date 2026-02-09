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
import { searchService } from './search.js';
import { taskService } from './task.js';

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

  // T020: Implement task decomposition
  // Step 1: Analyze CLAUDE.md if available
  const architectureContext = await analyzeCLAUDEmd(input.repositoryIdentifier);

  // Step 2: Identify domains/features from code and CLAUDE.md
  const domains = await identifyDomains(input.repositoryIdentifier, architectureContext);

  logger.info('Identified domains for documentation', { count: domains.length, domains });

  // Step 3: Create tasks for each domain
  const tasks = await createTasksForDomains(domains, planId, input.repositoryIdentifier);

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

  // Create plan entity
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
 * Identify domains/features from repository analysis
 * Uses CLAUDE.md analysis and code chunk queries
 */
async function identifyDomains(repositoryIdentifier: string, architectureContext: any): Promise<string[]> {
  const domains: string[] = [];

  // Add domains from CLAUDE.md bounded contexts
  if (architectureContext.boundedContexts && architectureContext.boundedContexts.length > 0) {
    domains.push(...architectureContext.boundedContexts);
  }

  // If CLAUDE.md doesn't provide domains, infer from code structure
  // Query for common architectural patterns
  const task = await taskService.getByIdentifier(repositoryIdentifier);
  if (!task) {
    logger.warn('Code extraction task not found, using default domain', { repositoryIdentifier });
    return ['System Architecture']; // Default fallback
  }

  // Search for service/controller/model patterns to identify domains
  try {
    const serviceResults = await searchService.search({
      query: 'service class implementation business logic',
      taskId: task.taskId,
      limit: 20,
      minScore: 0.6,
    });

    // Extract domain names from file paths
    const detectedDomains = new Set<string>();
    for (const result of serviceResults) {
      const parts = result.filePath.split('/');
      // Look for domain indicators in path (e.g., src/services/auth-service.ts → Auth)
      const serviceName = parts[parts.length - 1].replace(/[-_](service|controller|handler)\.ts/, '');
      if (serviceName && serviceName.length > 0) {
        const domainName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);
        detectedDomains.add(domainName);
      }
    }

    if (detectedDomains.size > 0) {
      domains.push(...Array.from(detectedDomains));
    }
  } catch (error) {
    logger.warn('Failed to detect domains from code', { error });
  }

  // Ensure at least one domain
  if (domains.length === 0) {
    domains.push('System Architecture');
  }

  return [...new Set(domains)]; // Deduplicate
}

/**
 * Create documentation tasks for identified domains
 */
async function createTasksForDomains(
  domains: string[],
  planId: string,
  _repositoryIdentifier: string
): Promise<DocumentationTask[]> {
  const tasks: DocumentationTask[] = [];
  const now = new Date();

  // Always create a foundational task for system architecture
  tasks.push({
    taskId: uuidv4(),
    planId,
    domain: 'System Architecture',
    description: 'Document overall system architecture, design philosophy, and core principles',
    priorityScore: 0, // Will be calculated later
    dependencies: [],
    sourcesRequired: ['claude_md', 'code_chunks'] as SourceType[],
    isFoundational: true,
    estimatedComplexity: 5,
    status: 'pending',
    artifactRef: null,
    startedAt: null,
    completedAt: null,
    error: null,
    createdAt: now,
  });

  // Create tasks for each domain
  for (const domain of domains) {
    if (domain === 'System Architecture') continue; // Already added

    tasks.push({
      taskId: uuidv4(),
      planId,
      domain,
      description: `Document ${domain} domain including business rules, program flows, and data models`,
      priorityScore: 0, // Will be calculated later
      dependencies: [tasks[0].taskId], // Depend on system architecture
      sourcesRequired: ['code_chunks'] as SourceType[],
      isFoundational: false,
      estimatedComplexity: 4,
      status: 'pending',
      artifactRef: null,
      startedAt: null,
      completedAt: null,
      error: null,
      createdAt: now,
    });
  }

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