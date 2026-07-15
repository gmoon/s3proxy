import { Readable, Writable } from 'node:stream';
import v8 from 'node:v8';
import vm from 'node:vm';
import { GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import { makeReq } from './helpers/http-mocks.js';

// Obtain a GC trigger without requiring the runner to launch with --expose-gc.
// Vitest does not reliably forward `--expose-gc` to its worker forks, so expose
// gc programmatically via V8 flags instead. Returns null if unavailable (the
// test then skips the strict bound rather than false-failing on uncollected
// garbage).
function acquireGc(): (() => void) | null {
  if (typeof global.gc === 'function') return global.gc.bind(global);
  try {
    v8.setFlagsFromString('--expose-gc');
    const gc = vm.runInNewContext('gc') as (() => void) | undefined;
    v8.setFlagsFromString('--no-expose-gc');
    return typeof gc === 'function' ? gc : null;
  } catch {
    return null;
  }
}

// Runs in the plain `test:unit` pass only — `test:coverage` excludes this file
// (see package.json). The assertion samples memory usage, and V8 coverage
// instrumentation perturbs allocation and GC timing enough to make the
// measurement unreliable, producing failures that have nothing to do with
// s3proxy's buffering. Un-instrumented, the measurement is stable and
// meaningful, so the bound lives here.
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

  it('streams a 100MB body without buffering the full payload', async () => {
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

    // Force a full GC every GC_WINDOW chunks so the sampled peak reflects the
    // *retained* working set rather than uncollected transient garbage.
    const gc = acquireGc();
    const GC_WINDOW = 16; // ~1MB of 64KB chunks between forced collections

    gc?.();
    // Measure external Buffer memory (arrayBuffers), not RSS: the payload lives
    // in external Buffer storage, not the JS heap, and RSS is a sticky
    // high-water mark that V8 does not return to the OS after GC — which is why
    // an RSS bound drifts between Node versions. arrayBuffers drops the instant
    // freed buffers are collected, so with periodic forced GC it tracks what
    // s3proxy actually holds.
    const baseAb = process.memoryUsage().arrayBuffers;
    let peakDelta = 0;
    let consumed = 0;
    let i = 0;

    const { stream } = await proxy.fetch(makeReq('/big.bin'));

    await new Promise<void>((resolve, reject) => {
      const sink = new Writable({
        write(chunk: Buffer, _enc, cb) {
          consumed += chunk.length;
          if (gc && ++i % GC_WINDOW === 0) gc();
          const delta = process.memoryUsage().arrayBuffers - baseAb;
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
    // The invariant under test is that s3proxy streams rather than buffering
    // the full body. Under backpressure the pipeline retains only a handful of
    // in-flight chunks (~1-2MB observed, dominated by the 1MB GC window); a
    // buffering implementation would keep the whole body referenced, so forced
    // GC could not reclaim it and the delta would climb toward SIZE (100MB).
    // The 8MB bound sits far above the streaming working set and far below a
    // buffering regression, and — because the GC cadence is forced rather than
    // left to the runtime — holds steady across Node versions. If GC could not
    // be acquired, transient garbage never gets collected and the measurement
    // is meaningless, so the strict bound is skipped.
    if (gc) {
      expect(peakDelta).toBeLessThan(8 * 1024 * 1024);
    }
  });
});
