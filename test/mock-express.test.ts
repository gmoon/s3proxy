import express, { type Application, type Request, type Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest, HttpResponse } from '../src/types.js';
import { setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';

describe('Express Integration', () => {
  let _app: Application;
  let proxy: S3Proxy;

  beforeEach(async () => {
    setupS3Mocks();
    _app = express();
    proxy = new S3Proxy({ bucket: '.test-bucket' });
    await proxy.init();
  });

  afterEach(() => {
    teardownS3Mocks();
  });

  it('should work with Express request/response objects', async () => {
    const mockReq = {
      url: '/index.html',
      headers: {},
      method: 'GET',
    } as Request;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      pipe: vi.fn(),
    } as any as Response;

    const stream = await proxy.get(mockReq as HttpRequest, mockRes as HttpResponse);

    expect(stream).toBeDefined();
    expect(mockRes.writeHead).toHaveBeenCalled();
  });

  it('should handle HEAD requests', async () => {
    const mockReq = {
      url: '/index.html',
      headers: {},
      method: 'HEAD',
    } as Request;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      pipe: vi.fn(),
    } as any as Response;

    const stream = await proxy.head(mockReq as HttpRequest, mockRes as HttpResponse);

    expect(stream).toBeDefined();
    expect(mockRes.writeHead).toHaveBeenCalled();
  });

  it('should handle type casting from Express to HttpRequest/HttpResponse', () => {
    const expressRequest = { url: '/test', headers: {}, method: 'GET' } as Request;
    const expressResponse = { writeHead: vi.fn(), end: vi.fn(), pipe: vi.fn() } as any as Response;

    // These should compile without type errors
    const httpRequest = expressRequest as HttpRequest;
    const httpResponse = expressResponse as HttpResponse;

    expect(httpRequest).toBeDefined();
    expect(httpResponse).toBeDefined();
  });
});
