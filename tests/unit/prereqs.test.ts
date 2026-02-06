import { describe, it, expect } from '@jest/globals';
import { checkNodeVersion } from '../../scripts/check-prereqs.js';

describe('Prerequisite Checker', () => {
  describe('checkNodeVersion', () => {
    it('should pass for Node.js version >= 18', () => {
      const result = checkNodeVersion();

      // Current runtime must be >= 18 since that's in package.json engines
      expect(result.status).toBe('PASS');
      expect(result.name).toBe('Node.js Version');
      expect(result.message).toContain('meets requirement');
      expect(result.details).toBeDefined();
    });

    it('should include current version in details', () => {
      const result = checkNodeVersion();

      expect(result.details).toBe(process.version);
    });

    it('should validate Node.js version format', () => {
      const result = checkNodeVersion();
      const currentVersion = process.version;

      // Version should start with 'v' and contain numbers
      expect(currentVersion).toMatch(/^v\d+\.\d+\.\d+/);

      // Extract major version
      const majorVersion = parseInt(currentVersion.slice(1).split('.')[0], 10);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });
  });

  // Note: MongoDB connection tests are integration tests and should be in tests/integration
  // They require a running MongoDB instance
});
