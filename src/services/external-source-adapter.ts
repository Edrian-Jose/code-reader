/**
 * External Source Adapter Service
 * Integrates external documentation sources (Confluence) via MCP tool calls
 * Implements timeout, retry, and graceful degradation patterns
 */

import { logger } from '../utils/logger.js';
import type { ExternalSourceConfig } from '../models/external-source-config.js';

/**
 * Confluence query result
 */
export interface ConfluenceResult {
  pageId: string;
  title: string;
  content: string;
  spaceKey: string;
  url: string;
}

/**
 * External source query response
 */
export interface ExternalSourceResponse {
  success: boolean;
  results: ConfluenceResult[];
  error?: string;
  source: 'confluence';
  queryTime: number;
}

/**
 * MCP tool call for Confluence search
 */
interface ConfluenceMCPToolCall {
  type: 'tool_call';
  tool: 'searchConfluenceUsingCql' | 'getConfluencePage';
  parameters: {
    cloudId: string;
    cql?: string;
    pageId?: string;
  };
}

/**
 * Query Confluence using CQL (Confluence Query Language) via MCP tool call
 * Implements timeout (30s) and retry (2 attempts with exponential backoff)
 */
export async function queryConfluence(
  config: ExternalSourceConfig,
  cqlQuery: string
): Promise<ExternalSourceResponse> {
  const startTime = Date.now();

  logger.info('Querying Confluence via MCP tool call', {
    cloudId: config.connectionParams.cloudId,
    cqlQuery,
  });

  const toolCall: ConfluenceMCPToolCall = {
    type: 'tool_call',
    tool: 'searchConfluenceUsingCql',
    parameters: {
      cloudId: config.connectionParams.cloudId,
      cql: cqlQuery,
    },
  };

  try {
    // Attempt query with timeout and retry
    const result = await executeWithTimeoutAndRetry(toolCall, 30000, 2);

    const queryTime = Date.now() - startTime;

    logger.info('Confluence query successful', {
      resultCount: result.length,
      queryTime: `${queryTime}ms`,
    });

    return {
      success: true,
      results: result,
      source: 'confluence',
      queryTime,
    };
  } catch (error: any) {
    const queryTime = Date.now() - startTime;

    logger.warn('Confluence query failed after retries', {
      error: error.message,
      queryTime: `${queryTime}ms`,
      cqlQuery,
    });

    // Graceful degradation - return empty results with error marker
    return {
      success: false,
      results: [],
      error: error.message,
      source: 'confluence',
      queryTime,
    };
  }
}

/**
 * Get specific Confluence page by ID
 */
export async function getConfluencePage(
  config: ExternalSourceConfig,
  pageId: string
): Promise<ExternalSourceResponse> {
  const startTime = Date.now();

  logger.info('Fetching Confluence page via MCP tool call', {
    cloudId: config.connectionParams.cloudId,
    pageId,
  });

  const toolCall: ConfluenceMCPToolCall = {
    type: 'tool_call',
    tool: 'getConfluencePage',
    parameters: {
      cloudId: config.connectionParams.cloudId,
      pageId,
    },
  };

  try {
    const result = await executeWithTimeoutAndRetry(toolCall, 30000, 2);

    const queryTime = Date.now() - startTime;

    logger.info('Confluence page retrieved', {
      pageId,
      queryTime: `${queryTime}ms`,
    });

    return {
      success: true,
      results: result,
      source: 'confluence',
      queryTime,
    };
  } catch (error: any) {
    const queryTime = Date.now() - startTime;

    logger.warn('Confluence page fetch failed', {
      error: error.message,
      pageId,
      queryTime: `${queryTime}ms`,
    });

    return {
      success: false,
      results: [],
      error: error.message,
      source: 'confluence',
      queryTime,
    };
  }
}

/**
 * Execute MCP tool call with timeout and exponential backoff retry
 *
 * Timeout: 30 seconds
 * Retries: 2 attempts (total 3 tries)
 * Backoff: 1s, 2s delays
 */
async function executeWithTimeoutAndRetry(
  toolCall: ConfluenceMCPToolCall,
  timeoutMs: number,
  maxRetries: number
): Promise<ConfluenceResult[]> {
  let lastError: Error | null = null;
  const delays = [1000, 2000]; // Exponential backoff: 1s, 2s

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute with timeout
      const result = await executeWithTimeout(toolCall, timeoutMs);
      return result; // Success - return immediately
    } catch (error: any) {
      lastError = error;

      logger.warn('MCP tool call attempt failed', {
        attempt: attempt + 1,
        maxAttempts: maxRetries + 1,
        error: error.message,
        tool: toolCall.tool,
      });

      // If not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const delayMs = delays[attempt];
        logger.info('Retrying after delay', { delayMs, nextAttempt: attempt + 2 });
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted
  throw new Error(`MCP tool call failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Execute MCP tool call with timeout protection
 */
async function executeWithTimeout(
  toolCall: ConfluenceMCPToolCall,
  timeoutMs: number
): Promise<ConfluenceResult[]> {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`MCP tool call timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Simulate MCP tool call execution
    // In production, this would call the actual MCP client SDK
    executeMCPToolCall(toolCall)
      .then((result) => {
        clearTimeout(timeoutHandle);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

/**
 * Execute MCP tool call via MCP client SDK
 *
 * Calls the Confluence MCP server subprocess to query Confluence.
 * The MCP client handles authentication delegation, so this service never touches credentials.
 */
async function executeMCPToolCall(toolCall: ConfluenceMCPToolCall): Promise<ConfluenceResult[]> {
  const { getConfluenceMCPClient } = await import('../mcp/confluence-client.js');
  const mcpClient = getConfluenceMCPClient();

  if (!mcpClient.isConfigured()) {
    logger.warn('Confluence MCP client not configured', {
      tool: toolCall.tool,
      message: 'Set ATLASSIAN_INSTANCE_URL, ATLASSIAN_USERNAME, ATLASSIAN_API_TOKEN environment variables',
    });
    throw new Error('[EXTERNAL SOURCE UNAVAILABLE] Confluence MCP client not configured');
  }

  try {
    // Execute tool via MCP client
    const result = await mcpClient.executeTool(toolCall);

    if (!result.success) {
      throw new Error(result.error || 'MCP tool call failed');
    }

    // Parse Confluence results
    return parseConfluenceResults(result.data, toolCall.tool);
  } catch (error: any) {
    logger.error('MCP tool call failed', {
      tool: toolCall.tool,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Parse Confluence API results into ConfluenceResult format
 */
function parseConfluenceResults(data: any, tool: string): ConfluenceResult[] {
  if (!data) {
    return [];
  }

  // Handle searchConfluenceUsingCql response
  if (tool === 'searchConfluenceUsingCql') {
    const results = data.results || [];
    return results.map((item: any) => ({
      pageId: item.content?.id || item.id || '',
      title: item.content?.title || item.title || 'Untitled',
      content: extractContent(item),
      spaceKey: item.content?.space?.key || item.space?.key || '',
      url: item.content?._links?.webui || item.url || '',
    }));
  }

  // Handle getConfluencePage response
  if (tool === 'getConfluencePage') {
    return [
      {
        pageId: data.id || '',
        title: data.title || 'Untitled',
        content: extractContent(data),
        spaceKey: data.space?.key || '',
        url: data._links?.webui || '',
      },
    ];
  }

  return [];
}

/**
 * Extract text content from Confluence page data
 * Uses full page content for comprehensive analysis
 */
function extractContent(item: any): string {
  // Try body.storage.value first (full HTML content)
  if (item.body?.storage?.value) {
    return stripHtml(item.body.storage.value);
  }

  // Try content.body.storage.value (nested structure)
  if (item.content?.body?.storage?.value) {
    return stripHtml(item.content.body.storage.value);
  }

  // Try body.view.value (rendered HTML)
  if (item.body?.view?.value) {
    return stripHtml(item.body.view.value);
  }

  // Fallback to excerpt if full content not available
  if (item.excerpt) {
    return stripHtml(item.excerpt);
  }

  if (item.content?.excerpt) {
    return stripHtml(item.content.excerpt);
  }

  // Fallback to empty
  return '';
}

/**
 * Strip HTML tags from Confluence content
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp;
    .replace(/&amp;/g, '&') // Replace &amp;
    .replace(/&lt;/g, '<') // Replace &lt;
    .replace(/&gt;/g, '>') // Replace &gt;
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if external source is available
 * Used to determine if enrichment should be attempted
 */
export function isExternalSourceAvailable(config: ExternalSourceConfig | null): boolean {
  if (!config) {
    return false;
  }

  if (config.sourceType === 'confluence') {
    // Check if cloudId is configured
    return !!config.connectionParams.cloudId;
  }

  return false;
}

/**
 * Generate Confluence CQL query for domain documentation
 */
export function buildConfluenceCQLQuery(domain: string, repositoryName?: string): string {
  // Build CQL query to find relevant Confluence pages
  // Reference: https://developer.atlassian.com/cloud/confluence/advanced-searching-using-cql/

  if (repositoryName) {
    return `text ~ "${domain}" AND (text ~ "${repositoryName}" OR space = "${repositoryName}") AND type = page`;
  }

  return `text ~ "${domain}" AND type = page`;
}
