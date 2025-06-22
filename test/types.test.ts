import { describe, it, expect } from 'vitest';
import type { S3ProxyConfig, HttpRequest, HttpResponse, ParsedRequest } from '../src/types.js';

describe('Types', () => {
  it('should have proper S3ProxyConfig interface', () => {
    const config: S3ProxyConfig = {
      bucket: 'test-bucket',
      region: 'us-east-1'
    };
    
    expect(config.bucket).toBe('test-bucket');
    expect(config.region).toBe('us-east-1');
  });

  it('should have proper HttpRequest interface', () => {
    const request: Partial<HttpRequest> = {
      url: '/test.txt',
      method: 'GET',
      headers: { 'user-agent': 'test' }
    };
    
    expect(request.url).toBe('/test.txt');
    expect(request.method).toBe('GET');
  });

  it('should have proper ParsedRequest interface', () => {
    const parsed: ParsedRequest = {
      key: 'test.txt',
      query: { param: 'value' }
    };
    
    expect(parsed.key).toBe('test.txt');
    expect(parsed.query.param).toBe('value');
  });
});
