import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { S3Proxy } from '../src/index.js';
import type { ExpressRequest, ExpressResponse } from '../src/types.js';
import { setupS3Mocks, teardownS3Mocks } from './helpers/aws-mock.js';

// Mock response object for testing
function createMockResponse(): ExpressResponse {
  const headers: Record<string, string> = {};
  let statusCode = 200;

  return {
    writeHead: vi.fn((code: number, hdrs?: Record<string, string>) => {
      statusCode = code;
      if (hdrs) Object.assign(headers, hdrs);
    }),
    end: vi.fn(),
    pipe: vi.fn(),
    statusCode,
    headers,
  } as unknown as ExpressResponse;
}

function createMockRequest(path: string, headers: Record<string, string> = {}): ExpressRequest {
  return {
    path,
    url: path,
    headers,
    method: 'GET',
  } as ExpressRequest;
}

describe('MockExpress', () => {
  let proxy: S3Proxy;

  beforeEach(async () => {
    // Set up AWS mocks before each test
    setupS3Mocks();

    proxy = new S3Proxy({ bucket: 's3proxy-public' });
    await proxy.init();
  });

  afterEach(() => {
    // Clean up AWS mocks after each test
    teardownS3Mocks();
  });

  it('should handle head requests', async () => {
    const req = createMockRequest('/index.html');
    const res = createMockResponse();

    const stream = await proxy.head(req, res);

    expect(res.writeHead).toHaveBeenCalled();
    expect(stream).toBeDefined();
  });

  it('should handle get requests', async () => {
    const req = createMockRequest('/index.html');
    const res = createMockResponse();

    const stream = await proxy.get(req, res);

    expect(res.writeHead).toHaveBeenCalled();
    expect(stream).toBeDefined();
  });

  it('should handle range requests', async () => {
    const req = createMockRequest('/large.bin', { range: 'bytes=0-99' });
    const res = createMockResponse();

    const stream = await proxy.get(req, res);

    expect(res.writeHead).toHaveBeenCalled();
    expect(stream).toBeDefined();
  });

  it('should handle health check', async () => {
    const res = createMockResponse();

    const stream = await proxy.healthCheckStream(res);

    expect(res.writeHead).toHaveBeenCalled();
    expect(stream).toBeDefined();
  });
});
