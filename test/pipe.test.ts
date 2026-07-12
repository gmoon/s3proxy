import { Readable } from 'node:stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import { s3Mock, setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';
import { FakeResponse, makeReq, serve, ThrowingResponse } from './helpers/http-mocks.js';

describe('proxy.pipe / proxy.middleware (convenience adapter)', () => {
  let proxy: S3Proxy;

  beforeEach(async () => {
    setupS3Mocks();
    proxy = new S3Proxy({ bucket: '.test-bucket' });
    await proxy.init();
  });

  afterEach(() => {
    teardownS3Mocks();
  });

  describe('pipe()', () => {
    it('writes status + headers and streams the body for an existing key', async () => {
      const res = new FakeResponse();
      await proxy.pipe(makeReq('/index.html'), res);
      expect(res.status).toBe(200);
      expect(res.headers?.['content-type']).toBe('text/html');
      expect(res.body.length).toBe(338);
    });

    it('renders an honest 404 (not an empty 200) for a missing key', async () => {
      const res = new FakeResponse();
      await proxy.pipe(makeReq('/nonexistent-file.txt'), res);
      expect(res.status).toBe(404);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('does not reject for a classified S3 failure — it renders it', async () => {
      const res = new FakeResponse();
      await expect(proxy.pipe(makeReq('/nonexistent-file.txt'), res)).resolves.toBeUndefined();
    });

    it('passes a range request through as a 206', async () => {
      const res = new FakeResponse();
      await proxy.pipe(makeReq('/index.html', { range: 'bytes=0-100' }), res);
      expect(res.status).toBe(206);
      expect(res.headers?.['content-range']).toBe('bytes 0-100/338');
    });
  });

  describe('middleware()', () => {
    it('returns a handler that serves an existing key', async () => {
      const res = await serve(proxy.middleware(), makeReq('/index.html'));
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(338);
    });

    it('renders 404 for a missing key without throwing', async () => {
      const res = await serve(proxy.middleware(), makeReq('/nonexistent-file.txt'));
      expect(res.status).toBe(404);
    });

    it('forwards an unexpected error to next when one is provided', async () => {
      // ThrowingResponse makes writeHead throw *after* a successful fetch, so
      // pipe() rejects and the handler routes it to next (not rendered).
      const res = new ThrowingResponse();
      const err = await new Promise((resolve) => {
        proxy.middleware()(makeReq('/index.html'), res, resolve);
      });
      expect(err).toBeInstanceOf(Error);
    });

    it('ends the response when an unexpected error escapes and no next is given', async () => {
      const res = new ThrowingResponse();
      await new Promise<void>((resolve) => {
        res.on('finish', () => resolve());
        res.on('close', () => resolve());
        proxy.middleware()(makeReq('/index.html'), res);
      });
      // writeHead threw (marking headersSent), so renderError just ends it.
      expect(res.headersSent).toBe(true);
    });
  });

  describe('mid-stream failure', () => {
    it('ends the response and resolves when the S3 body errors after headers are sent', async () => {
      s3Mock.on(GetObjectCommand, { Bucket: '.test-bucket', Key: 'flaky-stream.bin' }).resolves({
        Body: new Readable({
          read() {
            this.destroy(new Error('mid-stream S3 failure'));
          },
        }) as never,
        ContentType: 'application/octet-stream',
        $metadata: { httpStatusCode: 200, requestId: 'mock' },
      });
      const res = new FakeResponse();
      await expect(proxy.pipe(makeReq('/flaky-stream.bin'), res)).resolves.toBeUndefined();
      expect(res.status).toBe(200); // headers already went out before the stream broke
      expect(res.writableEnded).toBe(true);
    });
  });
});
