import express, { type Application, type Request } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest } from '../src/types.js';
import { setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';
import { readAll } from './helpers/http-mocks.js';

describe('Express request shape compatibility', () => {
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

  it('fetch() accepts a GET request shaped like Express Request', async () => {
    const req = { url: '/index.html', headers: {}, method: 'GET' } as Request;
    const { stream, status, headers } = await proxy.fetch(req as unknown as HttpRequest);
    expect(status).toBe(200);
    expect(headers['content-type']).toBe('text/html');
    const body = await readAll(stream);
    expect(body.length).toBe(338);
  });

  it('fetch() accepts a HEAD request shaped like Express Request', async () => {
    const req = { url: '/index.html', headers: {}, method: 'HEAD' } as Request;
    const { stream, status, headers } = await proxy.fetch(req as unknown as HttpRequest);
    expect(status).toBe(200);
    expect(headers['content-length']).toBe('338');
    const body = await readAll(stream);
    expect(body.length).toBe(0);
  });
});
