import { describe, expect, it } from 'vitest';
import { InvalidRequest } from '../src/errors.js';
import { parseRequest } from '../src/request-parser.js';
import type { HttpRequest } from '../src/types.js';

const req = (props: Partial<HttpRequest>): HttpRequest => props as HttpRequest;

describe('parseRequest', () => {
  it('returns key and query from req.url', () => {
    expect(parseRequest(req({ url: '/index.html' }))).toEqual({
      key: 'index.html',
      query: {},
    });

    expect(parseRequest(req({ url: '/index.html?foo=bar' }))).toEqual({
      key: 'index.html',
      query: { foo: 'bar' },
    });
  });

  it('returns key and query from req.path / req.query', () => {
    expect(parseRequest(req({ path: '/index.html', query: {} }))).toEqual({
      key: 'index.html',
      query: {},
    });

    expect(parseRequest(req({ path: '/index.html', query: { foo: 'bar' } }))).toEqual({
      key: 'index.html',
      query: { foo: 'bar' },
    });

    expect(parseRequest(req({ path: '/index.html' }))).toEqual({
      key: 'index.html',
      query: {},
    });
  });

  it('decodes percent-encoded paths', () => {
    expect(parseRequest(req({ url: '/file with spaces' }))).toEqual({
      key: 'file with spaces',
      query: {},
    });

    expect(parseRequest(req({ path: '/file with spaces' }))).toEqual({
      key: 'file with spaces',
      query: {},
    });
  });

  it('decodes all special characters', () => {
    const testString = 'specialCharacters!-_.*\'()&$@=;:+  ,?{^}%`]">[~<#|.';
    const encoded = encodeURIComponent(testString);

    expect(parseRequest(req({ url: encoded }))).toEqual({
      key: testString,
      query: {},
    });

    expect(parseRequest(req({ path: encoded }))).toEqual({
      key: testString,
      query: {},
    });
  });

  it('throws InvalidRequest for malformed percent-encoding', () => {
    expect(() => parseRequest(req({ url: '/foo%ZZ' }))).toThrow(InvalidRequest);
    expect(() => parseRequest(req({ path: '/foo%ZZ' }))).toThrow(InvalidRequest);
  });

  it('throws InvalidRequest for null bytes in the key', () => {
    // %00 decodes to U+0000.
    expect(() => parseRequest(req({ url: '/foo%00bar' }))).toThrow(InvalidRequest);
    expect(() => parseRequest(req({ path: '/foo\0bar' }))).toThrow(InvalidRequest);
  });
});
