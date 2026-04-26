import { Readable } from 'node:stream';
import { GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import { makeReq, readAll } from './helpers/http-mocks.js';

describe('concurrent fetch', () => {
  const s3Mock = mockClient(S3Client);

  beforeEach(() => {
    s3Mock.reset();
    s3Mock.on(HeadBucketCommand).resolves({
      $metadata: { httpStatusCode: 200, requestId: 'mock' },
    });
  });

  afterEach(() => {
    s3Mock.restore();
  });

  it('10 parallel fetch() calls return distinct streams with distinct bytes', async () => {
    const N = 10;

    // Each key returns a unique payload so we can prove streams aren't crossed.
    for (let i = 0; i < N; i++) {
      const payload = Buffer.from(`payload-${i}`.padEnd(64, String.fromCharCode(65 + i)));
      s3Mock.on(GetObjectCommand, { Bucket: '.test', Key: `key-${i}` }).resolves({
        Body: Readable.from([payload]) as unknown as never,
        ContentLength: payload.length,
        ContentType: 'application/octet-stream',
        $metadata: { httpStatusCode: 200, requestId: `mock-${i}` },
      });
    }

    const proxy = new S3Proxy({ bucket: '.test' });
    await proxy.init();

    const responses = await Promise.all(
      Array.from({ length: N }, (_, i) => proxy.fetch(makeReq(`/key-${i}`)))
    );

    // Distinct stream instances — none reused across calls.
    const streams = responses.map((r) => r.stream);
    expect(new Set(streams).size).toBe(N);

    // Distinct payloads — each stream produces what its mock promised.
    const bodies = await Promise.all(streams.map((s) => readAll(s)));
    for (let i = 0; i < N; i++) {
      expect(bodies[i]?.startsWith(`payload-${i}`)).toBe(true);
    }
    expect(new Set(bodies).size).toBe(N);
  });
});
