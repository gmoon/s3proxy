# s3proxy
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node CI][actions-image]][actions-url]
[![Docker Pulls][dockerpulls-image]][dockerpulls-url]

**Stream files directly from AWS S3 to your users without downloading them to your server first.**

s3proxy turns an S3 bucket into a web server. Use it to serve static websites, file downloads, or media directly from S3 while keeping control over access, headers, and routing.

## Why s3proxy?

- **Zero server storage**: files stream directly from S3 to users
- **Low latency**: no intermediate downloads or disk buffering
- **Cost effective**: reduce server storage and bandwidth costs
- **Scalable**: backed by S3
- **Range requests**: partial content and resumable downloads
- **Framework support**: Express, Fastify, Hono, and plain `node:http`
- **TypeScript**: typed API, ESM-only
- **Large files**: suited to AI models, datasets, and media assets

## Quick Start

### Breaking changes in v4.0

v4 fixes the v3 error contract and replaces the response-mutating
`proxy.get(req, res)` / `proxy.head(req, res)` / `proxy.healthCheckStream(res)`
wrappers with a single pure entry point: **`proxy.fetch(req)`**.

```typescript
// v3.x: wrapper writes res headers as a side effect, swallows 404 as an empty 200
const stream = await proxy.get(req, res);
stream.pipe(res);

// v4: pure fetch, you write the response
const { stream, status, headers } = await proxy.fetch(req);
res.writeHead(status, headers);
stream.pipe(res);
```

Missing keys, AccessDenied, and InvalidRange now throw typed
`S3NotFound` / `S3Forbidden` / `S3InvalidRange` errors instead of
silently returning empty 200 streams. See [MIGRATION.md](MIGRATION.md)
for the full v3 to v4 migration guide.

ESM-only since v3. No CommonJS support. For CommonJS projects, add
`"type": "module"` to your `package.json` or use dynamic import:
`const { S3Proxy } = await import('s3proxy');`

### Requirements

- **Node.js**: 22.13.0 or higher
- **Package Type**: ESM-only (no CommonJS support)
- **AWS SDK**: v3 (included as dependency)

### Installation & Usage
```bash
npm install s3proxy express
```

```javascript
import express from 'express';
import { S3Proxy } from 's3proxy';

const app = express();
const proxy = new S3Proxy({ bucket: 'your-bucket-name' });

await proxy.init();

app.get('/*splat', async (req, res) => {
  try {
    const { stream, status, headers } = await proxy.fetch(req);
    res.writeHead(status, headers);
    stream.on('error', () => res.end()).pipe(res);
  } catch (err) {
    res.status(err.statusCode || 500).end();
  }
});

app.listen(3000);
```

> **Express 5 path syntax.** The `/*splat` wildcard is Express 5's
> `path-to-regexp` requirement; on Express 4 use `'/*'`. Mixing the
> two forms crashes at route registration.

### Simpler: `proxy.middleware()`

If you don't need a custom error page, skip the try/catch.
`proxy.middleware()` is a handler built on `fetch()` that writes the
status, headers, and body for you. Missing, forbidden, and bad-range
requests return the real 404/403/416 status instead of an empty 200:

```javascript
app.get('/*splat', proxy.middleware());
```

Or write to a response yourself in one call with `proxy.pipe(req, res)`:

```javascript
app.get('/*splat', (req, res) => proxy.pipe(req, res));
```

Both resolve when the body finishes streaming, and neither rejects on a
classified S3 failure; they write the correct status instead. Use the
explicit `fetch()` + try/catch form (below) when you need a custom error
body (XML/HTML), structured logging, or a non-Express framework.

### Static website hosting: `proxy.staticSite()`

`proxy.staticSite()` reproduces the core of S3 static website hosting
(index documents and a custom error page) on a private bucket, with your
app in front of it:

```javascript
// / and /dir/ resolve to index.html; missing or forbidden keys serve
// 404.html with the correct 4xx status.
const site = proxy.staticSite({ indexDocument: 'index.html', errorDocument: '404.html' });
app.use((req, res) => site(req, res));   // app.use so `/` matches too
```

| Request                | Served                                        |
|------------------------|-----------------------------------------------|
| `/`                    | `index.html` (200)                            |
| `/blog/`               | `blog/index.html` (200)                       |
| `/style.css`           | `style.css` (200)                             |
| missing / forbidden    | `404.html` with the original 404/403 status   |

`indexDocument` defaults to `'index.html'` (set it to `''` to disable).
`errorDocument` is optional; without it, 404 and 403 return a plaintext
status. If the error document is itself missing, `staticSite` falls back
to a bare status instead of looping. The core `fetch()` is unchanged and
still throws typed errors. Full example:
[`examples/static-site.ts`](examples/static-site.ts).

Behavior:

- Handles GET and HEAD, and passes Range requests through (a range still
  returns 206 with `Content-Range`).
- Forwards the object's S3 response headers: `content-type`,
  `cache-control`, `etag`, `x-amz-meta-*`, and so on.
- Serves the error document for missing (404) and access-denied (403)
  keys, keeping the original status.

Limitations (differences from an S3 website endpoint):

- A path without a trailing slash is fetched as a literal key.
  `staticSite` does not issue S3's `/photos` to `/photos/` directory
  redirect, which would need an extra lookup.
- Only 404 and 403 use the error document. A 416 (bad range), 400
  (malformed request), or 500 returns a plaintext status.
- No routing rules.

> Mount with `app.use(...)`, not `app.get('/*splat', ...)`: the Express 5
> wildcard doesn't match the root path `/`, so index resolution for `/`
> would be skipped.

### TypeScript/ESM
```bash
npm install s3proxy express
npm install --save-dev @types/express
```

```typescript
import express, { type Request, type Response } from 'express';
import { S3Proxy, S3ProxyError } from 's3proxy';
import type { HttpRequest } from 's3proxy';

const app = express();
const proxy = new S3Proxy({ bucket: 'your-bucket-name' });

await proxy.init();

app.get('/*splat', async (req: Request, res: Response) => {
  try {
    const { stream, status, headers } = await proxy.fetch(req as unknown as HttpRequest);
    res.writeHead(status, headers);
    stream.on('error', () => res.end()).pipe(res);
  } catch (err) {
    const status = err instanceof S3ProxyError ? err.statusCode : 500;
    res.status(status).end();
  }
});

app.listen(3000);
```

Now `curl http://localhost:3000/index.html` serves `s3://your-bucket-name/index.html`

## Usage Examples

### Express Integration with Error Handling

```typescript
import express, { type Request, type Response } from 'express';
import { S3Proxy, S3ProxyError } from 's3proxy';
import type { HttpRequest } from 's3proxy';

const app = express();
const proxy = new S3Proxy({
  bucket: 'my-website-bucket',
  region: 'us-west-2',
});

try {
  await proxy.init();
  console.log('S3Proxy initialized successfully');
} catch (error) {
  console.error('Failed to initialize S3Proxy:', error);
  process.exit(1);
}

function handleError(req: Request, res: Response, err: unknown): void {
  const statusCode = err instanceof S3ProxyError ? err.statusCode : 500;
  const code = err instanceof Error ? err.name : 'InternalError';
  const message = err instanceof Error ? err.message : String(err);
  const errorXml = `<?xml version="1.0"?>
<error code="${code}" statusCode="${statusCode}" url="${req.url}">${message}</error>`;

  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(statusCode).type('application/xml').send(errorXml);
}

app.get('/*splat', async (req: Request, res: Response) => {
  try {
    const { stream, status, headers } = await proxy.fetch(req as unknown as HttpRequest);
    res.writeHead(status, headers);
    stream.on('error', (err) => handleError(req, res, err)).pipe(res);
  } catch (err) {
    handleError(req, res, err);
  }
});

app.listen(3000);
```

### Fastify Integration

```typescript
import Fastify from 'fastify';
import { S3Proxy, S3ProxyError } from 's3proxy';
import type { HttpRequest } from 's3proxy';

const fastify = Fastify({ logger: true });
const proxy = new S3Proxy({
  bucket: 'my-website-bucket',
  region: 'us-west-2',
});

await proxy.init();

fastify.get('/*', async (request, reply) => {
  const { stream, status, headers } = await proxy.fetch(
    request.raw as unknown as HttpRequest
  );
  reply.raw.writeHead(status, headers);
  stream.on('error', () => reply.raw.end());
  stream.pipe(reply.raw);
  // Tell Fastify we've handled the response ourselves.
  return reply.hijack();
});

// Fastify's setErrorHandler turns S3ProxyError instances into XML
// responses with the right status code (it honors err.statusCode).
fastify.setErrorHandler(async (error, request, reply) => {
  const statusCode = error instanceof S3ProxyError ? error.statusCode : 500;
  reply.status(statusCode).type('application/xml').send(`<?xml version="1.0"?>
<error code="${error.name}" statusCode="${statusCode}">${error.message}</error>`);
});

try {
  await fastify.listen({ port: 3000 });
  console.log('Server listening on http://localhost:3000');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
```

### Web Standard runtimes (Hono, Bun, Workers, Deno)

**`proxy.fetchWeb(request)`** is the Web-runtime convenience adapter over
`fetch()` (the counterpart of `pipe()` / `middleware()` for Node). It takes a
Web `Request` and returns a Web `Response`, so it is not tied to Hono - it
works with any framework exposing the raw `Request`, or as a runtime's
top-level `fetch` handler. With Hono it is one line:

```typescript
import { Hono } from 'hono';
import { S3Proxy, S3ProxyError } from 's3proxy';

const proxy = new S3Proxy({ bucket: 'my-website-bucket' });
await proxy.init();

const app = new Hono();

app.get('/health', async (c) => {
  await proxy.healthCheck();
  return c.text('OK');
});

// One line: Web Request -> Web Response. fetchWeb throws the typed
// S3ProxyError on 404/403/416, which app.onError renders below.
app.on(['GET', 'HEAD'], '/*', (c) => proxy.fetchWeb(c.req.raw));

app.onError((err) => {
  const status = err instanceof S3ProxyError ? err.statusCode : 500;
  return new Response(err.message, { status });
});
```

On other Web runtimes it is equally direct as the top-level handler:

```typescript
// Bun / Deno / Cloudflare Workers
export default { fetch: (req: Request) => proxy.fetchWeb(req) };
```

`fetchWeb` throws rather than rendering (it is the peer of `fetch()`, not
`pipe()`), so your framework's error handler owns the error-body format.
If you need to build the `Response` yourself (custom headers or error
body), call `fetch()` directly and adapt the stream:

```typescript
import { Readable } from 'node:stream';

const { stream, status, headers } = await proxy.fetch({
  url: new URL(c.req.url).pathname,
  method: c.req.method,
  headers: Object.fromEntries(c.req.raw.headers),
});
return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers });
```

> **Performance note.** On Node, Hono goes through `@hono/node-server`
> which converts `IncomingMessage` and `Web Request/Response` on every
> request, two extra layers compared with Express's direct
> `stream.pipe(res)`. For network-bound streaming (the typical s3proxy
> workload, where S3 round-trip time dominates) the conversion cost is
> negligible, and the smoke test's per-example latency baseline shows
> parity with Express and Fastify on small files. For CPU-bound paths
> measured in microseconds, prefer the Express or Fastify examples. On
> Bun, Workers, and Deno there is no conversion layer.

### Framework Compatibility

s3proxy is **framework-agnostic** and works with any Node.js HTTP framework that provides access to the underlying request and response objects:

- **[Express](https://expressjs.com/)** - Fast, unopinionated web framework ✅
- **[Fastify](https://fastify.dev/)** - Fast and low overhead web framework ✅
- **[Hono](https://hono.dev/)** - Web Standards framework (Bun/Workers/Deno/Node) ✅
- **[Koa](https://koajs.com/)** - Expressive middleware framework ✅
- **[Hapi](https://hapi.dev/)** - Rich framework for building applications ✅
- **[NestJS](https://nestjs.com/)** - Progressive Node.js framework ✅
- **[Next.js API Routes](https://nextjs.org/)** - Full-stack React framework ✅
- **[Nuxt.js Server API](https://nuxt.com/)** - Vue.js framework ✅
- **[SvelteKit](https://kit.svelte.dev/)** - Web development framework ✅
- **[Remix](https://remix.run/)** - Full stack web framework ✅
- **[AWS Lambda](https://aws.amazon.com/lambda/)** - Serverless functions ✅
- **[Vercel Functions](https://vercel.com/docs/functions)** - Edge and serverless functions ✅
- **[Netlify Functions](https://www.netlify.com/products/functions/)** - Serverless functions ✅

**Key requirement**: the framework must give you a request with `url`,
`method`, and `headers` (or `path`/`query`). All of the frameworks above
expose this, usually as `req.raw`, `request.raw`, or `request.req`.
Since `proxy.fetch()` returns `{ stream, status, headers }` and never
touches a response, you wire the response however the framework prefers
(`res.writeHead`, a `Web Response`, `reply.send`, and so on).

### Range Requests (Partial Content)

s3proxy handles HTTP Range requests for efficient streaming of large files:

```bash
# Download only bytes 0-99 of a large file
curl --range 0-99 http://localhost:3000/large-video.mp4 -o partial.mp4
```

### Large File Streaming

Stream large assets without server storage:

```typescript
// Stream AI models, datasets, or media files
app.get('/models/:version/*splat', async (req: Request, res: Response) => {
  try {
    const { stream, status, headers } = await proxy.fetch(req as unknown as HttpRequest);
    res.writeHead(status, headers);
    stream.on('error', () => res.end()).pipe(res);
  } catch (err) {
    res.status((err as { statusCode?: number }).statusCode || 500).end();
  }
});

// Now serve multi-GB files without local storage:
// GET /models/v1/llama-7b.bin streams from S3
```

### Health Checks

Built-in health check endpoint for load balancers:

```typescript
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await proxy.healthCheck();   // throws S3ProxyError on failure
    res.status(200).type('text/plain').send('OK');
  } catch (err) {
    const status = err instanceof S3ProxyError ? err.statusCode : 503;
    res.status(status).type('text/plain').send('unhealthy');
  }
});
```

## Configuration

### Constructor Options

```typescript
import { S3Proxy } from 's3proxy';
import type { S3ProxyConfig } from 's3proxy';

const config: S3ProxyConfig = {
  bucket: 'my-bucket',        // Required: S3 bucket name
  region: 'us-west-2',        // Optional: AWS region
  credentials: {              // Optional: AWS credentials
    accessKeyId: 'AKIA...',
    secretAccessKey: '...'
  },
  endpoint: 'https://...',    // Optional: Custom S3 endpoint
  maxAttempts: 3,            // Optional: Retry attempts
  requestTimeout: 30000      // Optional: Request timeout in ms
};

const proxy = new S3Proxy(config);
```

### Environment Variables

- `BUCKET` - S3 bucket name
- `PORT` - Server port (default: 3000)
- `AWS_REGION` - AWS region
- `NODE_ENV` - Environment (enables credential file in dev mode)

## API Reference

### Class: S3Proxy

#### Constructor
```typescript
new S3Proxy(config: S3ProxyConfig)
```

#### Methods

##### `await proxy.init(): Promise<void>`
Initialize the underlying S3 client. By default also runs
`healthCheck()` against the bucket and rejects on failure (set
`verifyOnInit: false` to skip the probe; see
[verifyOnInit](#verifyoninit-for-orchestrators)).

##### `await proxy.fetch(req: HttpRequest): Promise<S3FetchResponse>`
Pure fetch. Returns `{ stream, status, headers }` without touching a
response. Dispatches GET vs HEAD based on `req.method` (defaults to
GET). Throws a typed `S3ProxyError` on classified failures (404, 403,
416, malformed request); rethrows anything else. This is the primitive
the convenience adapters below are built on.

##### `await proxy.pipe(req: HttpRequest, res: HttpResponse): Promise<void>`
Convenience over `fetch()`: writes status + headers and pipes the body to
`res`. Resolves when the body finishes; writes the real 404/403/416 for a
classified S3 failure and does **not** reject for it. Rejects only if
`res.writeHead` throws. Use `fetch()` directly when you need a custom
error body.

##### `proxy.middleware(): (req, res, next?) => void`
Returns an Express/Connect handler built on `pipe()`. Drop it straight
into a route: `app.get('/*splat', proxy.middleware())`. Unexpected
(non-classified) errors are forwarded to `next` when present.

##### `proxy.staticSite(options?: StaticSiteOptions): (req, res, next?) => void`
Returns a handler that reproduces the core of S3 static website hosting
on top of `fetch()`: index-document resolution (`/` to `index.html`,
`/dir/` to `dir/index.html`) and, when `errorDocument` is set, serving it
with the original status for missing (404) and forbidden (403) keys.
Handles GET and HEAD and passes Range requests through. It does not
perform S3's trailing-slash directory redirect, and only 404/403 use the
error document. Mount with `app.use(...)` so the root path `/` is matched.
See [Static website hosting](#static-website-hosting-proxystaticsite).

##### `await proxy.fetchWeb(request: Request): Promise<Response>`
The Web-runtime adapter over `fetch()`: takes a Web `Request`, returns a Web
`Response` streaming the object. The Web analog of `pipe()` / `middleware()`,
for any WHATWG-fetch runtime (Bun, Deno, Cloudflare Workers, Node) and any
framework exposing the raw `Request` -
`app.on(['GET','HEAD'], '/*', (c) => proxy.fetchWeb(c.req.raw))` or
`export default { fetch: (req) => proxy.fetchWeb(req) }`. Unlike `pipe()` it
does **not** render errors: it throws the typed `S3ProxyError` on 404/403/416,
so your framework's error handler owns the error-body format. HEAD responses
have a `null` body. Uses the runtime's global `Request` / `Response`; no extra
dependency.

##### `await proxy.healthCheck(): Promise<void>`
Verify bucket connectivity. Resolves on success, throws a typed
`S3ProxyError` on failure. Use it from a `/health` or `/ready` handler
and render the response yourself.

##### `proxy.isInitialized(): void`
Throws `UserException` if `init()` hasn't been called yet.

#### Static Methods

##### `S3Proxy.version(): string`
The library version.

#### Free functions exported from `'s3proxy'`

`parseRequest(req)`, `mapHeaderToParam(req, headerKey, paramKey)`, and
`stripLeadingSlash(s)` are exported as free functions. They previously
lived as `S3Proxy.parseRequest` and so on; the move makes them
tree-shakeable for callers that just want the parser.

### Types

```typescript
interface S3ProxyConfig extends S3ClientConfig {
  bucket: string;
  /**
   * If true (default), init() calls healthCheck() and rejects when
   * the bucket is unreachable, to fail fast on misconfiguration.
   * Set to false in orchestrator deployments (Kubernetes, ECS).
   */
  verifyOnInit?: boolean;
}

/** What proxy.fetch() returns. */
interface S3FetchResponse {
  stream: NodeJS.ReadableStream;
  status: number;
  headers: Record<string, string>;
}

/**
 * Structural subset of an HTTP request that proxy.fetch() reads.
 * Express's Request, Fastify's request.raw, and Node's IncomingMessage
 * all satisfy it (with light casts).
 */
interface HttpRequest {
  url: string;
  method?: string;
  headers: Record<string, string | string[]>;
  path?: string;
  query?: Record<string, string | string[]>;
}

interface ParsedRequest {
  key: string;
  query: Record<string, string | string[]>;
}

/**
 * Structural response the convenience adapter (pipe/middleware/staticSite)
 * writes to. Node's ServerResponse, Express's Response, and Fastify's
 * reply.raw all satisfy it. The pure fetch() primitive never touches it.
 */
interface HttpResponse extends NodeJS.WritableStream {
  writeHead(statusCode: number, headers?: Record<string, string>): unknown;
  readonly headersSent?: boolean;
}

/** Options for proxy.staticSite(). */
interface StaticSiteOptions {
  indexDocument?: string;  // default 'index.html'; '' disables
  errorDocument?: string;  // optional; served with the original 4xx status
}
```

### Error Handling

```typescript
import {
  S3ProxyError,    // base class (statusCode, code, cause)
  S3NotFound,      // 404: NoSuchKey or NoSuchBucket
  S3Forbidden,     // 403: AccessDenied
  S3InvalidRange,  // 416: InvalidRange
  // InvalidRequest: 400, thrown by parseRequest for malformed input
} from 's3proxy';

try {
  const { stream, status, headers } = await proxy.fetch(req);
  res.writeHead(status, headers);
  stream.pipe(res);
} catch (err) {
  if (err instanceof S3NotFound)     return send404(res);
  if (err instanceof S3Forbidden)    return send403(res);
  if (err instanceof S3InvalidRange) return send416(res);
  if (err instanceof S3ProxyError)   return res.status(err.statusCode).end();
  throw err;  // unknown: let the framework's error handler take it
}
```

The proxy is also an `EventEmitter`. It emits `init` when `init()`
resolves and `error` when it rejects, which is useful for logging
dashboards.

```typescript
proxy.on('error', (err: Error) => console.error('S3Proxy error:', err));
proxy.on('init',  () => console.log('S3Proxy initialized'));
```

### `verifyOnInit` for orchestrators

In Kubernetes/ECS deployments, you typically want the platform's own
readiness probe to determine health rather than crash-looping the pod
when S3 has a hiccup at boot. Pass `verifyOnInit: false` and call
`proxy.healthCheck()` from your readiness handler instead.

```typescript
const proxy = new S3Proxy({ bucket: 'my-bucket', verifyOnInit: false });
await proxy.init();   // resolves immediately, no S3 traffic

app.get('/ready', async (_req, res) => {
  try {
    await proxy.healthCheck();
    res.status(200).send('ready');
  } catch (err) {
    res.status(503).send(String(err));
  }
});
```

## Deployment

You can deploy s3proxy as your own Node app (the examples above) or run the
prebuilt container. The three common paths:

### Docker

```bash
docker run --env BUCKET=mybucket --env PORT=8080 --publish 8080:8080 -t forkzero/s3proxy:latest
```

The `forkzero/s3proxy` image is published from
[`forkzero/s3proxy-docker`](https://github.com/forkzero/s3proxy-docker) with the
tags `X.Y.Z`, `X.Y`, and `latest`. `latest` is shown here for quick start; pin a
specific version for production (for example `forkzero/s3proxy:4.2`).

### AWS Fargate

To run the container on AWS Fargate behind an Application Load Balancer, use the
reference CloudFormation stack in
[`forkzero/s3proxy-docker` → `deploy/aws-ecs/`](https://github.com/forkzero/s3proxy-docker/tree/main/deploy/aws-ecs).
It parameterizes your VPC, subnets, and bucket, scopes the task role to
`s3:GetObject` on that bucket, health-checks `/health`, and makes HTTPS + DNS
optional. Its README walks through deploying — including pointing it at the
public `s3proxy-public` demo bucket to see it work end to end.

In orchestrators (Fargate/ECS, Kubernetes) you typically disable s3proxy's own
startup check and rely on the platform's readiness probe — see
[`verifyOnInit` for orchestrators](#verifyoninit-for-orchestrators).

### Local development with temporary credentials

For local development with temporary AWS credentials, write a session
token to `~/.s3proxy/credentials.json` and bind-mount it into the
container. Keeping credentials in your home directory (not the repo
root) avoids any chance of committing them:

```bash
mkdir -p ~/.s3proxy
aws sts get-session-token --duration 900 > ~/.s3proxy/credentials.json
docker run \
  -v ~/.s3proxy/credentials.json:/src/credentials.json:ro \
  -e BUCKET=mybucket \
  -e PORT=8080 \
  -e NODE_ENV=dev \
  -p 8080:8080 \
  -t forkzero/s3proxy:latest
```

## Development

### TypeScript Development

```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check
```

### Testing & Quality Assurance

Tests run across several dimensions:

#### Test Coverage Matrix

| **Test Type** | **Local (Makefile)** | **CI (GitHub Actions)** | **Description** |
|---------------|----------------------|-------------------------|-----------------|
| **Code Quality** | | | |
| Lint | `make lint` | ✅ Node CI | Code style and quality checks |
| Type Check | `make type-check` | ✅ Node CI | TypeScript type safety validation |
| Security Audit | `npm audit` | ✅ Node CI | Dependency vulnerability scanning |
| **Unit Testing** | | | |
| Unit Tests | `make unit-tests` | ✅ Node CI | Core functionality testing |
| Coverage | `npm run test:coverage` | ✅ Node CI | Code coverage reporting (96%+) |
| **Integration Testing** | | | |
| Build Verification | `make build` | ✅ Node CI | TypeScript compilation |
| Package Verification | `make pre-release-check` | ✅ Node CI | npm package integrity |
| **Functional Testing** | | | |
| Validation Tests | `make test-validation-docker` | ✅ Node CI | 24 comprehensive functionality tests |
| Binary Integrity | Included in validation | ✅ Node CI | File corruption detection |
| Range Requests | Included in validation | ✅ Node CI | HTTP range request handling |
| Error Handling | Included in validation | ✅ Node CI | Proper error status codes |
| **Performance Testing** | | | |
| Load Testing | `make artillery-docker` | ✅ Node CI | High-throughput performance |
| Stress Testing | `make test-performance` | ✅ Node CI | Resource usage under load |
| **Platform Testing** | | | |
| Docker Integration | `make test-all-docker` | ✅ Node CI | Containerized deployment |
| Multi-Node | Node 22, 23 | ✅ Node CI | Cross-version compatibility |

#### Test Commands

```bash
# Run all tests locally
make all                    # Complete test suite
make test                   # Core tests (build, lint, unit)
make functional-tests       # Integration and Docker tests

# Individual test categories
make test-validation-docker # 24 comprehensive validation tests
make artillery-docker       # Performance/load testing

# Quality checks
make pre-release-check     # Complete pre-release verification
```

#### Continuous Integration

- **Every Push**: Core tests (lint, type-check, build, unit tests)
- **Master Branch**: Full test suite including validation and performance
- **Pull Requests**: Complete verification before merge
- **Releases**: Comprehensive pre-release checks

### Project Structure

```
src/
├── index.ts           # S3Proxy orchestrator
├── request-parser.ts  # parseRequest, mapHeaderToParam, etc.
├── s3-gateway.ts      # AWS SDK boundary; turns SDK output into S3FetchResponse
├── errors.ts          # S3ProxyError + S3NotFound / S3Forbidden / S3InvalidRange / InvalidRequest
├── UserException.ts   # Caller-misuse errors (uninitialized, missing bucket)
├── types.ts           # Public type definitions
└── version.ts         # Version (read from package.json at module load)

examples/
├── express-basic.ts  # TypeScript Express example
├── fastify-basic.ts  # TypeScript Fastify example
├── fastify-docker.ts # Dockerized Fastify example
├── hono-basic.ts     # Hono / Web Standards example
├── static-site.ts    # staticSite index + error document example
└── http.ts           # TypeScript node:http example

test/
├── s3proxy.test.ts         # Constructor / init / healthCheck / verifyOnInit
├── fetch.test.ts           # proxy.fetch() behavioral coverage
├── pipe.test.ts            # proxy.pipe() and proxy.middleware()
├── static-site.test.ts     # proxy.staticSite() behavior
├── parse-request.test.ts   # parseRequest unit tests (incl. malformed encoding)
├── mock-express.test.ts    # Express request-shape compatibility
├── mock-fastify.test.ts    # Fastify request-shape compatibility
├── streaming-memory.test.ts # 100MB synthetic body, peak RSS bound
├── concurrent.test.ts      # 10 parallel fetch() calls
├── version.test.ts         # Version tests
├── imports-esm.test.ts     # ESM import tests
├── package-exports.test.ts # Package export tests
├── helpers/
│   └── aws-mock.ts         # AWS SDK mocking utilities
└── integration/
    └── validation.test.js  # End-to-end validation tests
```

### Configuration Files

s3proxy uses several configuration files for different aspects of development and deployment:

#### TypeScript Configuration
- **`tsconfig.json`** - Main TypeScript compiler configuration
  - Compiles `src/` to `dist/src/` for npm package
  - ES2022 target with NodeNext module resolution
  - Strict type checking enabled
- **`tsconfig.examples.json`** - Type checking for examples
  - Extends main config with examples-specific settings
  - Used by `npm run type-check` to validate examples
  - Ensures examples stay current with API changes

#### Testing & Quality
- **`vitest.config.ts`** - Unit test configuration
  - Unit test settings with 30s timeout
  - Coverage reporting (text, HTML, LCOV, JSON)
  - Coverage thresholds: branches 85%, functions 95%, lines/statements 90%
  - Excludes integration tests and examples from unit test runs
- **`vitest.integration.config.ts`** - Integration test configuration
  - Runs validation tests that require a live server
  - Used by `npm run test:validation` and Makefile targets
  - Separate from unit tests for faster development workflow
- **`biome.json`** - Code formatting and linting
  - Fast alternative to ESLint + Prettier
  - Consistent code style across the project
  - Import organization and formatting rules

#### Release & CI/CD
- **`.releaserc.json`** - Semantic release configuration
  - Conventional commits for automated versioning
  - Generates CHANGELOG.md automatically
  - Publishes to npm and creates GitHub releases
  - Handles version bumping and git tagging

#### GitHub Actions
- **`.github/workflows/nodejs.yml`** - Main CI pipeline
  - Core tests (lint, type-check, build, unit tests)
  - Validation tests (24 comprehensive functionality tests)
  - Performance testing with Artillery
  - Package verification
- **`.github/workflows/release.yml`** - Automated releases
- **`.github/workflows/manual-release.yml`** - Manual release workflow

#### Performance Testing

Artillery load-test configs and scenarios come from
[`@forkzero/s3-website-test-kit`](https://www.npmjs.com/package/@forkzero/s3-website-test-kit),
a devDependency shared with `forkzero/s3proxy-docker`. `make artillery-docker`
runs the kit's `configs/load-test.yml` + `scenarios/core/load-test.yml` against
the container. The kit is target-agnostic (native S3 website hosting or
s3proxy); its `scenarios/core/` are portable, and `scenarios/s3proxy/` holds the
s3proxy-only checks (for example `/health`).
  - `range-requests.yml` - HTTP range request testing

#### Development Tools
- **`.vscode/settings.json`** - VS Code workspace settings
  - Disables automatic Makefile configuration prompts
- **`.github/dependabot.yml`** - Automated dependency updates
- **`Makefile`** - Build automation and testing orchestration
  - Coordinates Docker and Artillery testing
  - Provides consistent commands across environments

#### AWS & Docker
- **[AWS Fargate reference deployment](https://github.com/forkzero/s3proxy-docker/tree/main/deploy/aws-ecs)** -
  parameterized CloudFormation stack (in `forkzero/s3proxy-docker`); see
  [Deployment](#deployment) above
- **`examples/aws-ecs/`** - the forkzero-specific ECS stack this project runs
  (account-specific; use the reference above for your own deploy)

## Use Cases

- **Static websites** - Serve React/Vue/Angular builds from S3
- **File downloads** - Stream large files without server storage
- **Media serving** - Video/audio streaming with range request support
- **API backends** - Serve user uploads or generated content
- **AI & ML workflows** - Stream models, datasets, and training data
- **CDN alternative** - Cost-effective content delivery

## Performance

See [docs/performance.md](docs/performance.md) for detailed performance testing and benchmarks.

## Getting Help

- [Maintenance Guide](docs/maintenance.md): for contributors and advanced usage
- [Report issues](https://github.com/gmoon/s3proxy/issues)
- [Discussions](https://github.com/gmoon/s3proxy/discussions)

## Contributing

Contributions are welcome. See the [Maintenance Guide](docs/maintenance.md) for development setup and contribution guidelines.

## License

Apache 2.0 - see [LICENSE](LICENSE) file.

[npm-image]: https://img.shields.io/npm/v/s3proxy.svg
[npm-url]: https://npmjs.org/package/s3proxy
[downloads-image]: https://img.shields.io/npm/dm/s3proxy.svg
[downloads-url]: https://npmjs.org/package/s3proxy
[actions-image]: https://github.com/gmoon/s3proxy/workflows/Node%20CI/badge.svg
[actions-url]: https://github.com/gmoon/s3proxy/actions
[dockerpulls-image]: https://img.shields.io/docker/pulls/forkzero/s3proxy.svg
[dockerpulls-url]: https://hub.docker.com/r/forkzero/s3proxy
