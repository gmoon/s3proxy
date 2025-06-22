import { describe, expect, it } from 'vitest';
import { S3Proxy } from '../src/index.js';
import type { ExpressRequest } from '../src/types.js';

describe('S3Proxy.parseRequest', () => {
  it('should return key and query', () => {
    expect(S3Proxy.parseRequest({ url: '/index.html' } as ExpressRequest)).toEqual({
      key: 'index.html',
      query: {},
    });

    expect(S3Proxy.parseRequest({ url: '/index.html?foo=bar' } as ExpressRequest)).toEqual({
      key: 'index.html',
      query: { foo: 'bar' },
    });

    expect(S3Proxy.parseRequest({ path: '/index.html', query: {} } as ExpressRequest)).toEqual({
      key: 'index.html',
      query: {},
    });

    expect(
      S3Proxy.parseRequest({ path: '/index.html', query: { foo: 'bar' } } as ExpressRequest)
    ).toEqual({ key: 'index.html', query: { foo: 'bar' } });

    expect(S3Proxy.parseRequest({ path: '/index.html' } as ExpressRequest)).toEqual({
      key: 'index.html',
      query: {},
    });
  });

  it('should return key without url encodings', () => {
    expect(S3Proxy.parseRequest({ url: '/file with spaces' } as ExpressRequest)).toEqual({
      key: 'file with spaces',
      query: {},
    });

    expect(S3Proxy.parseRequest({ path: '/file with spaces' } as ExpressRequest)).toEqual({
      key: 'file with spaces',
      query: {},
    });
  });

  it('should decode all the special characters', () => {
    const testString = 'specialCharacters!-_.*\'()&$@=;:+  ,?{^}%`]">[~<#|.';
    const encodedTestString = encodeURIComponent(testString);

    expect(S3Proxy.parseRequest({ url: encodedTestString } as ExpressRequest)).toEqual({
      key: testString,
      query: {},
    });

    expect(S3Proxy.parseRequest({ path: encodedTestString } as ExpressRequest)).toEqual({
      key: testString,
      query: {},
    });
  });
});

describe('S3Proxy.getS3Params', () => {
  it('should set Bucket and Key', () => {
    const s3proxy = new S3Proxy({ bucket: 's3proxy-public' });
    const result = (s3proxy as any).getS3Params({ path: '/index.html' } as ExpressRequest);
    expect(result).toEqual({ Bucket: 's3proxy-public', Key: 'index.html' });
  });

  it('should set Range parameter', () => {
    const s3proxy = new S3Proxy({ bucket: 's3proxy-public' });
    const result = (s3proxy as any).getS3Params({
      path: '/index.html',
      headers: { range: 'bytes=0-100' },
    } as ExpressRequest);
    expect(result).toEqual({
      Bucket: 's3proxy-public',
      Key: 'index.html',
      Range: 'bytes=0-100',
    });
  });
});

describe('S3Proxy.version', () => {
  it('should return a version number as major.minor.patch', () => {
    expect(S3Proxy.version()).toMatch(/\d+\.\d+\.\d+/);
  });
});
