/**
 * S3Proxy Hono Example
 *
 * Demonstrates that proxy.fetchWeb() works with Web-Standards runtimes
 * (Bun, Cloudflare Workers, Deno) where Hono is the de facto framework.
 *
 * On Node, Hono goes through `@hono/node-server` which converts
 * IncomingMessage ↔ Web Request/Response. For network-bound streaming
 * (the typical s3proxy workload) the conversion is unmeasurable; on
 * Bun/Workers/Deno the conversion layer doesn't exist at all and
 * Hono is the natural fit.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { S3Proxy, S3ProxyError } from '../src/index.js';

const port = Number(process.env.PORT) || 0;
const bucket = process.env.BUCKET || 's3proxy-public';

const proxy = new S3Proxy({ bucket });
await proxy.init();

const app = new Hono();

app.get('/health', async (c) => {
  await proxy.healthCheck();
  return c.text('OK');
});

app.get('/', (c) => c.redirect('/index.html'));

// fetchWebKey() names the S3 key explicitly — the URL does NOT select the key.
// This alias map stands in for a real lookup (a DB row, a signed-token resolver,
// a per-tenant prefix): the public id is decoupled from the storage key, and the
// key is served verbatim, so keys with reserved characters (%, spaces, +, ...)
// need no URL-encoding contortions — the exact failure fetchWeb's URL path can't
// avoid. `special` points at an object whose key is a pile of reserved chars.
const KEY_ALIASES: Record<string, string> = {
  home: 'index.html',
  special: 'specialCharacters!-_.*\'()&$@=;:+  ,?\\{^}%`]">[~<#|.',
};
app.get('/download/:id', (c) => {
  const key = KEY_ALIASES[c.req.param('id')];
  if (key === undefined) return new Response('unknown id', { status: 404 });
  return proxy.fetchWebKey(key, c.req.raw);
});

// fetchWeb adapts the Web `Request` -> `Response` in one line, so nothing here
// re-encodes the library's HttpRequest shape or the stream conversion. It throws
// the typed S3ProxyError on 404/403/416, which the app's onError below renders.
app.on(['GET', 'HEAD'], '/*', (c) => proxy.fetchWeb(c.req.raw));

// Plain-text errors (vs. the XML payloads in examples/express-basic.ts and
// examples/fastify-basic.ts) — XML body conventions don't fit Bun/Workers/Deno
// targets where Hono is most idiomatic. Adapt to your runtime's conventions.
app.onError((err) => {
  // Raw Response (not c.text) so any numeric status passes through —
  // Hono's c.text constrains to a typed `ContentfulStatusCode` union that
  // wouldn't accept e.g. 416 without a per-call cast.
  const status = err instanceof S3ProxyError ? err.statusCode : 500;
  return new Response(err.message, { status });
});

if (port > 0) {
  serve({ fetch: app.fetch, port }, ({ port: actualPort }) => {
    console.log(`S3Proxy Hono server running on port ${actualPort}, serving bucket: ${bucket}`);
  });
}

export default app;
