/**
 * S3Proxy Hono Example
 *
 * Demonstrates that proxy.fetch() works with Web-Standards runtimes
 * (Bun, Cloudflare Workers, Deno) where Hono is the de facto framework.
 *
 * On Node, Hono goes through `@hono/node-server` which converts
 * IncomingMessage ↔ Web Request/Response. For network-bound streaming
 * (the typical s3proxy workload) the conversion is unmeasurable; on
 * Bun/Workers/Deno the conversion layer doesn't exist at all and
 * Hono is the natural fit.
 */

import { Readable } from 'node:stream';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { S3Proxy, S3ProxyError } from '../src/index.js';
import type { HttpRequest } from '../src/types.js';

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

app.on(['GET', 'HEAD'], '/*', async (c) => {
  // HttpRequest.url is path+query (Node-style); c.req.url is absolute, so parse out the path.
  const url = new URL(c.req.url);
  // HttpRequest expects Record<string, string|string[]> (Node convention);
  // c.req.raw.headers is a Web `Headers` object. Adapting at this single
  // boundary keeps the library focused on one header shape rather than
  // exposing a dual-shape API for every framework.
  const { stream, status, headers } = await proxy.fetch({
    url: url.pathname + url.search,
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers),
  } as HttpRequest);
  // Node Readable → Web ReadableStream so it fits in a Web Response.
  // Backpressure propagates through the wrapper; no buffering.
  const body = Readable.toWeb(stream as Readable) as ReadableStream;
  return new Response(body, { status, headers });
});

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
