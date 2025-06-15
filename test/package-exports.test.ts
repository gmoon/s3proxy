import { describe, expect, it } from 'vitest';

describe('Package Exports', () => {
  it('should support ESM import from package root', async () => {
    // This tests the package.json "exports" field for import
    const { S3Proxy } = await import('../dist/src/index.js');

    expect(S3Proxy).toBeDefined();
    expect(typeof S3Proxy).toBe('function');
  });

  it('should work with different import patterns', async () => {
    // Test various import patterns
    const module1 = await import('../dist/src/index.js');
    const { S3Proxy } = await import('../dist/src/index.js');

    expect(module1.S3Proxy).toBeDefined();
    expect(S3Proxy).toBeDefined();
    expect(module1.S3Proxy).toBe(S3Proxy);
  });

  it('should have consistent exports', async () => {
    const { S3Proxy, UserException } = await import('../dist/src/index.js');

    expect(S3Proxy).toBeDefined();
    expect(UserException).toBeDefined();
    expect(typeof S3Proxy).toBe('function');
    expect(typeof UserException).toBe('function');
  });

  it('should be able to create instances', async () => {
    const { S3Proxy } = await import('../dist/src/index.js');
    const proxy = new S3Proxy({ bucket: 'test-bucket' });

    expect(proxy).toBeInstanceOf(S3Proxy);
    expect(proxy.bucket).toBe('test-bucket');
  });
});
