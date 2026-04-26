import { GetObjectCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Forbidden, S3NotFound, S3Proxy } from '../src/index.js';
import { s3Mock, setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';
import { catchError, makeReq, readAll } from './helpers/http-mocks.js';

describe('proxy.fetch', () => {
  let proxy: S3Proxy;

  beforeEach(async () => {
    setupS3Mocks();
    proxy = new S3Proxy({ bucket: '.test-bucket' });
    await proxy.init();
  });

  afterEach(() => {
    teardownS3Mocks();
  });

  it('returns 200 + content-type + a readable body for an existing key', async () => {
    const { stream, status, headers } = await proxy.fetch(makeReq('/index.html'));
    expect(status).toBe(200);
    expect(headers['content-type']).toBe('text/html');
    const body = await readAll(stream);
    expect(body.length).toBe(338);
  });

  it('returns 206 + content-range for a range request', async () => {
    const { stream, status, headers } = await proxy.fetch(
      makeReq('/index.html', { range: 'bytes=0-100' })
    );
    expect(status).toBe(206);
    expect(headers['content-range']).toBe('bytes 0-100/338');
    const body = await readAll(stream);
    expect(body.length).toBe(101);
  });

  it('throws S3NotFound for a missing key', async () => {
    await expect(proxy.fetch(makeReq('/nonexistent-file.txt'))).rejects.toBeInstanceOf(S3NotFound);
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
    const err = await catchError(proxy.fetch(makeReq('/forbidden.txt')));
    expect(err).toBeInstanceOf(S3Forbidden);
    expect((err as S3Forbidden).statusCode).toBe(403);
    expect((err as S3Forbidden).cause).toBe(accessDenied);
  });

  it('does not write to a response (pure)', async () => {
    // The pure contract: fetch never touches a res. We pass none. If it
    // tried to call writeHead anywhere, the test would crash with a
    // TypeError instead of just succeeding.
    const { stream } = await proxy.fetch(makeReq('/index.html'));
    expect(stream).toBeDefined();
  });

  describe('HEAD parity', () => {
    it('a HEAD request returns the same status + headers as GET, with an empty body', async () => {
      const get = await proxy.fetch(makeReq('/index.html'));
      const head = await proxy.fetch({
        ...makeReq('/index.html'),
        method: 'HEAD',
      });
      expect(head.status).toBe(get.status);
      expect(head.headers['content-type']).toBe(get.headers['content-type']);
      expect(head.headers['content-length']).toBe(get.headers['content-length']);
      const headBody = await readAll(head.stream);
      expect(headBody.length).toBe(0);
    });

    it('throws S3NotFound for a HEAD on a missing key', async () => {
      await expect(
        proxy.fetch({ ...makeReq('/nonexistent-file.txt'), method: 'HEAD' })
      ).rejects.toBeInstanceOf(S3NotFound);
    });
  });
});
