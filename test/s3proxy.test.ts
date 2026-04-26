import { GetObjectCommand, HeadBucketCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3Forbidden, S3InvalidRange, S3NotFound, S3Proxy, UserException } from '../src/index.js';
import type { S3ProxyConfig } from '../src/types.js';
import { s3Mock, setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';
import { catchError, makeReq, makeRes, readAll } from './helpers/http-mocks.js';

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

  describe('get', () => {
    let proxy: S3Proxy;

    beforeEach(async () => {
      proxy = new S3Proxy({ bucket: '.test-bucket' });
      await proxy.init();
    });

    it('returns 200 and writes headers for an existing file', async () => {
      const res = makeRes();
      const stream = await proxy.get(makeReq('/index.html'), res);
      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ 'content-type': 'text/html' })
      );
      const content = await readAll(stream);
      expect(content).toContain('s3proxy public landing page');
      expect(content).toContain('<!doctype html>');
      expect(content.length).toBe(338);
    });

    it('handles a range request and writes 206', async () => {
      const res = makeRes();
      const stream = await proxy.get(makeReq('/index.html', { range: 'bytes=0-100' }), res);
      expect(res.writeHead).toHaveBeenCalledWith(
        206,
        expect.objectContaining({ 'content-range': 'bytes 0-100/338' })
      );
      const content = await readAll(stream);
      expect(content.length).toBe(101);
    });

    it('throws S3NotFound for a missing key', async () => {
      const res = makeRes();
      await expect(proxy.get(makeReq('/nonexistent-file.txt'), res)).rejects.toBeInstanceOf(
        S3NotFound
      );
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('throws S3NotFound for an empty key', async () => {
      const res = makeRes();
      await expect(proxy.get(makeReq(''), res)).rejects.toBeInstanceOf(S3NotFound);
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('throws S3Forbidden when AWS returns AccessDenied', async () => {
      const accessDenied = new S3ServiceException({
        name: 'AccessDenied',
        $fault: 'client',
        $metadata: { httpStatusCode: 403 },
        message: 'Access Denied',
      });
      s3Mock
        .on(GetObjectCommand, { Bucket: '.test-bucket', Key: 'forbidden.txt' })
        .rejects(accessDenied);
      const res = makeRes();
      const err = await catchError(proxy.get(makeReq('/forbidden.txt'), res));
      expect(err).toBeInstanceOf(S3Forbidden);
      expect((err as S3Forbidden).statusCode).toBe(403);
      expect((err as S3Forbidden).cause).toBe(accessDenied);
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('throws S3InvalidRange when AWS returns InvalidRange', async () => {
      const invalidRange = new S3ServiceException({
        name: 'InvalidRange',
        $fault: 'client',
        $metadata: { httpStatusCode: 416 },
        message: 'The requested range is not satisfiable',
      });
      s3Mock
        .on(GetObjectCommand, { Bucket: '.test-bucket', Key: 'index.html', Range: 'bytes=99999-' })
        .rejects(invalidRange);
      const res = makeRes();
      const err = await catchError(
        proxy.get(makeReq('/index.html', { range: 'bytes=99999-' }), res)
      );
      expect(err).toBeInstanceOf(S3InvalidRange);
      expect((err as S3InvalidRange).statusCode).toBe(416);
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('rethrows non-AWS errors unchanged', async () => {
      const networkError = new Error('Network error');
      s3Mock
        .on(GetObjectCommand, { Bucket: '.test-bucket', Key: 'flaky.txt' })
        .rejects(networkError);
      const res = makeRes();
      await expect(proxy.get(makeReq('/flaky.txt'), res)).rejects.toThrow('Network error');
    });

    it('throws for unrecognized body type', async () => {
      s3Mock.on(GetObjectCommand, { Bucket: '.test-bucket', Key: 'weird.txt' }).resolves({
        Body: { invalid: 'body' } as never,
        ContentLength: 100,
        ContentType: 'text/plain',
        $metadata: { httpStatusCode: 200, requestId: 'mock' },
      });
      const res = makeRes();
      await expect(proxy.get(makeReq('/weird.txt'), res)).rejects.toThrow('unrecognized type');
    });
  });

  describe('head', () => {
    let proxy: S3Proxy;

    beforeEach(async () => {
      proxy = new S3Proxy({ bucket: '.test-bucket' });
      await proxy.init();
    });

    it('writes 200 and metadata headers for an existing file', async () => {
      const res = makeRes();
      await proxy.head(makeReq('/index.html'), res);
      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ 'content-type': 'text/html', 'content-length': '338' })
      );
    });

    it('throws S3NotFound for a missing key', async () => {
      const res = makeRes();
      await expect(proxy.head(makeReq('/nonexistent-file.txt'), res)).rejects.toBeInstanceOf(
        S3NotFound
      );
      expect(res.writeHead).not.toHaveBeenCalled();
    });
  });

  describe('healthCheckStream', () => {
    let proxy: S3Proxy;

    beforeEach(async () => {
      proxy = new S3Proxy({ bucket: '.test-bucket' });
      await proxy.init();
    });

    it('writes 200 when the bucket is reachable', async () => {
      const res = makeRes();
      await proxy.healthCheckStream(res);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('throws S3NotFound when the bucket is missing', async () => {
      s3Mock.reset();
      s3Mock.on(HeadBucketCommand).rejects({
        name: 'NoSuchBucket',
        $fault: 'client',
        $metadata: { httpStatusCode: 404 },
        message: 'no such bucket',
      });
      const res = makeRes();
      await expect(proxy.healthCheckStream(res)).rejects.toBeInstanceOf(S3NotFound);
      expect(res.writeHead).not.toHaveBeenCalled();
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

  describe('verifyOnInit', () => {
    it('defaults to true: rejects when the bucket is unreachable', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket' });
      s3Mock.on(HeadBucketCommand).rejectsOnce(new Error('unreachable'));
      await expect(proxy.init()).rejects.toThrow('unreachable');
    });

    it('false: init() resolves without sending a HeadBucket', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket', verifyOnInit: false });
      // Reset the mock so the default HeadBucket success is gone — if init
      // tries to send one, the mock would reject with "no matching mock".
      s3Mock.reset();
      await expect(proxy.init()).resolves.not.toThrow();
      expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(0);
    });

    it('healthCheck() remains callable independently after init({verifyOnInit:false})', async () => {
      const proxy = new S3Proxy({ bucket: '.test-bucket', verifyOnInit: false });
      await proxy.init();
      // The default mock setup makes HeadBucket succeed.
      await expect(proxy.healthCheck()).resolves.not.toThrow();
      expect(s3Mock.commandCalls(HeadBucketCommand)).toHaveLength(1);
    });
  });

  describe('Express integration methods', () => {
    let proxy: S3Proxy;

    beforeEach(async () => {
      proxy = new S3Proxy({ bucket: '.test-bucket' });
      await proxy.init();
    });

    it('exposes head, get, and healthCheckStream as functions', () => {
      expect(typeof proxy.head).toBe('function');
      expect(typeof proxy.get).toBe('function');
      expect(typeof proxy.healthCheckStream).toBe('function');
    });
  });
});
