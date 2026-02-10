/**
 * Markdown formatting utilities using the remark ecosystem
 * Provides AST-based markdown generation for structured documentation
 */

import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Paragraph, List } from 'mdast';

/**
 * Parse markdown string to AST
 */
export function parseMarkdown(content: string): Root {
  return unified().use(remarkParse).parse(content);
}

/**
 * Convert markdown AST to string
 */
export function stringifyMarkdown(ast: Root): string {
  return unified()
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '_',
      strong: '*',
      fences: true,
      incrementListMarker: true,
    })
    .stringify(ast);
}

/**
 * Extract content from a section under a heading
 * Used for parsing CLAUDE.md structure
 */
export function extractSectionContent(ast: Root, headingText: string): string | null {
  let inSection = false;
  const contentNodes: any[] = [];

  visit(ast, (node) => {
    if (node.type === 'heading') {
      const heading = node as Heading;
      const text = heading.children
        .filter((child) => child.type === 'text')
        .map((child: any) => child.value)
        .join(' ')
        .toLowerCase();

      if (text.includes(headingText.toLowerCase())) {
        inSection = true;
        return;
      } else if (inSection) {
        // Hit next heading, stop
        inSection = false;
        return 'skip';
      }
    }

    if (inSection && node.type !== 'heading') {
      contentNodes.push(node);
    }
  });

  if (contentNodes.length === 0) {
    return null;
  }

  // Build mini AST with just the content nodes
  const contentAST: Root = {
    type: 'root',
    children: contentNodes,
  };

  return stringifyMarkdown(contentAST).trim();
}

/**
 * Scan markdown content for implementation details
 * Returns detected framework/language keywords
 */
export function detectImplementationDetails(content: string): string[] {
  const detectedDetails: string[] = [];

  // Framework keywords
  const frameworks = [
    'express',
    'fastify',
    'nest',
    'react',
    'vue',
    'angular',
    'django',
    'flask',
    'spring',
    'rails',
  ];

  // Language-specific keywords
  const languageKeywords = [
    'typescript',
    'javascript',
    'python',
    'java',
    'kotlin',
    'go',
    'rust',
    'c++',
    'c#',
    'swift',
  ];

  // Database-specific keywords
  const databases = ['mongodb', 'postgresql', 'mysql', 'redis', 'dynamodb', 'cassandra'];

  const contentLower = content.toLowerCase();

  for (const framework of frameworks) {
    if (contentLower.includes(framework.toLowerCase())) {
      detectedDetails.push(`Framework: ${framework}`);
    }
  }

  for (const lang of languageKeywords) {
    if (contentLower.includes(lang.toLowerCase())) {
      detectedDetails.push(`Language: ${lang}`);
    }
  }

  for (const db of databases) {
    if (contentLower.includes(db.toLowerCase())) {
      detectedDetails.push(`Database: ${db}`);
    }
  }

  return detectedDetails;
}

/**
 * Validate that markdown content contains required sections
 * Returns list of missing sections
 */
export function validateRequiredSections(content: string): string[] {
  const requiredSections = [
    'business rules',
    'program flows',
    'domain models',
    'contracts',
    'user stories',
    'invariants',
  ];

  const ast = parseMarkdown(content);
  const foundSections: string[] = [];

  visit(ast, 'heading', (node: Heading) => {
    const headingText = node.children
      .filter((child) => child.type === 'text')
      .map((child: any) => child.value)
      .join(' ')
      .toLowerCase();

    for (const section of requiredSections) {
      if (headingText.includes(section) && !foundSections.includes(section)) {
        foundSections.push(section);
      }
    }
  });

  const missingSections = requiredSections.filter((section) => !foundSections.includes(section));
  return missingSections;
}
