import { GetObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvalidRequest, S3Forbidden, S3NotFound, S3Proxy } from '../src/index.js';
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

describe('proxy.fetchWebKey', () => {
  let proxy: S3Proxy;

  beforeEach(async () => {
    setupS3Mocks();
    proxy = new S3Proxy({ bucket: '.test-bucket' });
    await proxy.init();
  });

  afterEach(() => {
    teardownS3Mocks();
  });

  it('serves the caller-supplied key, ignoring the request URL', async () => {
    // URL path is "/" but the key argument selects index.html.
    const res = await proxy.fetchWebKey('index.html', new Request(url('/')));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html');
    expect((await res.text()).length).toBe(338);
  });

  it('is behaviorally identical to fetchWeb when the key matches the path', async () => {
    const viaKey = await proxy.fetchWebKey('index.html', new Request(url('/ignored')));
    const viaUrl = await proxy.fetchWeb(new Request(url('/index.html')));
    expect(viaKey.status).toBe(viaUrl.status);
    expect(viaKey.headers.get('content-type')).toBe(viaUrl.headers.get('content-type'));
    expect(viaKey.headers.get('content-length')).toBe(viaUrl.headers.get('content-length'));
  });

  it('honors the Range header from the request → 206 + content-range', async () => {
    const res = await proxy.fetchWebKey(
      'index.html',
      new Request(url('/'), { headers: { range: 'bytes=0-100' } })
    );
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-100/338');
    expect((await res.text()).length).toBe(101);
  });

  it('returns a null body for HEAD but keeps status and headers', async () => {
    const res = await proxy.fetchWebKey('index.html', new Request(url('/'), { method: 'HEAD' }));
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(res.headers.get('content-length')).toBe('338');
  });

  it('throws the typed S3NotFound for a missing key', async () => {
    await expect(
      proxy.fetchWebKey('nonexistent-file.txt', new Request(url('/')))
    ).rejects.toBeInstanceOf(S3NotFound);
  });

  // The point of the seam: a key with a literal '%' is served verbatim, where
  // routing it through a URL (fetchWeb) fails because the path can't be decoded.
  it('serves a key with reserved characters verbatim', async () => {
    const res = await proxy.fetchWebKey('reports/q1 50%.txt', new Request(url('/')));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('fifty percent');
  });

  it('contrast: the same key via fetchWeb (URL-addressed) fails to decode', async () => {
    await expect(proxy.fetchWeb(new Request(url('/reports/q1 50%.txt')))).rejects.toBeInstanceOf(
      InvalidRequest
    );
  });
});
