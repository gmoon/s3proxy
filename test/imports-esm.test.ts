import { describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';

describe('ESM Imports', () => {
  it('should import S3Proxy as named export', () => {
    expect(S3Proxy).toBeDefined();
    expect(typeof S3Proxy).toBe('function');
    expect(S3Proxy.name).toBe('S3Proxy');
  });

  it('should be able to create S3Proxy instance', () => {
    const proxy = new S3Proxy({ bucket: 'test-bucket' });
    expect(proxy).toBeInstanceOf(S3Proxy);
    expect(proxy.bucket).toBe('test-bucket');
  });

  it('should have static version method', () => {
    expect(typeof S3Proxy.version).toBe('function');
    expect(S3Proxy.version()).toBe('3.0.0');
  });

  it('should be a constructor function', () => {
    expect(S3Proxy.prototype).toBeDefined();
    expect(S3Proxy.prototype.constructor).toBe(S3Proxy);
  });
});
