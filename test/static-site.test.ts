import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import { setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';
import { makeReq, serve, ThrowingResponse } from './helpers/http-mocks.js';

describe('proxy.staticSite (S3 website hosting layer)', () => {
  let proxy: S3Proxy;

  beforeEach(async () => {
    setupS3Mocks();
    proxy = new S3Proxy({ bucket: '.test-bucket' });
    await proxy.init();
  });

  afterEach(() => {
    teardownS3Mocks();
  });

  describe('index document resolution', () => {
    it('serves index.html for the root path', async () => {
      const res = await serve(proxy.staticSite(), makeReq('/'));
      expect(res.status).toBe(200);
      expect(res.headers?.['content-type']).toBe('text/html');
      expect(res.body.length).toBe(338);
    });

    it('serves <dir>/index.html for a directory path', async () => {
      const res = await serve(proxy.staticSite(), makeReq('/blog/'));
      expect(res.status).toBe(200);
      expect(res.body).toContain('blog index');
    });

    it('leaves a normal file path untouched', async () => {
      const res = await serve(proxy.staticSite(), makeReq('/index.html'));
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(338);
    });

    it('can be disabled with indexDocument: ""', async () => {
      // root with no index resolution → empty key → S3NotFound → plaintext 404
      const res = await serve(proxy.staticSite({ indexDocument: '' }), makeReq('/'));
      expect(res.status).toBe(404);
    });
  });

  describe('error document', () => {
    it('serves the error document with the original 404 status', async () => {
      const handler = proxy.staticSite({ errorDocument: '404.html' });
      const res = await serve(handler, makeReq('/nonexistent-file.txt'));
      expect(res.status).toBe(404);
      expect(res.headers?.['content-type']).toBe('text/html');
      expect(res.body).toContain('Not found');
    });

    it('renders a plaintext 404 when no error document is configured', async () => {
      const res = await serve(proxy.staticSite(), makeReq('/nonexistent-file.txt'));
      expect(res.status).toBe(404);
      expect(res.headers?.['content-type']).toContain('text/plain');
    });

    it('falls back to a bare status when the error document is itself missing', async () => {
      // Both the request key and the errorDocument 404 — must not loop.
      const handler = proxy.staticSite({ errorDocument: 'nonexistent-file.txt' });
      const res = await serve(handler, makeReq('/nonexistent-file.txt'));
      expect(res.status).toBe(404);
      expect(res.body).toBe('');
    });

    it('ends the response if writing the error document fails after headers are sent', async () => {
      // The error document fetch succeeds, but writeHead throws — the guard
      // must just end the response, not re-write headers or loop.
      const res = new ThrowingResponse();
      await new Promise<void>((resolve) => {
        res.on('finish', () => resolve());
        res.on('close', () => resolve());
        proxy.staticSite({ errorDocument: '404.html' })(makeReq('/nonexistent-file.txt'), res);
      });
      expect(res.headersSent).toBe(true);
    });
  });

  it('does not touch fetch() — the primitive still throws on a missing key', async () => {
    // proves staticSite behavior is layered, not baked into the core
    await expect(proxy.fetch(makeReq('/nonexistent-file.txt'))).rejects.toThrow();
  });
});
