import { parse as parseUrl } from 'node:url';
import { InvalidRequest } from './errors.js';
import type { HttpRequest, ParsedRequest } from './types.js';

export function stripLeadingSlash(s: string): string {
  return s.replace(/^\/+/, '');
}

/**
 * Lift a single request header into an S3 command param.
 * Returns `{ [paramKey]: value }` or `{}` so it spreads cleanly
 * into a command input object.
 */
export function mapHeaderToParam(
  req: HttpRequest,
  headerKey: string,
  paramKey: string
): Record<string, string> | Record<string, never> {
  if (req.headers?.[headerKey]) {
    const headerValue = req.headers[headerKey];
    const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (typeof value === 'string') {
      return { [paramKey]: value };
    }
  }
  return {};
}

function safeDecode(rawPath: string): string {
  try {
    return decodeURIComponent(rawPath);
  } catch {
    throw new InvalidRequest('malformed path encoding');
  }
}

/**
 * Extract `key` (S3 object key, no leading slash, decoded) and `query`
 * from an HTTP request. Different frameworks (Express, Fastify) and
 * the raw `http` module expose path/query differently, so we accept
 * both `req.path/req.query` and the raw `req.url`.
 *
 * Throws `InvalidRequest` for malformed percent-encoding or a null
 * byte in the decoded key (S3 rejects these and the surface area is
 * worth guarding against at the boundary).
 */
export function parseRequest(req: HttpRequest): ParsedRequest {
  let rawPath: string;
  let query: Record<string, string | string[]> = {};

  if (typeof req.path === 'undefined') {
    const parsedUrl = parseUrl(req.url, true);
    const rawQuery = parsedUrl.query || {};
    query = Object.fromEntries(
      Object.entries(rawQuery).filter(([, value]) => value !== undefined)
    ) as Record<string, string | string[]>;
    rawPath = parsedUrl.pathname || '';
  } else {
    query = req.query || {};
    rawPath = req.path;
  }

  const decoded = safeDecode(rawPath);
  const key = stripLeadingSlash(decoded);
  if (key.includes('\0')) {
    throw new InvalidRequest('null byte in key');
  }
  return { key, query };
}
