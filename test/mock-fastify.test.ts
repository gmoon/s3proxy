import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest, HttpResponse } from '../src/types.js';
import { setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';

describe('Fastify Integration', () => {
  let fastify: FastifyInstance;
  let proxy: S3Proxy;

  beforeEach(async () => {
    setupS3Mocks();
    fastify = Fastify({ logger: false });
    proxy = new S3Proxy({ bucket: '.test-bucket' });
    await proxy.init();
    await fastify.ready();
  });

  afterEach(async () => {
    try {
      await fastify.close();
    } catch (_error) {
      // Ignore close errors in tests
    }
    teardownS3Mocks();
  });

  it('should work with Fastify request/response objects', async () => {
    const mockRequest = {
      raw: {
        url: '/index.html',
        headers: {},
        method: 'GET',
      },
    } as FastifyRequest;

    const mockReply = {
      raw: {
        writeHead: vi.fn(),
        end: vi.fn(),
        pipe: vi.fn(),
      },
    } as FastifyReply;

    const stream = await proxy.get(mockRequest.raw as HttpRequest, mockReply.raw as HttpResponse);

    expect(stream).toBeDefined();
    expect(mockReply.raw.writeHead).toHaveBeenCalled();
  });

  it('should handle HEAD requests', async () => {
    const mockRequest = {
      raw: {
        url: '/index.html',
        headers: {},
        method: 'HEAD',
      },
    } as FastifyRequest;

    const mockReply = {
      raw: {
        writeHead: vi.fn(),
        end: vi.fn(),
        pipe: vi.fn(),
      },
    } as FastifyReply;

    const stream = await proxy.head(mockRequest.raw as HttpRequest, mockReply.raw as HttpResponse);

    expect(stream).toBeDefined();
    expect(mockReply.raw.writeHead).toHaveBeenCalled();
  });

  it('should handle type casting from Fastify to HttpRequest/HttpResponse', () => {
    const fastifyRequest = {
      raw: { url: '/test', headers: {}, method: 'GET' },
    } as FastifyRequest;

    const fastifyReply = {
      raw: { writeHead: vi.fn(), end: vi.fn(), pipe: vi.fn() },
    } as FastifyReply;

    // These should compile without type errors
    const httpRequest = fastifyRequest.raw as HttpRequest;
    const httpResponse = fastifyReply.raw as HttpResponse;

    expect(httpRequest).toBeDefined();
    expect(httpResponse).toBeDefined();
  });
});
