import { GetObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Forbidden, S3NotFound, S3Proxy } from '../src/index.js';
import { s3Mock, setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';
import { catchError } from './helpers/http-mocks.js';

const url = (path: string) => `http://localhost${path}`;

describe('proxy.fetchWeb', () => {
  let proxy: S3Proxy;

  beforeEach(async () => {
    setupS3Mocks();
    proxy = new S3Proxy({ bucket: '.test-bucket' });
    await proxy.init();
  });

  afterEach(() => {
    teardownS3Mocks();
  });

  it('returns a 200 Web Response with headers and a streamed body for GET', async () => {
    const res = await proxy.fetchWeb(new Request(url('/index.html')));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html');
    const body = await res.text();
    expect(body.length).toBe(338);
  });

  it('returns 206 + content-range for a range request', async () => {
    const res = await proxy.fetchWeb(
      new Request(url('/index.html'), { headers: { range: 'bytes=0-100' } })
    );
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-100/338');
    const body = await res.text();
    expect(body.length).toBe(101);
  });

  it('returns a null body for HEAD but keeps status and headers', async () => {
    const res = await proxy.fetchWeb(new Request(url('/index.html'), { method: 'HEAD' }));
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(res.headers.get('content-length')).toBe('338');
  });

  it('preserves the query string when resolving the key', async () => {
    const res = await proxy.fetchWeb(new Request(url('/index.html?cacheBust=1')));
    expect(res.status).toBe(200);
  });

  it('throws the typed S3ProxyError (not a rendered 200) for a missing key', async () => {
    await expect(proxy.fetchWeb(new Request(url('/nonexistent-file.txt')))).rejects.toBeInstanceOf(
      S3NotFound
    );
  });

  it('throws S3Forbidden when AWS returns AccessDenied', async () => {
    s3Mock.on(GetObjectCommand, { Bucket: '.test-bucket', Key: 'forbidden.txt' }).rejects(
      new S3ServiceException({
        name: 'AccessDenied',
        $fault: 'client',
        $metadata: { httpStatusCode: 403 },
        message: 'Access Denied',
      })
    );
    const err = await catchError(proxy.fetchWeb(new Request(url('/forbidden.txt'))));
    expect(err).toBeInstanceOf(S3Forbidden);
  });
});
