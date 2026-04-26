import { Readable, Writable } from 'node:stream';
import { GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import { makeReq } from './helpers/http-mocks.js';

describe('streaming memory bound', () => {
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

  it('streams a 50MB body with peak RSS delta < 80MB', async () => {
    const SIZE = 50 * 1024 * 1024;
    const CHUNK = 64 * 1024;
    let remaining = SIZE;
    const body = new Readable({
      read() {
        if (remaining <= 0) {
          this.push(null);
          return;
        }
        const n = Math.min(CHUNK, remaining);
        remaining -= n;
        this.push(Buffer.alloc(n));
      },
    });

    s3Mock.on(GetObjectCommand).resolves({
      Body: body as unknown as never,
      ContentLength: SIZE,
      ContentType: 'application/octet-stream',
      $metadata: { httpStatusCode: 200, requestId: 'mock' },
    });

    const proxy = new S3Proxy({ bucket: 'streaming-test' });
    await proxy.init();

    if (typeof global.gc === 'function') global.gc();
    const baseRss = process.memoryUsage().rss;
    let peakDelta = 0;
    let consumed = 0;

    const { stream } = await proxy.fetch(makeReq('/big.bin'));

    await new Promise<void>((resolve, reject) => {
      const sink = new Writable({
        write(chunk: Buffer, _enc, cb) {
          consumed += chunk.length;
          const delta = process.memoryUsage().rss - baseRss;
          if (delta > peakDelta) peakDelta = delta;
          cb();
        },
      });
      stream.on('error', reject);
      sink.on('finish', resolve);
      sink.on('error', reject);
      stream.pipe(sink);
    });

    expect(consumed).toBe(SIZE);
    expect(peakDelta).toBeLessThan(80 * 1024 * 1024);
  });
});
