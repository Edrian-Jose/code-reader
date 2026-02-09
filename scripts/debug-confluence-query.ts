/**
 * Debug script to test Confluence CQL queries and see raw results
 *
 * Usage: npm run debug:confluence "text ~ \"Pattern\" AND text ~ \"Builder\""
 */

import 'dotenv/config';
import { initializeConfluenceMCP, getConfluenceMCPClient } from '../src/mcp/confluence-client.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const cqlQuery = process.argv.slice(2).join(' ');

  if (!cqlQuery) {
    console.error('Usage: npm run debug:confluence "<CQL query>"');
    console.error('Example: npm run debug:confluence "text ~ \\"Pattern\\" AND text ~ \\"Builder\\""');
    console.error('Example: npm run debug:confluence "type = page ORDER BY lastModified DESC"');
    process.exit(1);
  }

  console.log(`\n🔍 Debug: Confluence CQL Query\n`);
  console.log(`Query: ${cqlQuery}\n`);

  // Initialize Confluence client
  console.log(`🔗 Initializing Confluence client...`);
  await initializeConfluenceMCP();

  const client = getConfluenceMCPClient();

  if (!client.isConfigured()) {
    console.error(`❌ Confluence not configured`);
    console.error(`   Set ATLASSIAN_INSTANCE_URL, ATLASSIAN_USERNAME, ATLASSIAN_API_TOKEN in .env`);
    process.exit(1);
  }

  console.log(`✅ Confluence client ready\n`);

  // Execute query
  console.log(`📡 Executing CQL query...`);

  try {
    const result = await client.executeTool({
      type: 'tool_call',
      tool: 'searchConfluenceUsingCql',
      parameters: {
        cloudId: '', // Not used in direct API
        cql: cqlQuery,
        limit: 10,
      },
    });

    if (!result.success) {
      console.error(`❌ Query failed: ${result.error}`);
      process.exit(1);
    }

    console.log(`✅ Query successful\n`);

    // Display results
    const data = result.data;
    console.log(`📊 RESULTS (${data.results?.length || 0} pages):\n`);
    console.log(`${'='.repeat(80)}\n`);

    if (data.results && data.results.length > 0) {
      data.results.forEach((page: any, idx: number) => {
        console.log(`[${idx + 1}] ${page.title || page.content?.title || 'Untitled'}`);
        console.log(`    ID: ${page.id || page.content?.id || 'unknown'}`);
        console.log(`    Type: ${page.type || page.content?.type || 'unknown'}`);
        console.log(`    Space: ${page.space?.key || page.content?.space?.key || 'unknown'}`);

        // Show excerpt if available
        if (page.excerpt) {
          console.log(`    Excerpt: ${page.excerpt.substring(0, 200)}...`);
        } else if (page.content?.excerpt) {
          console.log(`    Excerpt: ${page.content.excerpt.substring(0, 200)}...`);
        } else {
          console.log(`    Excerpt: (not available)`);
        }

        // Show body if available
        if (page.body?.storage?.value) {
          console.log(`    Body length: ${page.body.storage.value.length} chars`);
        } else if (page.content?.body?.storage?.value) {
          console.log(`    Body length: ${page.content.body.storage.value.length} chars`);
        }

        console.log();
      });
    } else {
      console.log(`No results found.\n`);
    }

    console.log(`${'='.repeat(80)}\n`);

    // Show raw JSON structure for debugging
    console.log(`📄 RAW JSON STRUCTURE:\n`);
    console.log(JSON.stringify(data, null, 2).substring(0, 2000));
    console.log(`\n... (truncated)\n`);
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
