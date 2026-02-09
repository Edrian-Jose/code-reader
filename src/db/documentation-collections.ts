import type { Collection } from 'mongodb';
import { getDatabase } from './client.js';
import type { DocumentationPlan } from '../models/documentation-plan.js';
import type { DocumentationTask } from '../models/documentation-task.js';
import type { DocumentationArtifact } from '../models/documentation-artifact.js';
import type { ExternalSourceConfig } from '../models/external-source-config.js';

export const DOCUMENTATION_COLLECTION_NAMES = {
  PLANS: 'documentation_plans',
  TASKS: 'documentation_tasks',
  ARTIFACTS: 'documentation_artifacts',
  EXTERNAL_SOURCES: 'external_source_configs',
} as const;

export function getDocumentationPlansCollection(): Collection<DocumentationPlan> {
  return getDatabase().collection<DocumentationPlan>(DOCUMENTATION_COLLECTION_NAMES.PLANS);
}

export function getDocumentationTasksCollection(): Collection<DocumentationTask> {
  return getDatabase().collection<DocumentationTask>(DOCUMENTATION_COLLECTION_NAMES.TASKS);
}

export function getDocumentationArtifactsCollection(): Collection<DocumentationArtifact> {
  return getDatabase().collection<DocumentationArtifact>(DOCUMENTATION_COLLECTION_NAMES.ARTIFACTS);
}

export function getExternalSourceConfigsCollection(): Collection<ExternalSourceConfig> {
  return getDatabase().collection<ExternalSourceConfig>(DOCUMENTATION_COLLECTION_NAMES.EXTERNAL_SOURCES);
}
