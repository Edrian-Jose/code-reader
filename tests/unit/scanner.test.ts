import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileScanner } from '../../src/services/scanner.js';
import { DEFAULT_TASK_CONFIG } from '../../src/models/task.js';

describe('FileScanner', () => {
  let scanner: FileScanner;
  let tempDir: string;

  beforeEach(() => {
    scanner = new FileScanner();
    tempDir = mkdtempSync(join(tmpdir(), 'scanner-test-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should scan files with supported extensions', async () => {
    // Create test files
    writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;');
    writeFileSync(join(tempDir, 'test.js'), 'var x = 1;');
    writeFileSync(join(tempDir, 'test.py'), 'x = 1');

    const result = await scanner.scan(tempDir, DEFAULT_TASK_CONFIG);

    expect(result.files).toHaveLength(3);
    expect(result.files.map((f) => f.extension)).toContain('.ts');
    expect(result.files.map((f) => f.extension)).toContain('.js');
    expect(result.files.map((f) => f.extension)).toContain('.py');
  });

  it('should exclude files with unsupported extensions', async () => {
    writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;');
    writeFileSync(join(tempDir, 'test.exe'), 'binary');
    writeFileSync(join(tempDir, 'test.dll'), 'binary');

    const result = await scanner.scan(tempDir, DEFAULT_TASK_CONFIG);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].extension).toBe('.ts');
  });

  it('should exclude node_modules directory', async () => {
    mkdirSync(join(tempDir, 'node_modules'), { recursive: true });
    writeFileSync(join(tempDir, 'test.ts'), 'const x = 1;');
    writeFileSync(join(tempDir, 'node_modules', 'dep.ts'), 'const y = 2;');

    const result = await scanner.scan(tempDir, DEFAULT_TASK_CONFIG);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('test.ts');
  });

  it('should skip files exceeding max size', async () => {
    // Create a large file (over 1MB)
    const largeContent = 'x'.repeat(2 * 1024 * 1024);
    writeFileSync(join(tempDir, 'large.ts'), largeContent);
    writeFileSync(join(tempDir, 'small.ts'), 'const x = 1;');

    const result = await scanner.scan(tempDir, DEFAULT_TASK_CONFIG);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('small.ts');
    expect(result.skippedFiles).toHaveLength(1);
    expect(result.skippedFiles[0].path).toBe('large.ts');
  });

  it('should skip empty files', async () => {
    writeFileSync(join(tempDir, 'empty.ts'), '');
    writeFileSync(join(tempDir, 'content.ts'), 'const x = 1;');

    const result = await scanner.scan(tempDir, DEFAULT_TASK_CONFIG);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('content.ts');
  });

  it('should divide files into batches', () => {
    const files = [
      { filePath: '/a', relativePath: 'a', size: 100, extension: '.ts' },
      { filePath: '/b', relativePath: 'b', size: 100, extension: '.ts' },
      { filePath: '/c', relativePath: 'c', size: 100, extension: '.ts' },
      { filePath: '/d', relativePath: 'd', size: 100, extension: '.ts' },
      { filePath: '/e', relativePath: 'e', size: 100, extension: '.ts' },
    ];

    const batches = scanner.divideBatches(files, 2);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(2);
    expect(batches[1]).toHaveLength(2);
    expect(batches[2]).toHaveLength(1);
  });
});
