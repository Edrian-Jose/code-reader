/**
 * POC: Intelligent Confluence Enrichment with Tag-based Search and GPT Correlation
 *
 * Usage: npm run poc:confluence builder-agent-docs-v3 "System Architecture"
 */

import 'dotenv/config';
import { connectToDatabase } from '../src/db/client.js';
import { getDocumentationPlansCollection, getDocumentationTasksCollection } from '../src/db/documentation-collections.js';
import { searchService } from '../src/services/search.js';
import { taskService } from '../src/services/task.js';
import { queryConfluence } from '../src/services/external-source-adapter.js';
import { initializeConfluenceMCP } from '../src/mcp/confluence-client.js';
import type { ExternalSourceConfig } from '../src/models/external-source-config.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EnrichedItem {
  name: string;
  description: string;
  tags: string[];
  codeReference: string;
  confluence_info?: string;
  confluence_pages?: Array<{
    title: string;
    confidence: number;
    pageId: string;
  }>;
}

interface EnrichedDocumentation {
  businessRules: EnrichedItem[];
  programFlows: EnrichedItem[];
  domainModels: EnrichedItem[];
  contracts: EnrichedItem[];
}

// Configuration: Relevance threshold (0-100)
// Lower = more items get enriched (more permissive)
// Higher = fewer items get enriched (stricter)
const RELEVANCE_THRESHOLD = 75; // 75% confidence = very strict filtering

async function main() {
  const [planIdentifier, domain] = process.argv.slice(2);

  if (!planIdentifier || !domain) {
    console.error('Usage: npm run poc:confluence <plan-identifier> <domain>');
    console.error('Example: npm run poc:confluence builder-agent-docs-v3 "System Architecture"');
    process.exit(1);
  }

  console.log(`\n🔍 POC: Intelligent Confluence Enrichment`);
  console.log(`Plan: ${planIdentifier}`);
  console.log(`Domain: ${domain}`);
  console.log(`Relevance Threshold: ${RELEVANCE_THRESHOLD}% (adjust in script)\n`);

  await connectToDatabase();

  // Initialize Confluence client
  console.log(`🔗 Initializing Confluence client...`);
  await initializeConfluenceMCP();
  console.log(`✅ Confluence client ready\n`);

  // Get plan
  const plansCollection = getDocumentationPlansCollection();
  const plan = await plansCollection.findOne(
    { identifier: planIdentifier },
    { sort: { version: -1 } }
  );

  if (!plan) {
    console.error(`❌ Plan not found: ${planIdentifier}`);
    process.exit(1);
  }

  console.log(`✅ Found plan: ${plan.planId} (version ${plan.version})`);

  // Check if Confluence is configured
  const confluenceConfig = plan.externalSources?.find(
    (src: ExternalSourceConfig) => src.sourceType === 'confluence'
  );

  if (!confluenceConfig) {
    console.error(`❌ Confluence not configured for this plan`);
    console.error(`   Add "externalSources": {"confluence": {"enabled": true, "cloudId": "..."}} when creating plan`);
    process.exit(1);
  }

  console.log(`✅ Confluence configured: ${confluenceConfig.connectionParams.cloudId}\n`);

  // Get task for this domain
  const tasksCollection = getDocumentationTasksCollection();
  const task = await tasksCollection.findOne({ planId: plan.planId, domain });

  if (!task) {
    console.error(`❌ Task not found for domain: ${domain}`);
    process.exit(1);
  }

  console.log(`✅ Found task: ${task.taskId}\n`);

  // Step 1: Gather code chunks using search service
  console.log(`📦 Step 1: Gathering code chunks for "${domain}"...`);
  const extractionTask = await taskService.getByIdentifier(plan.repositoryIdentifier);

  if (!extractionTask) {
    console.error(`❌ Extraction task not found: ${plan.repositoryIdentifier}`);
    process.exit(1);
  }

  const codeChunks = await searchService.search({
    taskId: extractionTask.taskId,
    query: domain,
    limit: 50,
    minScore: 0.3,
  });
  console.log(`   Found ${codeChunks.length} code chunks\n`);

  // Step 2: Get CLAUDE.md context
  console.log(`📄 Step 2: Getting CLAUDE.md context...`);
  const claudeChunks = await searchService.search({
    taskId: extractionTask.taskId,
    query: 'CLAUDE.md architecture',
    limit: 5,
    minScore: 0.5,
  });
  const claudeContext = claudeChunks.map((chunk: any) => chunk.content).join('\n\n');
  console.log(`   Context length: ${claudeContext.length} chars\n`);

  // Step 3: Analyze with LLM (with tags)
  console.log(`🤖 Step 3: Analyzing with GPT-4o (adding tags to each item)...`);
  const llmResult = await analyzeWithLLMWithTags(domain, codeChunks, claudeContext);
  console.log(`   ✅ Analysis complete`);
  console.log(`   - Business Rules: ${llmResult.documentation.businessRules.length}`);
  console.log(`   - Program Flows: ${llmResult.documentation.programFlows.length}`);
  console.log(`   - Domain Models: ${llmResult.documentation.domainModels.length}`);
  console.log(`   - Contracts: ${llmResult.documentation.contracts.length}`);
  console.log(`   - Cost: $${llmResult.cost.toFixed(4)}\n`);

  // Step 4: Enrich with Confluence (tag-based + GPT correlation)
  console.log(`🔗 Step 4: Enriching with Confluence (intelligent correlation)...`);
  const enriched = await enrichWithConfluenceIntelligent(
    llmResult.documentation,
    confluenceConfig,
    RELEVANCE_THRESHOLD
  );

  console.log(`   ✅ Enrichment complete`);
  console.log(`   - Items enriched: ${enriched.enrichedCount}`);
  console.log(`   - Items skipped: ${enriched.skippedCount}`);
  console.log(`   - Confluence cost: $${enriched.totalCost.toFixed(4)}\n`);

  // Step 5: Display results
  console.log(`\n📊 RESULTS:\n`);
  console.log(`${'='.repeat(80)}\n`);

  displayEnrichedDocumentation(enriched.documentation);

  console.log(`\n${'='.repeat(80)}\n`);
  console.log(`💰 Total Cost: $${(llmResult.cost + enriched.totalCost).toFixed(4)}`);
  console.log(`   - Initial Analysis (gpt-4-turbo): $${llmResult.cost.toFixed(4)}`);
  console.log(`   - Confluence Enrichment (gpt-4-turbo): $${enriched.totalCost.toFixed(4)}\n`);

  process.exit(0);
}

/**
 * Analyze with LLM and add tags to each item
 */
async function analyzeWithLLMWithTags(
  domain: string,
  codeChunks: any[],
  claudeContext: string
): Promise<{ documentation: EnrichedDocumentation; cost: number }> {
  const prompt = `You are a technical documentation expert analyzing code to extract business logic.

Domain: ${domain}

CLAUDE.md Context:
${claudeContext.slice(0, 3000)}

Code Chunks (${codeChunks.length} files):
${codeChunks
  .slice(0, 30)
  .map((chunk: any) => `File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n${chunk.content.slice(0, 800)}`)
  .join('\n\n---\n\n')}

Extract the following and **add relevant search tags** for each item:

1. **Business Rules**: Core rules, validations, constraints
2. **Program Flows**: Key workflows, processes
3. **Domain Models**: Data structures, entities
4. **Contracts**: APIs, interfaces, integrations

For EACH item, provide:
- **name**: Brief name (3-5 words)
- **description**: What it does and WHY (2-3 sentences, focus on business rationale)
- **tags**: Array of 2-5 search keywords for finding related Confluence documentation
  (e.g., ["task validation", "input constraints", "business rules"])
- **codeReference**: File path + line number where this is implemented

**IMPORTANT**: Tags should be business/feature-focused, not technical terms.
Good tags: "user authentication", "payment processing", "task assignment"
Bad tags: "function", "class", "variable"

Return ONLY valid JSON in this exact format:
{
  "businessRules": [
    {
      "name": "string",
      "description": "string",
      "tags": ["string", "string"],
      "codeReference": "string"
    }
  ],
  "programFlows": [...],
  "domainModels": [...],
  "contracts": [...]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a technical documentation expert. Analyze code deeply and extract comprehensive business logic. Return ONLY valid JSON with no markdown formatting.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  });

  const content = completion.choices[0].message.content || '{"businessRules":[],"programFlows":[],"domainModels":[],"contracts":[]}';
  const cleanContent = content.replace(/^```json\s*/m, '').replace(/\s*```$/m, '').trim();

  let documentation: EnrichedDocumentation;
  try {
    documentation = JSON.parse(cleanContent);
  } catch (parseError) {
    console.error('Failed to parse LLM response:', cleanContent.slice(0, 200));
    throw parseError;
  }

  const inputTokens = completion.usage?.prompt_tokens || 0;
  const outputTokens = completion.usage?.completion_tokens || 0;
  const cost = (inputTokens / 1_000_000) * 10.0 + (outputTokens / 1_000_000) * 30.0; // gpt-4-turbo pricing

  return { documentation, cost };
}

/**
 * Enrich documentation with Confluence using tag-based search + GPT correlation
 */
async function enrichWithConfluenceIntelligent(
  documentation: EnrichedDocumentation,
  confluenceConfig: ExternalSourceConfig,
  relevanceThreshold: number
): Promise<{ documentation: EnrichedDocumentation; totalCost: number; enrichedCount: number; skippedCount: number }> {
  let totalCost = 0;
  let enrichedCount = 0;
  let skippedCount = 0;

  // Process each category
  for (const category of ['businessRules', 'programFlows', 'domainModels', 'contracts'] as const) {
    const items = documentation[category] as EnrichedItem[];

    console.log(`   📑 Processing ${category}: ${items.length} items`);

    for (const item of items) {
      if (!item.tags || item.tags.length === 0) {
        console.log(`     ⚠️  No tags for: ${item.name}`);
        skippedCount++;
        continue;
      }

      // Build CQL query: combine general tags with each item tag as phrases
      // General tags: "Pattern" and "Builder" (for POC - should come from plan in production)
      const generalTags = ['Pattern', 'Builder'];
      const generalPhrase = generalTags.join(' ').toLowerCase();

      // Create phrase searches: "pattern builder {item_tag}"
      const phraseCql = item.tags
        .map((tag) => `text ~ "${generalPhrase} ${tag.toLowerCase()}"`)
        .join(' OR ');

      // Final query - Confluence orders by relevance automatically for text searches
      // No explicit ORDER BY needed (or use ORDER BY lastModified DESC for recency)
      const cqlQuery = `(${phraseCql}) AND type = page`;

      console.log(`     🔍 Searching: ${item.name}`);
      console.log(`        Phrases: ${item.tags.map((tag) => `"${generalPhrase} ${tag.toLowerCase()}"`).join(', ')}`);

      try {
        // Query Confluence with tag-based search
        const confluenceResponse = await queryConfluence(confluenceConfig, cqlQuery);

        if (!confluenceResponse.success || confluenceResponse.results.length === 0) {
          console.log(`        ℹ️  No Confluence results`);
          skippedCount++;
          continue;
        }

        console.log(`        ✅ Found ${confluenceResponse.results.length} pages`);

        // Correlate with GPT-4 (using relevance threshold)
        const correlationResult = await correlateWithGPT(
          item,
          confluenceResponse.results.slice(0, 3), // Top 3 results only
          relevanceThreshold
        );

        if (correlationResult.relevant && correlationResult.summary) {
          item.confluence_info = correlationResult.summary;
          item.confluence_pages = correlationResult.pageRelevance
            .filter((p) => p.relevant)
            .map((p) => ({
              title: p.title,
              confidence: p.confidence,
              pageId: p.pageId,
            }));
          enrichedCount++;
          totalCost += correlationResult.cost;

          const relevantPages = correlationResult.pageRelevance.filter((p) => p.relevant);
          console.log(`        💡 Enriched! (overall: ${correlationResult.confidence}%, ${relevantPages.length}/${confluenceResponse.results.length} pages, ${correlationResult.summary.length} chars, $${correlationResult.cost.toFixed(4)})`);
          relevantPages.forEach((p) => {
            console.log(`           📄 "${p.title}" (${p.confidence}%)`);
          });
        } else {
          console.log(`        ⊘  Not relevant (confidence: ${correlationResult.confidence}% < ${relevanceThreshold}%)`);
          const skippedPages = correlationResult.pageRelevance.filter((p) => !p.relevant);
          if (skippedPages.length > 0) {
            skippedPages.forEach((p) => {
              console.log(`           ⊗ "${p.title}" (${p.confidence}%)`);
            });
          }
          skippedCount++;
        }

        totalCost += correlationResult.cost;
      } catch (error: any) {
        console.log(`        ❌ Error: ${error.message}`);
        skippedCount++;
      }
    }
  }

  return { documentation, totalCost, enrichedCount, skippedCount };
}

/**
 * Use GPT-4 to correlate Confluence results with documentation item
 * Returns per-page relevance + combined summary
 */
async function correlateWithGPT(
  item: EnrichedItem,
  confluenceResults: any[],
  relevanceThreshold: number
): Promise<{
  relevant: boolean;
  summary: string;
  confidence: number;
  pageRelevance: Array<{
    pageIndex: number;
    title: string;
    pageId: string;
    confidence: number;
    relevant: boolean;
  }>;
  cost: number;
}> {
  const prompt = `Analyze whether Confluence documentation is relevant to this code item.

CODE ITEM:
Name: ${item.name}
Description: ${item.description}
Code Reference: ${item.codeReference}
Tags: ${item.tags.join(', ')}

CONFLUENCE PAGES FOUND:
${confluenceResults
  .map(
    (result: any, idx: number) =>
      `[Page ${idx + 1}] "${result.title}" (ID: ${result.pageId})
Content:
${result.content.slice(0, 2000)}...
`
  )
  .join('\n---\n')}

TASK:
1. For EACH Confluence page above, provide a confidence score (0-100) indicating relevance to this code item
2. Calculate overall confidence (average of relevant pages, or 0 if none relevant)
3. If overall confidence >= ${relevanceThreshold}%: Create a combined summary from ALL relevant pages
   - Write as a SINGLE FLOWING PARAGRAPH (no section headers like "Requirements:", "Business Context:", etc.)
   - Focus on information that DIRECTLY relates to the code item's description
   - Explain WHY this exists, WHAT problems it solves, WHAT constraints/requirements apply
   - Include relevant user stories, acceptance criteria, or business rules if present
   - Keep it comprehensive but natural-sounding (200-400 words)
4. If overall confidence < ${relevanceThreshold}%: Return null summary

Confidence Guidelines (per page):
- 80-100%: Directly describes this specific feature/rule/model
- 60-79%: Related to this item, provides useful context
- 40-59%: Tangentially related, some value
- 20-39%: Vaguely related, minimal value
- 0-19%: Not related

Return ONLY valid JSON:
{
  "pageRelevance": [
    {
      "pageIndex": 0,
      "title": "Page title",
      "pageId": "page-id",
      "confidence": 0-100,
      "relevant": true/false (true if >= ${relevanceThreshold})
    }
  ],
  "overallConfidence": 0-100 (average of relevant pages),
  "relevant": true/false (true if overallConfidence >= ${relevanceThreshold}),
  "summary": "Combined summary from relevant pages" (or null if not relevant)
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: 'You analyze relevance per-page carefully. Be balanced - not too strict, not too permissive. Provide comprehensive, detailed summaries combining all relevant pages. Return ONLY valid JSON, no markdown.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });

  const content =
    completion.choices[0].message.content ||
    '{"pageRelevance":[],"overallConfidence":0,"relevant":false,"summary":null}';
  const cleanContent = content.replace(/^```json\s*/m, '').replace(/\s*```$/m, '').trim();
  const result = JSON.parse(cleanContent);

  const inputTokens = completion.usage?.prompt_tokens || 0;
  const outputTokens = completion.usage?.completion_tokens || 0;
  const cost = (inputTokens / 1_000_000) * 10.0 + (outputTokens / 1_000_000) * 30.0; // gpt-4-turbo pricing

  return {
    confidence: result.overallConfidence || 0,
    relevant: (result.overallConfidence || 0) >= relevanceThreshold,
    summary: result.summary || '',
    pageRelevance: result.pageRelevance || [],
    cost,
  };
}

/**
 * Display enriched documentation
 */
function displayEnrichedDocumentation(doc: EnrichedDocumentation) {
  for (const category of ['businessRules', 'programFlows', 'domainModels', 'contracts'] as const) {
    const items = doc[category] as EnrichedItem[];
    if (items.length === 0) continue;

    console.log(`\n## ${category.toUpperCase().replace(/([A-Z])/g, ' $1').trim()}\n`);

    for (const item of items) {
      console.log(`### ${item.name}`);
      console.log(`**Description**: ${item.description}`);
      console.log(`**Tags**: ${item.tags.join(', ')}`);
      console.log(`**Code**: \`${item.codeReference}\``);

      if (item.confluence_info) {
        console.log(`\n📘 **Confluence Context**:`);
        console.log(`   ${item.confluence_info}`);

        if (item.confluence_pages && item.confluence_pages.length > 0) {
          console.log(`\n   **Sources** (${item.confluence_pages.length} pages):`);
          item.confluence_pages.forEach((page: any) => {
            console.log(`   - "${page.title}" (${page.confidence}% confidence)`);
          });
        }
        console.log();
      } else {
        console.log(`📄 (Code analysis only - no Confluence context)\n`);
      }
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
