import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3NotFound, S3Proxy, S3ProxyError, UserException } from '../src/index.js';
import type { S3ProxyConfig } from '../src/types.js';
import { s3Mock, setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';
import { catchError } from './helpers/http-mocks.js';

describe('S3Proxy', () => {
  beforeEach(() => {
    setupS3Mocks();
  });

  afterEach(() => {
    teardownS3Mocks();
  });

  describe('constructor', () => {
    it('should create an instance with valid config', () => {
      const config: S3ProxyConfig = { bucket: '.test-bucket' };
      const proxy = new S3Proxy(config);
      expect(proxy).toBeInstanceOf(S3Proxy);
    });

    it('should throw UserException without bucket', () => {
      expect(() => new S3Proxy({} as S3ProxyConfig)).toThrow(UserException);
      expect(() => new S3Proxy({} as S3ProxyConfig)).toThrow('bucket parameter is required');
    });

    it('should throw UserException with null config', () => {
      expect(() => new S3Proxy(null as unknown as S3ProxyConfig)).toThrow(UserException);
      expect(() => new S3Proxy(null as unknown as S3ProxyConfig)).toThrow(
        'constructor parameters are required'
      );
    });
  });

  describe('initialization', () => {
    let proxy: S3Proxy;
    const config: S3ProxyConfig = { bucket: '.test-bucket' };

    beforeEach(() => {
      proxy = new S3Proxy(config);
    });

    it('should initialize successfully', async () => {
      await expect(proxy.init()).resolves.not.toThrow();
    });

    it('should be initialized after calling init', async () => {
      await proxy.init();
      expect(() => proxy.isInitialized()).not.toThrow();
    });

    it('should throw before init', () => {
      expect(() => proxy.isInitialized()).toThrow(UserException);
    });

    it('should handle bucket configuration', async () => {
      const customProxy = new S3Proxy({
        bucket: '.test-bucket',
        region: 'us-east-1',
      });
      await expect(customProxy.init()).resolves.not.toThrow();
    });
  });

  describe('init failure', () => {
    it('emits "error" and rejects when bucket is unreachable', async () => {
      const proxy = new S3Proxy({ bucket: 'test-bucket' });
      const initError = new Error('Init failed');
      s3Mock.on(HeadBucketCommand).rejectsOnce(initError);

      const errorSpy = vi.fn();
      proxy.on('error', errorSpy);

      // init() rejects with a sanitized S3ProxyError (raw message not exposed);
      // the original is preserved on `cause` and the same error is emitted.
      const err = await catchError(proxy.init());
      expect(err).toBeInstanceOf(S3ProxyError);
      expect((err as S3ProxyError).statusCode).toBe(500);
      expect((err as Error).message).not.toContain('Init failed');
      expect((err as S3ProxyError).cause).toBe(initError);
      expect(errorSpy).toHaveBeenCalledWith(err);
    });
  });

  describe('healthCheck', () => {
    it('resolves when bucket is reachable', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket' });
      await proxy.init();
      await expect(proxy.healthCheck()).resolves.not.toThrow();
    });

    it('throws S3NotFound when bucket is missing', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket', verifyOnInit: false });
      await proxy.init();
      s3Mock.reset();
      s3Mock.on(HeadBucketCommand).rejects({
        name: 'NoSuchBucket',
        $fault: 'client',
        $metadata: { httpStatusCode: 404 },
        message: 'no such bucket',
      });
      await expect(proxy.healthCheck()).rejects.toBeInstanceOf(S3NotFound);
    });
  });

  describe('verifyOnInit', () => {
    it('defaults to true: rejects with a sanitized error when the bucket is unreachable', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket' });
      const cause = new Error('unreachable');
      s3Mock.on(HeadBucketCommand).rejectsOnce(cause);
      const err = await catchError(proxy.init());
      expect(err).toBeInstanceOf(S3ProxyError);
      expect((err as Error).message).not.toContain('unreachable');
      expect((err as S3ProxyError).cause).toBe(cause);
    });

    it('false: init() resolves without sending a HeadBucket', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket', verifyOnInit: false });
      s3Mock.reset();
      await expect(proxy.init()).resolves.not.toThrow();
      expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(0);
    });

    it('healthCheck() remains callable independently after init({verifyOnInit:false})', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket', verifyOnInit: false });
      await proxy.init();
      await expect(proxy.healthCheck()).resolves.not.toThrow();
      expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(1);
    });
  });
});
