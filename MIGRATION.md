# Migrating to s3proxy v4.0

v4.0 fixes the v3 error contract and decomposes a 288-line god class into
parser + gateway + orchestrator. The library is the same idea — stream S3
objects to HTTP responses without buffering on your server — with a
smaller, more honest surface.

## What broke and why

### 1. The error contract: typed throws instead of empty streams

In v3, requesting a missing key returned a fully-formed empty stream with
status 200. AccessDenied, InvalidRange, and NoSuchBucket were absorbed
the same way. Callers had no way to distinguish a successful zero-byte
file from a swallowed 404.

v4 throws **typed errors** instead. The original AWS SDK error is
attached as `cause` for diagnostics.

```typescript
import { S3NotFound, S3Forbidden, S3InvalidRange, S3ProxyError } from 's3proxy';

try {
  const { stream, status, headers } = await proxy.fetch(req);
  res.writeHead(status, headers);
  stream.pipe(res);
} catch (err) {
  if (err instanceof S3NotFound)     return send404(res, err);
  if (err instanceof S3Forbidden)    return send403(res, err);
  if (err instanceof S3InvalidRange) return send416(res, err);
  if (err instanceof S3ProxyError)   return sendStatus(res, err.statusCode, err);
  // anything else is a programming bug or AWS network failure
  return send500(res, err);
}
```

All typed errors expose `statusCode`, plus `cause` (the underlying
SDK error). Discriminate by `instanceof` (preferred) or by `err.name`
(`'S3NotFound'`, `'S3Forbidden'`, `'S3InvalidRange'`, `'InvalidRequest'`).
They all extend `S3ProxyError`, which extends `Error`.

**Important shift in *where* the error fires.** In v3, 404/403/416 came
back as a successful empty stream — your `stream.on('error', ...)`
handler never saw them. In v4, those throw from `proxy.fetch()` itself,
*before* `res.writeHead` runs. So a v3 stream-error handler that was
catching these will now see nothing — wrap the `await proxy.fetch()`
call in a try/catch instead.

### 2. `proxy.get(req, res)` / `proxy.head(req, res)` / `proxy.healthCheckStream(res)` are gone

These wrappers wrote response headers as a side effect, which made the
proxy hard to reuse (Web Response, file persistence, response caching,
custom framework adapters all worked against the grain). v4 ships a
single pure entry point: **`proxy.fetch(req)`**.

```typescript
// v3.x
const stream = await proxy.get(req, res);
stream.on('error', err => res.status(err.statusCode || 500).end()).pipe(res);

// v4
const { stream, status, headers } = await proxy.fetch(req);
res.writeHead(status, headers);
stream.on('error', () => res.end()).pipe(res);
// (errors during S3 connection still throw before writeHead is called.)
```

For HEAD: set `req.method = 'HEAD'` (or pass `{ ...req, method: 'HEAD' }`).
`fetch()` dispatches GET vs HEAD by `req.method`, defaults to GET.

The response shape is also renamed: where v3's internal
`S3ProxyResponse` had `s3stream` and `statusCode`, the v4 public
`S3FetchResponse` has `stream` and `status`. (Headers stayed
`headers`.)

For health endpoints: call `proxy.healthCheck()` instead of
`proxy.healthCheckStream(res)`. It throws on failure; render the response
yourself.

```typescript
// v3.x
app.get('/health', async (_req, res) => {
  const stream = await proxy.healthCheckStream(res);
  stream.on('error', () => res.end()).pipe(res);
});

// v4
app.get('/health', async (_req, res) => {
  await proxy.healthCheck();   // throws S3ProxyError on bucket reachability failure
  res.status(200).send('OK');
});
```

### 3. `S3Proxy.parseRequest` / `S3Proxy.mapHeaderToParam` / `S3Proxy.stripLeadingSlash` are no longer static methods

They moved to `s3proxy/request-parser` and are exported from the package
root as free functions:

```typescript
// v3.x
import { S3Proxy } from 's3proxy';
const { key, query } = S3Proxy.parseRequest(req);

// v4
import { parseRequest } from 's3proxy';
const { key, query } = parseRequest(req);
```

`parseRequest` now also throws **`InvalidRequest`** for malformed
percent-encoding (`/foo%ZZ`) and null-byte keys. If you were relying on
the old behavior of letting `URIError` bubble up, catch `InvalidRequest`
and translate to HTTP 400.

### 4. `S3Proxy.isNonFatalError` removed

The empty-stream substitution it gated is gone, so the predicate has no
purpose. Use `instanceof S3ProxyError` (or its subclasses) instead.

### 5. `HttpRequest` is now a structural type, `HttpResponse` is no longer exported

`HttpRequest` is the minimal structural subset that `proxy.fetch()`
reads: `{ url, method?, headers, path?, query? }`. Express `Request`,
Fastify `request.raw`, and Node `IncomingMessage` all satisfy it
(usually with a small `as unknown as HttpRequest` cast). It no longer
extends `IncomingMessage`.

`HttpResponse` was only useful for the deleted `proxy.get(req, res)`
APIs. v4 doesn't take a response, so the type is gone — use Node's
`ServerResponse` directly when you need to type one.

## New: `verifyOnInit` for orchestrator deployments

`init()` calls `healthCheck()` by default and rejects on failure.
That's right for most apps. In Kubernetes/ECS deployments, this can
crashloop a pod when S3 has a transient hiccup or the bucket name is
mistyped — before logs/dashboards can surface what's wrong. Set
`verifyOnInit: false` and let your platform's readiness probe drive
health.

```typescript
const proxy = new S3Proxy({ bucket: 'my-bucket', verifyOnInit: false });
await proxy.init();   // now resolves immediately, no S3 traffic

app.get('/ready', async (_req, res) => {
  try {
    await proxy.healthCheck();
    res.status(200).send('ready');
  } catch (err) {
    res.status(503).send(String(err));
  }
});
```

## "I just want the old behavior"

Pin to v3.x:

```bash
npm install s3proxy@^3.0.0
```

The v3 line stays usable; it just doesn't get the typed-error contract,
the parser/gateway split, or the `verifyOnInit` option.

## Migration cheat sheet

| v3.x                                    | v4                                                            |
|-----------------------------------------|---------------------------------------------------------------|
| `proxy.get(req, res)`                   | `await proxy.fetch(req)` + `res.writeHead(status, headers)`   |
| `proxy.head(req, res)`                  | `await proxy.fetch({...req, method: 'HEAD'})` + `writeHead`   |
| `proxy.healthCheckStream(res)`          | `await proxy.healthCheck()` (throws on failure)               |
| 404/403/416 → empty 200 stream          | throws `S3NotFound` / `S3Forbidden` / `S3InvalidRange`        |
| `S3Proxy.parseRequest(req)`             | `parseRequest(req)` (free function from `'s3proxy'`)          |
| `S3Proxy.isNonFatalError(e)`            | `e instanceof S3ProxyError`                                   |
| `import type { HttpResponse }`          | use Node's `ServerResponse` directly                          |
| (no init opt-out)                       | `new S3Proxy({ bucket, verifyOnInit: false })`                |

## Common error handler (Express)

```typescript
import express, { type Request, type Response } from 'express';
import { S3Proxy, S3ProxyError } from 's3proxy';
import type { HttpRequest } from 's3proxy';

const proxy = new S3Proxy({ bucket: 'my-bucket' });
await proxy.init();

app.get('/*splat', async (req: Request, res: Response) => {
  try {
    const { stream, status, headers } = await proxy.fetch(req as unknown as HttpRequest);
    res.writeHead(status, headers);
    stream.on('error', () => res.end()).pipe(res);
  } catch (err) {
    const status = err instanceof S3ProxyError ? err.statusCode : 500;
    res.status(status).type('text/plain').send(String(err));
  }
});
```
