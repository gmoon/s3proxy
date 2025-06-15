import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Create require function for testing CommonJS imports in ESM environment
const require = createRequire(import.meta.url);

describe('Package Exports', () => {
  it('should support ESM import from package root', async () => {
    // This tests the package.json "exports" field
    const { S3Proxy } = await import('../dist/src/index.js');

    expect(S3Proxy).toBeDefined();
    expect(typeof S3Proxy).toBe('function');
  });

  it('should support CommonJS require from package root', () => {
    // This tests the package.json "exports" field for require
    const S3Proxy = require('../dist/src/index.cjs');

    expect(S3Proxy).toBeDefined();
    expect(typeof S3Proxy).toBe('function');
  });

  it('should have consistent behavior between ESM and CJS', async () => {
    const { S3Proxy: ESMImport } = await import('../dist/src/index.js');
    const CJSImport = require('../dist/src/index.cjs');

    // Both should be the same constructor function
    expect(ESMImport.name).toBe(CJSImport.name);
    expect(ESMImport.version()).toBe(CJSImport.version());

    // Both should create compatible instances
    const esmInstance = new ESMImport({ bucket: 'test' });
    const cjsInstance = new CJSImport({ bucket: 'test' });

    expect(esmInstance.bucket).toBe(cjsInstance.bucket);
    expect(esmInstance.constructor.name).toBe(cjsInstance.constructor.name);
  });

  it('should work with different require patterns', () => {
    // Test common require patterns used in the wild

    // Pattern 1: Default require
    const S3Proxy1 = require('../dist/src/index.cjs');
    expect(typeof S3Proxy1).toBe('function');

    // Pattern 2: Destructured require
    const { S3Proxy: S3Proxy2 } = require('../dist/src/index.cjs');
    expect(typeof S3Proxy2).toBe('function');

    // Pattern 3: Default property access
    const module3 = require('../dist/src/index.cjs');
    const S3Proxy3 = module3.default;
    expect(typeof S3Proxy3).toBe('function');

    // All should be the same
    expect(S3Proxy1).toBe(S3Proxy2);
    expect(S3Proxy2).toBe(S3Proxy3);
  });
});
