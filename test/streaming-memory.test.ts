import { Readable, Writable } from 'node:stream';
import { GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import { makeReq } from './helpers/http-mocks.js';

// Runs in the plain `test:unit` pass only — `test:coverage` excludes this file
// (see package.json). The assertion measures process RSS, and V8 coverage
// instrumentation inflates RSS and shifts GC timing enough to push the peak
// delta past the bound (~57-62MB observed vs. the 50MB limit), producing false
// failures that have nothing to do with s3proxy's buffering. Un-instrumented,
// the measurement is stable and meaningful, so the strict bound lives here.
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

  it('streams a 100MB body with peak RSS delta < 50MB', async () => {
    const SIZE = 100 * 1024 * 1024;
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
    expect(peakDelta).toBeLessThan(50 * 1024 * 1024);
  });
});
