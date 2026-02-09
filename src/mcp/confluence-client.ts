/**
 * Direct Confluence API Client
 * Queries Confluence Cloud API directly (no external MCP server needed)
 */

import { logger } from '../utils/logger.js';

interface MCPToolCall {
  type: 'tool_call';
  tool: string;
  parameters: Record<string, any>;
}

interface MCPToolResult {
  success: boolean;
  data: any;
  error?: string;
}

class ConfluenceMCPClient {
  private isConnected = false;
  private instanceUrl: string;
  private username: string;
  private apiToken: string;
  private authHeader: string;

  constructor() {
    this.instanceUrl = process.env.ATLASSIAN_INSTANCE_URL || '';
    this.username = process.env.ATLASSIAN_USERNAME || '';
    this.apiToken = process.env.ATLASSIAN_API_TOKEN || '';

    // Create Basic Auth header
    if (this.username && this.apiToken) {
      const credentials = Buffer.from(`${this.username}:${this.apiToken}`).toString('base64');
      this.authHeader = `Basic ${credentials}`;
    } else {
      this.authHeader = '';
    }
  }

  /**
   * Check if Confluence client is configured
   */
  isConfigured(): boolean {
    return !!(this.instanceUrl && this.username && this.apiToken);
  }

  /**
   * Initialize the Confluence client
   */
  async connect(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        'Confluence not configured. Set ATLASSIAN_INSTANCE_URL, ATLASSIAN_USERNAME, ATLASSIAN_API_TOKEN environment variables.'
      );
    }

    if (this.isConnected) {
      logger.info('Confluence API client already connected');
      return;
    }

    logger.info('Initializing Confluence API client...');

    try {
      // Test connection by fetching server info
      const response = await fetch(`${this.instanceUrl}/wiki/rest/api/space`, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Confluence authentication failed - check ATLASSIAN_USERNAME and ATLASSIAN_API_TOKEN');
        }
        throw new Error(`Confluence API returned ${response.status}: ${response.statusText}`);
      }

      this.isConnected = true;
      logger.info('Confluence API client connected successfully', {
        instanceUrl: this.instanceUrl,
        username: this.username,
      });
    } catch (error: any) {
      logger.error('Failed to connect to Confluence API', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a tool call (searchConfluenceUsingCql or getConfluencePage)
   */
  async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.isConnected) {
      throw new Error('Confluence client not connected. Call connect() first.');
    }

    logger.info('Executing Confluence API call', {
      tool: toolCall.tool,
      parameters: toolCall.parameters,
    });

    try {
      if (toolCall.tool === 'searchConfluenceUsingCql') {
        return await this.searchConfluenceUsingCql(toolCall.parameters);
      } else if (toolCall.tool === 'getConfluencePage') {
        return await this.getConfluencePage(toolCall.parameters);
      } else {
        throw new Error(`Unknown tool: ${toolCall.tool}`);
      }
    } catch (error: any) {
      logger.error('Confluence API call failed', {
        tool: toolCall.tool,
        error: error.message,
      });

      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }

  /**
   * Search Confluence using CQL (Confluence Query Language)
   */
  private async searchConfluenceUsingCql(params: any): Promise<MCPToolResult> {
    const { cql, limit = 10 } = params;

    logger.debug('Searching Confluence with CQL', { cql, limit });

    try {
      // URL encode the CQL query
      const encodedCql = encodeURIComponent(cql);
      // Use body.storage for full page content
      const url = `${this.instanceUrl}/wiki/rest/api/content/search?cql=${encodedCql}&limit=${limit}&expand=body.storage,space`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Confluence search failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      logger.info('Confluence search successful', {
        resultCount: data.results?.length || 0,
        cql,
      });

      return {
        success: true,
        data: data,
      };
    } catch (error: any) {
      logger.error('Confluence CQL search failed', { error: error.message, cql });
      throw error;
    }
  }

  /**
   * Get a specific Confluence page by ID
   */
  private async getConfluencePage(params: any): Promise<MCPToolResult> {
    const { pageId } = params;

    logger.debug('Fetching Confluence page', { pageId });

    try {
      const url = `${this.instanceUrl}/wiki/rest/api/content/${pageId}?expand=body.storage,space`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Confluence page not found: ${pageId}`);
        }
        throw new Error(`Confluence page fetch failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      logger.info('Confluence page retrieved', { pageId, title: data.title });

      return {
        success: true,
        data: data,
      };
    } catch (error: any) {
      logger.error('Confluence page fetch failed', { error: error.message, pageId });
      throw error;
    }
  }

  /**
   * Disconnect from Confluence (no-op for direct API)
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info('Confluence API client disconnected');
  }
}

// Singleton instance
let confluenceClient: ConfluenceMCPClient | null = null;

/**
 * Get or create Confluence client instance
 */
export function getConfluenceMCPClient(): ConfluenceMCPClient {
  if (!confluenceClient) {
    confluenceClient = new ConfluenceMCPClient();
  }
  return confluenceClient;
}

/**
 * Initialize Confluence client on server startup
 */
export async function initializeConfluenceMCP(): Promise<void> {
  const client = getConfluenceMCPClient();

  if (!client.isConfigured()) {
    logger.info('Confluence not configured - documentation will use code analysis only');
    logger.info('To enable Confluence: Set ATLASSIAN_INSTANCE_URL, ATLASSIAN_USERNAME, ATLASSIAN_API_TOKEN in .env');
    return;
  }

  try {
    await client.connect();
    logger.info('Confluence integration enabled and ready');
  } catch (error: any) {
    logger.warn('Failed to initialize Confluence client', {
      error: error.message,
      message: 'Confluence integration will not be available - documentation will use code analysis only',
    });
  }
}

/**
 * Shutdown Confluence client
 */
export async function shutdownConfluenceMCP(): Promise<void> {
  if (confluenceClient) {
    await confluenceClient.disconnect();
    confluenceClient = null;
  }
}
