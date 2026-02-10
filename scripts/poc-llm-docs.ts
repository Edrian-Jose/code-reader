#!/usr/bin/env tsx

/**
 * PROOF OF CONCEPT: LLM-Powered Documentation Generation
 *
 * This demonstrates the CORRECT approach using GPT-4 to analyze code and generate
 * meaningful, insightful documentation rather than just extracting file paths.
 *
 * Usage: tsx scripts/poc-llm-docs.ts <repository-identifier> <domain-name>
 * Example: tsx scripts/poc-llm-docs.ts code-reader "Task Management"
 */

import OpenAI from 'openai';
import { connectToDatabase, disconnectFromDatabase } from '../src/db/client.js';
import { searchService } from '../src/services/search.js';
import { taskService } from '../src/services/task.js';
import { logger } from '../src/utils/logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DocumentationResult {
  domain: string;
  businessRules: Array<{
    name: string;
    description: string;
    rationale: string;
    codeReference: string;
  }>;
  programFlows: Array<{
    name: string;
    description: string;
    steps: string[];
    codeReference: string;
  }>;
  domainModels: Array<{
    name: string;
    description: string;
    attributes: Array<{ name: string; type: string; purpose: string }>;
    lifecycleRules: string[];
    codeReference: string;
  }>;
  contracts: Array<{
    name: string;
    purpose: string;
    inputs: string[];
    outputs: string[];
    guarantees: string[];
    codeReference: string;
  }>;
  architecturalInsights: string[];
  designPatterns: string[];
}

/**
 * Step 1: Gather comprehensive code context for a domain
 */
async function gatherDomainCode(repositoryId: string, domain: string): Promise<string[]> {
  logger.info('Gathering code for domain analysis', { domain });

  const task = await taskService.getByIdentifier(repositoryId);
  if (!task) {
    throw new Error(`Repository not found: ${repositoryId}`);
  }

  // Search for relevant code with multiple targeted queries
  const queries = [
    `${domain} service implementation business logic`,
    `${domain} model entity data structure`,
    `${domain} workflow process flow`,
    `${domain} validation rules constraints`,
    `${domain} API endpoint interface`,
  ];

  const allChunks = new Set<string>();

  for (const query of queries) {
    try {
      const results = await searchService.search({
        query,
        taskId: task.taskId,
        limit: 10,
        minScore: 0.6,
      });

      for (const result of results) {
        // Include file path and line numbers for reference
        const chunkWithContext = `
FILE: ${result.filePath} (lines ${result.startLine}-${result.endLine})
RELEVANCE: ${(result.score * 100).toFixed(1)}%

${result.content}
`;
        allChunks.add(chunkWithContext);
      }
    } catch (error) {
      logger.warn('Query failed', { query, error });
    }
  }

  logger.info('Code gathered', { domain, chunkCount: allChunks.size });

  return Array.from(allChunks);
}

/**
 * Step 2: Analyze CLAUDE.md for system context
 */
async function getCLAUDEContext(repositoryId: string): Promise<string> {
  logger.info('Retrieving CLAUDE.md context');

  const task = await taskService.getByIdentifier(repositoryId);
  if (!task) return '';

  try {
    const results = await searchService.search({
      query: 'CLAUDE.md system architecture overview purpose',
      taskId: task.taskId,
      limit: 5,
      minScore: 0.5,
    });

    const claudeContent = results
      .sort((a, b) => a.startLine - b.startLine)
      .map((r) => r.content)
      .join('\n\n');

    logger.info('CLAUDE.md context retrieved', { length: claudeContent.length });

    return claudeContent;
  } catch (error) {
    logger.warn('CLAUDE.md not found or inaccessible');
    return '';
  }
}

/**
 * Step 3: Use GPT-4 to analyze and document the domain
 * THIS IS THE KEY DIFFERENCE - ACTUAL AI ANALYSIS, NOT KEYWORD MATCHING
 */
async function analyzeWithLLM(
  domain: string,
  codeChunks: string[],
  claudeContext: string
): Promise<DocumentationResult> {
  logger.info('Starting LLM analysis', { domain, codeChunkCount: codeChunks.length });

  // Build comprehensive analysis prompt
  const prompt = `You are a technical documentation expert specializing in reconstruction-grade documentation.

Your task: Analyze the "${domain}" domain in this codebase and produce detailed, insightful documentation suitable for system reconstruction (v2 rebuild).

CONTEXT FROM CLAUDE.MD:
${claudeContext || 'Not available'}

CODE TO ANALYZE (${codeChunks.length} relevant code chunks):
${codeChunks.slice(0, 15).join('\n\n---\n\n')}

${codeChunks.length > 15 ? `\n(${codeChunks.length - 15} additional chunks omitted for brevity)` : ''}

INSTRUCTIONS:

1. BUSINESS RULES:
   - Identify ACTUAL business rules enforced in the code (not just "validation found in file X")
   - For each rule, explain: WHAT it is, WHY it exists (business rationale), WHAT breaks if violated
   - Reference specific code locations

2. PROGRAM FLOWS:
   - Identify key workflows/processes
   - Explain the CONCEPTUAL flow (not line-by-line code)
   - Describe each step in business terms
   - Note error handling and compensation logic

3. DOMAIN MODELS:
   - Identify core entities and value objects
   - Explain what each represents in business terms
   - Document relationships and lifecycle rules
   - Note state transitions and invariants

4. CONTRACTS & INTERFACES:
   - Identify public APIs, event contracts, integration points
   - Document inputs, outputs, guarantees
   - Explain stability and evolution rules

5. ARCHITECTURAL INSIGHTS:
   - Identify design patterns used
   - Explain architectural decisions
   - Note trade-offs and constraints

CRITICAL REQUIREMENTS:
- Be DETAILED and INSIGHTFUL, not generic
- Focus on WHY, not just WHAT
- Use technology-agnostic language (no framework names unless explaining patterns)
- Make it useful for someone rebuilding the system from scratch
- Include enough detail that a new engineer can understand the domain without seeing code

Return a JSON object matching this structure:
{
  "domain": "${domain}",
  "businessRules": [
    {
      "name": "Descriptive rule name",
      "description": "What the rule enforces in detail",
      "rationale": "Why this rule exists (business need)",
      "codeReference": "Which file/function implements it"
    }
  ],
  "programFlows": [
    {
      "name": "Workflow name",
      "description": "What this flow accomplishes",
      "steps": ["Step 1 description", "Step 2 description", ...],
      "codeReference": "Where this is implemented"
    }
  ],
  "domainModels": [
    {
      "name": "Entity name",
      "description": "What this entity represents",
      "attributes": [
        {"name": "attr", "type": "business type", "purpose": "why it exists"}
      ],
      "lifecycleRules": ["Creation rule", "State transition rule", ...],
      "codeReference": "Where defined"
    }
  ],
  "contracts": [
    {
      "name": "API/Interface name",
      "purpose": "What this contract enables",
      "inputs": ["Input description with business meaning"],
      "outputs": ["Output description with business meaning"],
      "guarantees": ["What this contract promises"],
      "codeReference": "Where defined"
    }
  ],
  "architecturalInsights": [
    "Insight about design decisions, patterns, trade-offs"
  ],
  "designPatterns": [
    "Pattern name and how it's applied"
  ]
}`;

  try {
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are a technical documentation expert. Analyze code deeply and produce detailed, insightful documentation. Focus on business logic, conceptual flows, and architectural understanding. Avoid shallow descriptions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Low temperature for consistency
      response_format: { type: 'json_object' },
    });

    const analysisTime = Date.now() - startTime;

    logger.info('LLM analysis complete', {
      domain,
      analysisTime: `${analysisTime}ms`,
      tokensUsed: completion.usage?.total_tokens,
    });

    // Parse response, handling markdown code fences
    let responseContent = completion.choices[0].message.content || '{}';

    // Strip markdown code fences if present
    responseContent = responseContent.replace(/^```json\s*/m, '').replace(/\s*```$/m, '');

    const result = JSON.parse(responseContent);

    return result as DocumentationResult;
  } catch (error: any) {
    logger.error('LLM analysis failed', { error: error.message });
    throw error;
  }
}

/**
 * Main POC workflow
 */
async function generateDocumentationPOC() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: tsx scripts/poc-llm-docs.ts <repository-identifier> <domain-name>');
    console.error('Example: tsx scripts/poc-llm-docs.ts code-reader "Task Management"');
    process.exit(1);
  }

  const [repositoryId, domain] = args;

  console.log('\n🔬 PROOF OF CONCEPT: LLM-Powered Documentation Generation\n');
  console.log(`Repository: ${repositoryId}`);
  console.log(`Domain: ${domain}\n`);

  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await connectToDatabase();
    console.log('   ✓ Database connected\n');

    // Step 1: Gather code chunks
    console.log('📚 Step 1: Gathering code chunks...');
    const codeChunks = await gatherDomainCode(repositoryId, domain);
    console.log(`   ✓ Gathered ${codeChunks.length} relevant code chunks\n`);

    // Step 2: Get CLAUDE.md context
    console.log('📄 Step 2: Retrieving CLAUDE.md context...');
    const claudeContext = await getCLAUDEContext(repositoryId);
    console.log(`   ✓ Retrieved ${claudeContext.length} characters of context\n`);

    // Step 3: Analyze with GPT-4
    console.log('🤖 Step 3: Analyzing with GPT-4 (this may take 30-60 seconds)...');
    const documentation = await analyzeWithLLM(domain, codeChunks, claudeContext);
    console.log('   ✓ Analysis complete!\n');

    // Step 4: Display results
    console.log('=' .repeat(80));
    console.log(`DOCUMENTATION FOR DOMAIN: ${documentation.domain}`);
    console.log('='.repeat(80));
    console.log();

    console.log('📋 BUSINESS RULES:');
    console.log('-'.repeat(80));
    for (const rule of documentation.businessRules || []) {
      console.log(`\n▸ ${rule.name}`);
      console.log(`  Description: ${rule.description}`);
      console.log(`  Rationale: ${rule.rationale}`);
      console.log(`  Code: ${rule.codeReference}`);
    }

    console.log('\n\n🔄 PROGRAM FLOWS:');
    console.log('-'.repeat(80));
    for (const flow of documentation.programFlows || []) {
      console.log(`\n▸ ${flow.name}`);
      console.log(`  ${flow.description}`);
      console.log(`  Steps:`);
      flow.steps?.forEach((step, i) => console.log(`    ${i + 1}. ${step}`));
      console.log(`  Code: ${flow.codeReference}`);
    }

    console.log('\n\n🏗️  DOMAIN MODELS:');
    console.log('-'.repeat(80));
    for (const model of documentation.domainModels || []) {
      console.log(`\n▸ ${model.name}`);
      console.log(`  ${model.description}`);
      console.log(`  Attributes:`);
      model.attributes?.forEach((attr) => {
        console.log(`    - ${attr.name} (${attr.type}): ${attr.purpose}`);
      });
      if (model.lifecycleRules && model.lifecycleRules.length > 0) {
        console.log(`  Lifecycle:`);
        model.lifecycleRules.forEach((rule) => console.log(`    - ${rule}`));
      }
      console.log(`  Code: ${model.codeReference}`);
    }

    console.log('\n\n📡 CONTRACTS & INTERFACES:');
    console.log('-'.repeat(80));
    for (const contract of documentation.contracts || []) {
      console.log(`\n▸ ${contract.name}`);
      console.log(`  Purpose: ${contract.purpose}`);
      console.log(`  Inputs: ${contract.inputs?.join(', ')}`);
      console.log(`  Outputs: ${contract.outputs?.join(', ')}`);
      console.log(`  Guarantees: ${contract.guarantees?.join('; ')}`);
      console.log(`  Code: ${contract.codeReference}`);
    }

    console.log('\n\n💡 ARCHITECTURAL INSIGHTS:');
    console.log('-'.repeat(80));
    for (const insight of documentation.architecturalInsights || []) {
      console.log(`  • ${insight}`);
    }

    console.log('\n\n🎨 DESIGN PATTERNS:');
    console.log('-'.repeat(80));
    for (const pattern of documentation.designPatterns || []) {
      console.log(`  • ${pattern}`);
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ PROOF OF CONCEPT COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log('COMPARISON TO CURRENT BROKEN IMPLEMENTATION:');
    console.log();
    console.log('❌ Current (keyword search + template):');
    console.log('   "Validation Rule identified in src/auth.ts"');
    console.log('   → Tells you NOTHING about what the rule does or why');
    console.log();
    console.log('✅ LLM-Powered (shown above):');
    console.log('   "Session Timeout Rule: Users must reauthenticate after 24h of');
    console.log('   inactivity. Rationale: Minimizes security window for stolen');
    console.log('   tokens. Enforced in SessionManager.validateToken()."');
    console.log('   → Actually explains the rule, reasoning, and implementation');
    console.log();
    console.log('NEXT STEP: Retrofit this LLM approach into the existing system');
    console.log('           (Option A - amend source-synthesizer.ts to use GPT-4)');
    console.log();

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('\nDEBUGGING INFO:');
    console.error(`- Repository ID: ${repositoryId}`);
    console.error(`- Domain: ${domain}`);
    console.error(`- OpenAI API Key set: ${!!process.env.OPENAI_API_KEY}`);
    throw error;
  } finally {
    // Cleanup: disconnect from database
    await disconnectFromDatabase();
  }
}

// Run POC
generateDocumentationPOC().catch((error) => {
  logger.error('POC failed', { error });
  process.exit(1);
});
