import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest } from '../src/types.js';
import { setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';
import { readAll } from './helpers/http-mocks.js';

describe('Fastify request shape compatibility', () => {
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
      // Ignore close errors in tests.
    }
    teardownS3Mocks();
  });

  it('fetch() accepts request.raw shaped like Fastify exposes it (GET)', async () => {
    const request = {
      raw: { url: '/index.html', headers: {}, method: 'GET' },
    } as FastifyRequest;
    const { stream, status, headers } = await proxy.fetch(request.raw as unknown as HttpRequest);
    expect(status).toBe(200);
    expect(headers['content-type']).toBe('text/html');
    const body = await readAll(stream);
    expect(body.length).toBe(338);
  });

  it('fetch() accepts request.raw shaped like Fastify exposes it (HEAD)', async () => {
    const request = {
      raw: { url: '/index.html', headers: {}, method: 'HEAD' },
    } as FastifyRequest;
    const { stream, status, headers } = await proxy.fetch(request.raw as unknown as HttpRequest);
    expect(status).toBe(200);
    expect(headers['content-length']).toBe('338');
    const body = await readAll(stream);
    expect(body.length).toBe(0);
  });
});
