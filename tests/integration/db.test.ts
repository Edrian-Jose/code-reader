import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  connectToDatabase,
  disconnectFromDatabase,
  getDatabase,
  isConnected
} from '../../src/db/client.js';
import { resetConfig } from '../../src/config/index.js';

describe('MongoDB Connection', () => {
  beforeAll(async () => {
    resetConfig();
  });

  afterAll(async () => {
    await disconnectFromDatabase();
  });

  it('should connect to MongoDB', async () => {
    const db = await connectToDatabase();
    expect(db).toBeDefined();
  });

  it('should return same database instance on subsequent calls', async () => {
    const db1 = await connectToDatabase();
    const db2 = await connectToDatabase();
    expect(db1).toBe(db2);
  });

  it('should report connection status', async () => {
    await connectToDatabase();
    const connected = await isConnected();
    expect(connected).toBe(true);
  });

  it('should be able to ping the database', async () => {
    const db = await connectToDatabase();
    const result = await db.command({ ping: 1 });
    expect(result.ok).toBe(1);
  });

  it('should get database after connection', async () => {
    await connectToDatabase();
    const db = getDatabase();
    expect(db).toBeDefined();
    expect(db.databaseName).toBe('code_reader');
  });
});
