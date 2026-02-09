import type { ObjectId } from 'mongodb';
import type { SourceType } from './documentation-task';

export interface BusinessRule {
  name: string;
  description: string;
  rationale: string;
  sources: SourceType[];
}

export interface ProgramFlow {
  name: string;
  description: string;
  steps: string[];
  sources: SourceType[];
}

export interface DomainModel {
  name: string;
  description: string;
  attributes: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  sources: SourceType[];
}

export interface Contract {
  name: string;
  purpose: string;
  inputs: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
  outputs: Array<{
    name: string;
    type: string;
  }>;
  sources: SourceType[];
}

export interface UserStory {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  sources: SourceType[];
}

export interface Citation {
  source: SourceType;
  reference: string; // File path, Confluence page ID, etc.
  retrievedAt: Date;
}

export interface ArtifactSections {
  businessRules: BusinessRule[];
  programFlows: ProgramFlow[];
  domainModels: DomainModel[];
  contracts: Contract[];
  userStories: UserStory[];
  invariants: string[];
}

export interface DocumentationArtifact {
  _id?: ObjectId;
  artifactId: string; // UUID v4
  taskId: string; // Reference to source task
  planId: string; // Reference to parent plan
  domainName: string; // Domain/feature documented
  sections: ArtifactSections;
  citations: Citation[]; // Source attributions
  markdownContent: string; // Rendered markdown
  qualityScore?: number; // 0-100 score from validation
  generatedAt: Date;
}

export interface ArtifactResponse {
  data: {
    type: 'documentation_artifact';
    id: string;
    attributes: {
      artifactId: string;
      domainName: string;
      markdownContent?: string;
      sections?: ArtifactSections;
      citations?: Citation[];
      qualityScore?: number;
      generatedAt?: string;
    };
  };
}

export function createArtifactResponse(
  artifact: DocumentationArtifact,
  contentType: 'json' | 'markdown' = 'json'
): ArtifactResponse {
  const response: ArtifactResponse = {
    data: {
      type: 'documentation_artifact',
      id: artifact.artifactId,
      attributes: {
        artifactId: artifact.artifactId,
        domainName: artifact.domainName,
      },
    },
  };

  if (contentType === 'json') {
    response.data.attributes = {
      ...response.data.attributes,
      markdownContent: artifact.markdownContent,
      sections: artifact.sections,
      citations: artifact.citations,
      qualityScore: artifact.qualityScore,
      generatedAt: artifact.generatedAt.toISOString(),
    };
  } else {
    // For markdown content type, only include markdown content
    response.data.attributes.markdownContent = artifact.markdownContent;
  }

  return response;
}
