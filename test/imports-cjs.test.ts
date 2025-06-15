import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Create require function for testing CommonJS imports in ESM environment
const require = createRequire(import.meta.url);

describe('CommonJS Imports', () => {
  it('should require S3Proxy as default export', () => {
    const S3Proxy = require('../dist/src/index.cjs');

    expect(S3Proxy).toBeDefined();
    expect(typeof S3Proxy).toBe('function');
    expect(S3Proxy.name).toBe('S3Proxy');
  });

  it('should require S3Proxy as named export', () => {
    const { S3Proxy } = require('../dist/src/index.cjs');

    expect(S3Proxy).toBeDefined();
    expect(typeof S3Proxy).toBe('function');
    expect(S3Proxy.name).toBe('S3Proxy');
  });

  it('should be able to create S3Proxy instance from default export', () => {
    const S3Proxy = require('../dist/src/index.cjs');
    const proxy = new S3Proxy({ bucket: 'test-bucket' });

    expect(proxy).toBeInstanceOf(S3Proxy);
    expect(proxy.bucket).toBe('test-bucket');
  });

  it('should be able to create S3Proxy instance from named export', () => {
    const { S3Proxy } = require('../dist/src/index.cjs');
    const proxy = new S3Proxy({ bucket: 'test-bucket' });

    expect(proxy).toBeInstanceOf(S3Proxy);
    expect(proxy.bucket).toBe('test-bucket');
  });

  it('should have static version method', () => {
    const S3Proxy = require('../dist/src/index.cjs');

    expect(typeof S3Proxy.version).toBe('function');
    expect(S3Proxy.version()).toBe('3.0.0');
  });

  it('should have consistent exports', () => {
    const S3ProxyDefault = require('../dist/src/index.cjs');
    const { S3Proxy: S3ProxyNamed } = require('../dist/src/index.cjs');

    // Both should reference the same constructor
    expect(S3ProxyDefault).toBe(S3ProxyNamed);
    expect(S3ProxyDefault.version()).toBe(S3ProxyNamed.version());
  });
});
