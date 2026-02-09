import type { ObjectId } from 'mongodb';

export type ExternalSourceType = 'confluence';

export interface AuthDelegation {
  protocol: 'mcp'; // Authentication handled by MCP client
  upstreamServer: string; // MCP server name (e.g., "atlassian")
}

export interface ConfluenceConnectionParams {
  cloudId: string; // Confluence cloud instance ID (NOT credentials)
}

export interface ExternalSourceConfig {
  _id?: ObjectId;
  configId: string; // UUID v4
  planId: string; // Link to documentation plan
  sourceType: ExternalSourceType; // Extensible to other sources
  enabled: boolean;
  connectionParams: ConfluenceConnectionParams;
  authDelegation: AuthDelegation;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExternalSourceConfigInput {
  planId: string;
  sourceType: ExternalSourceType;
  enabled: boolean;
  connectionParams: ConfluenceConnectionParams;
}

export interface ExternalSourceConfigResponse {
  data: {
    type: 'external_source_config';
    id: string;
    attributes: {
      configId: string;
      planId: string;
      sourceType: ExternalSourceType;
      enabled: boolean;
      authDelegation: AuthDelegation;
    };
  };
  meta?: {
    message?: string;
  };
}

export function createExternalSourceConfigResponse(
  config: ExternalSourceConfig
): ExternalSourceConfigResponse {
  return {
    data: {
      type: 'external_source_config',
      id: config.configId,
      attributes: {
        configId: config.configId,
        planId: config.planId,
        sourceType: config.sourceType,
        enabled: config.enabled,
        authDelegation: config.authDelegation,
      },
    },
    meta: {
      message: 'External source configured. Authentication will be handled by MCP client.',
    },
  };
}
