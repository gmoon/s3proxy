import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3NotFound, S3Proxy, UserException } from '../src/index.js';
import type { S3ProxyConfig } from '../src/types.js';
import { s3Mock, setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';

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

      await expect(proxy.init()).rejects.toThrow('Init failed');
      expect(errorSpy).toHaveBeenCalledWith(initError);
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
    it('defaults to true: rejects when the bucket is unreachable', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket' });
      s3Mock.on(HeadBucketCommand).rejectsOnce(new Error('unreachable'));
      await expect(proxy.init()).rejects.toThrow('unreachable');
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
