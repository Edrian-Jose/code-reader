#!/usr/bin/env tsx

import { MongoClient } from 'mongodb';
import { getConfig } from '../src/config/index.js';

interface PrerequisiteResult {
  name: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: string;
}

/**
 * Check Node.js version (must be >= 18)
 */
function checkNodeVersion(): PrerequisiteResult {
  const requiredMajor = 18;
  const currentVersion = process.version;
  const majorVersion = parseInt(currentVersion.slice(1).split('.')[0], 10);

  if (majorVersion >= requiredMajor) {
    return {
      name: 'Node.js Version',
      status: 'PASS',
      message: `Node.js ${currentVersion} meets requirement (>= ${requiredMajor})`,
      details: currentVersion,
    };
  }

  return {
    name: 'Node.js Version',
    status: 'FAIL',
    message: `Node.js ${currentVersion} does not meet requirement (>= ${requiredMajor})`,
    details: `Current: ${currentVersion}, Required: >= ${requiredMajor}.x.x`,
  };
}

/**
 * Check MongoDB connectivity
 */
async function checkMongoDBConnection(): Promise<PrerequisiteResult> {
  let client: MongoClient | null = null;

  try {
    const config = getConfig();
    const uri = config.mongodb.uri;
    const database = config.mongodb.database;

    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    await client.connect();
    const db = client.db(database);
    await db.command({ ping: 1 });

    return {
      name: 'MongoDB Connection',
      status: 'PASS',
      message: `Successfully connected to MongoDB at ${uri}`,
      details: `Database: ${database}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      name: 'MongoDB Connection',
      status: 'FAIL',
      message: 'Failed to connect to MongoDB',
      details: errorMessage,
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Run all prerequisite checks
 */
async function runPrerequisiteChecks(): Promise<void> {
  console.log('Checking prerequisites for Code Reader MCP System...\n');

  const results: PrerequisiteResult[] = [];

  // Check Node.js version
  results.push(checkNodeVersion());

  // Check MongoDB connection
  results.push(await checkMongoDBConnection());

  // Display results
  console.log('='.repeat(80));
  console.log('PREREQUISITE CHECK RESULTS');
  console.log('='.repeat(80));
  console.log('');

  let allPassed = true;
  for (const result of results) {
    const statusIcon = result.status === 'PASS' ? '✓' : '✗';
    const statusText = result.status === 'PASS' ? 'PASS' : 'FAIL';

    console.log(`${statusIcon} ${result.name}: ${statusText}`);
    console.log(`  ${result.message}`);
    if (result.details) {
      console.log(`  Details: ${result.details}`);
    }
    console.log('');

    if (result.status === 'FAIL') {
      allPassed = false;
    }
  }

  console.log('='.repeat(80));

  if (allPassed) {
    console.log('✓ All prerequisites passed. System is ready to run.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. npm run db:init     - Initialize database collections and indexes');
    console.log('  2. npm run dev         - Start development server');
    console.log('  3. npm test            - Run test suite');
    process.exit(0);
  } else {
    console.log('✗ Some prerequisites failed. Please address the issues above.');
    console.log('');
    console.log('Common solutions:');
    console.log('  - Node.js: Install Node.js 18 or higher from https://nodejs.org/');
    console.log('  - MongoDB: Start MongoDB with: mongod --dbpath /path/to/data');
    process.exit(1);
  }
}

// Export for testing
export { checkNodeVersion, checkMongoDBConnection, runPrerequisiteChecks };

// Run checks if executed directly (not imported as a module)
// Check if this file is being run directly vs imported
const isMainModule = process.argv[1] && process.argv[1].includes('check-prereqs');

if (isMainModule) {
  runPrerequisiteChecks().catch((error) => {
    console.error('Unexpected error during prerequisite checks:', error);
    process.exit(1);
  });
}
