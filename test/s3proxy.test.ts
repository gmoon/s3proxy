import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { S3Proxy, UserException } from '../src/index.js';
import type { ExpressRequest, S3ProxyConfig } from '../src/types.js';
import { setupS3Mocks, teardownS3Mocks, s3Mock } from './helpers/aws-mock.js';

describe('S3Proxy', () => {
  // Set up AWS mocks for all tests
  beforeEach(() => {
    setupS3Mocks();
  });

  afterEach(() => {
    teardownS3Mocks();
  });

  describe('constructor', () => {
    it('should create an instance with valid config', () => {
      const config: S3ProxyConfig = { bucket: 's3proxy-public' };
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
    const config: S3ProxyConfig = { bucket: 's3proxy-public' };

    beforeEach(() => {
      proxy = new S3Proxy(config);
    });

    it('should initialize successfully', async () => {
      await expect(proxy.init()).resolves.not.toThrow();
    });

    it('should be initialized after calling init', async () => {
      await proxy.init();
      // Test that proxy is properly initialized by calling a method that requires initialization
      expect(() => (proxy as any).isInitialized()).not.toThrow();
    });

    it('should handle bucket configuration', async () => {
      const customProxy = new S3Proxy({
        bucket: 's3proxy-public',
        region: 'us-east-1',
      });
      await expect(customProxy.init()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    let proxy: S3Proxy;

    beforeEach(async () => {
      proxy = new S3Proxy({ bucket: 's3proxy-public' });
      await proxy.init();
    });

    it('should handle nonexistent key gracefully', async () => {
      const mockReq: ExpressRequest = {
        url: '/nonexistent-file.txt',
        headers: {},
        method: 'GET',
        path: '/nonexistent-file.txt',
      } as ExpressRequest;

      // The S3Proxy catches NoSuchKey errors and returns an empty stream
      // This is the expected behavior - it doesn't throw, it handles the error gracefully
      const result = await (proxy as any).getObject(mockReq);
      expect(result.s3stream).toBeDefined();
      expect(typeof result.s3stream.pipe).toBe('function');
    });

    it('should handle malformed requests gracefully', async () => {
      const mockReq: ExpressRequest = {
        url: '',
        headers: {},
        method: 'GET',
        path: '',
      } as ExpressRequest;

      // Empty path should also be handled gracefully
      const result = await (proxy as any).getObject(mockReq);
      expect(result.s3stream).toBeDefined();
      expect(typeof result.s3stream.pipe).toBe('function');
    });
  });

  describe('getObject', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });
    let page: any;
    let content: string;

    beforeEach(async () => {
      await proxy.init();
      const mockReq: ExpressRequest = {
        url: '/index.html',
        headers: {},
        method: 'GET',
        path: '/index.html',
      } as ExpressRequest;

      page = await (proxy as any).getObject(mockReq);

      // Read the stream content for testing
      const chunks: Buffer[] = [];
      for await (const chunk of page.s3stream) {
        chunks.push(Buffer.from(chunk));
      }
      content = Buffer.concat(chunks).toString('utf-8');
    });

    it('should return 200 status code for existing file', () => {
      expect(page.statusCode).toBe(200);
    });

    it('should return readable stream', () => {
      expect(page.s3stream).toBeDefined();
      expect(typeof page.s3stream.pipe).toBe('function');
    });

    it('should return correct content', () => {
      expect(content).toContain('s3proxy public landing page');
      expect(content).toContain('<!doctype html>');
      expect(content).toContain('</html>');
    });

    it('should have correct content length', () => {
      expect(content.length).toBe(338);
    });

    it('should return response object with expected structure', () => {
      expect(page).toHaveProperty('s3stream');
      expect(page).toHaveProperty('statusCode');
      expect(page).toHaveProperty('headers');
    });
  });

  describe('range requests', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });

    beforeEach(async () => {
      await proxy.init();
    });

    it('should handle range requests', async () => {
      const mockReq: ExpressRequest = {
        url: '/index.html',
        headers: { range: 'bytes=0-100' },
        method: 'GET',
        path: '/index.html',
      } as ExpressRequest;

      const result = await (proxy as any).getObject(mockReq);

      // Range requests should return a readable stream
      expect(result.s3stream).toBeDefined();
      expect(typeof result.s3stream.pipe).toBe('function');

      // Read the content to verify it's partial
      const chunks: Buffer[] = [];
      for await (const chunk of result.s3stream) {
        chunks.push(Buffer.from(chunk));
      }
      const content = Buffer.concat(chunks).toString('utf-8');
      expect(content.length).toBe(101); // bytes 0-100 = 101 bytes
    });
  });

  describe('headObject', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });

    beforeEach(async () => {
      await proxy.init();
    });

    it('should return metadata for existing file', async () => {
      const mockReq: ExpressRequest = {
        url: '/index.html',
        headers: {},
        method: 'HEAD',
        path: '/index.html',
      } as ExpressRequest;

      const result = await (proxy as any).headObject(mockReq);

      expect(result.statusCode).toBe(200);
      expect(result.s3stream).toBeDefined();
      expect(result).toHaveProperty('headers');
    });

    it('should handle nonexistent file gracefully', async () => {
      const mockReq: ExpressRequest = {
        url: '/nonexistent-file.txt',
        headers: {},
        method: 'HEAD',
        path: '/nonexistent-file.txt',
      } as ExpressRequest;

      // Should handle gracefully, not throw
      const result = await (proxy as any).headObject(mockReq);
      expect(result.s3stream).toBeDefined();
    });
  });

  describe('health check', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });

    beforeEach(async () => {
      await proxy.init();
    });

    it('should perform health check successfully', async () => {
      const result = await (proxy as any).headBucket();

      expect(result.statusCode).toBe(200);
      expect(result.s3stream).toBeDefined();
    });
  });

  describe('Express integration methods', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });

    beforeEach(async () => {
      await proxy.init();
    });

    it('should have public head method', () => {
      expect(typeof proxy.head).toBe('function');
    });

    it('should have public get method', () => {
      expect(typeof proxy.get).toBe('function');
    });

    it('should have public healthCheckStream method', () => {
      expect(typeof proxy.healthCheckStream).toBe('function');
    });
  });

  describe('Error Handling', () => {
    let proxy: S3Proxy;
    const config: S3ProxyConfig = { bucket: 'test-bucket' };

    beforeEach(() => {
      proxy = new S3Proxy(config);
    });

    it('should re-throw non-AWS errors', async () => {
      const mockError = new Error('Network error');
      s3Mock.on(GetObjectCommand).rejectsOnce(mockError);
      
      await proxy.init();
      
      const mockRequest = { url: '/test.txt', headers: {}, method: 'GET' } as ExpressRequest;
      const mockResponse = { writeHead: vi.fn(), end: vi.fn() } as any;
      
      await expect(proxy.get(mockRequest, mockResponse))
        .rejects.toThrow('Network error');
    });

    it('should emit error and throw on init failure', async () => {
      const mockError = new Error('Init failed');
      s3Mock.on(HeadBucketCommand).rejectsOnce(mockError);
      
      const errorSpy = vi.fn();
      proxy.on('error', errorSpy);
      
      await expect(proxy.init()).rejects.toThrow('Init failed');
      expect(errorSpy).toHaveBeenCalledWith(mockError);
    });

    it('should throw error for unrecognized body type', async () => {
      await proxy.init();
      
      // Mock S3 response with invalid body type
      const invalidBody = { invalid: 'body' } as any;
      s3Mock.on(GetObjectCommand).resolvesOnce({
        Body: invalidBody,
        ContentLength: 100,
        ContentType: 'text/plain'
      });
      
      const mockRequest = { url: '/test.txt', headers: {}, method: 'GET' } as ExpressRequest;
      const mockResponse = { writeHead: vi.fn(), end: vi.fn() } as any;
      
      await expect(proxy.get(mockRequest, mockResponse))
        .rejects.toThrow('unrecognized type');
    });
  });
});
