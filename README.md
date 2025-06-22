# s3proxy
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node CI][actions-image]][actions-url]
[![Docker Pulls][dockerpulls-image]][dockerpulls-url]

**Stream files directly from AWS S3 to your users without downloading them to your server first.**

s3proxy turns any S3 bucket into a high-performance web server. Perfect for serving static websites, file downloads, or media content directly from S3 while maintaining full control over access, headers, and routing.

## Why s3proxy?

- **Zero server storage** - Files stream directly from S3 to users
- **Lightning fast** - No intermediate downloads or caching delays  
- **Cost effective** - Reduce server storage and bandwidth costs
- **Scalable** - Leverage S3's global infrastructure
- **Range requests** - Support for partial content and resumable downloads
- **Express integration** - Drop into existing Node.js applications
- **TypeScript support** - Full type safety and modern tooling

## Quick Start

### ⚠️ Breaking Change in v3.0.0

**s3proxy v3.0.0+ is ESM-only and requires Node.js 22.13.0+**

If you're upgrading from v2.x:

```javascript
// ❌ v2.x (CommonJS) - No longer supported
const { S3Proxy } = require('s3proxy');

// ✅ v3.x (ESM) - New syntax
import { S3Proxy } from 's3proxy';
```

For CommonJS projects, you have two options:
1. **Recommended**: Migrate to ESM by adding `"type": "module"` to your `package.json`
2. **Alternative**: Use dynamic import: `const { S3Proxy } = await import('s3proxy');`

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

app.get('/*', async (req, res) => {
  const stream = await proxy.get(req, res);
  stream.on('error', err => res.status(err.statusCode || 500).end()).pipe(res);
});

app.listen(3000);
```

### TypeScript/ESM
```bash
npm install s3proxy express
npm install --save-dev @types/express
```

```typescript
import express from 'express';
import { S3Proxy } from 's3proxy';
import type { HttpRequest, HttpResponse } from 's3proxy';

const app = express();
const proxy = new S3Proxy({ bucket: 'your-bucket-name' });

await proxy.init();

app.get('/*', async (req, res) => {
  try {
    const stream = await proxy.get(req as HttpRequest, res as HttpResponse);
    stream.on('error', (err: any) => {
      res.status(err.statusCode || 500).end();
    }).pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

app.listen(3000);
```

Now `curl http://localhost:3000/index.html` serves `s3://your-bucket-name/index.html`

## Usage Examples

### Express Integration with Error Handling

```typescript
import express, { type Request, type Response } from 'express';
import { S3Proxy } from 's3proxy';
import type { HttpRequest, HttpResponse } from 's3proxy';

const app = express();
const proxy = new S3Proxy({ 
  bucket: 'my-website-bucket',
  region: 'us-west-2'
});

// Initialize with proper error handling
try {
  await proxy.init();
  console.log('S3Proxy initialized successfully');
} catch (error) {
  console.error('Failed to initialize S3Proxy:', error);
  process.exit(1);
}

// Error handler
function handleError(req: Request, res: Response, err: any): void {
  const statusCode = err.statusCode || 500;
  const errorXml = `<?xml version="1.0"?>
<error code="${err.code || 'InternalError'}" statusCode="${statusCode}" url="${req.url}">${err.message}</error>`;
  
  res.status(statusCode).type('application/xml').send(errorXml);
}

// Serve all files from S3
app.get('/*', async (req: Request, res: Response) => {
  try {
    const stream = await proxy.get(req as HttpRequest, res as HttpResponse);
    stream.on('error', (err) => {
      handleError(req, res, err);
    }).pipe(res);
  } catch (err) {
    handleError(req, res, err);
  }
});

app.listen(3000);
```

### Fastify Integration

```typescript
import Fastify from 'fastify';
import { S3Proxy } from 's3proxy';
import type { HttpRequest, HttpResponse } from 's3proxy';

const fastify = Fastify({ logger: true });
const proxy = new S3Proxy({
  bucket: 'my-website-bucket',
  region: 'us-west-2'
});

// Initialize S3Proxy
await proxy.init();

// Serve all files from S3
fastify.get('/*', async (request, reply) => {
  try {
    const stream = await proxy.get(
      request.raw as HttpRequest, 
      reply.raw as HttpResponse
    );
    
    stream.on('error', (err: any) => {
      const statusCode = err.statusCode || 500;
      reply.code(statusCode).type('application/xml').send(`<?xml version="1.0"?>
<error code="${err.code || 'InternalError'}" statusCode="${statusCode}">${err.message}</error>`);
    });
    
    // Let s3proxy handle the response
    return reply.hijack();
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    reply.code(statusCode).type('application/xml').send(`<?xml version="1.0"?>
<error code="${error.code || 'InternalError'}" statusCode="${statusCode}">${error.message}</error>`);
  }
});

// Start server
try {
  await fastify.listen({ port: 3000 });
  console.log('Server listening on http://localhost:3000');
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
```

### Framework Compatibility

s3proxy is **framework-agnostic** and works with any Node.js HTTP framework that provides access to the underlying request and response objects:

- **[Express](https://expressjs.com/)** - Fast, unopinionated web framework ✅
- **[Fastify](https://fastify.dev/)** - Fast and low overhead web framework ✅  
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

**Key requirement**: The framework must provide access to Node.js `IncomingMessage` and `ServerResponse` objects (usually available as `req.raw`/`res.raw` or similar).

### Range Requests (Partial Content)

s3proxy automatically handles HTTP Range requests for efficient streaming of large files:

```bash
# Download only bytes 0-99 of a large file
curl --range 0-99 http://localhost:3000/large-video.mp4 -o partial.mp4
```

### Health Checks

Built-in health check endpoint for load balancers:

```typescript
app.get('/health', async (req: Request, res: Response) => {
  try {
    const stream = await proxy.healthCheckStream(res as HttpResponse);
    stream.on('error', () => res.end()).pipe(res);
  } catch (error) {
    res.status(500).end();
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
Initialize S3 client and verify bucket access. Must be called before using other methods.

##### `await proxy.get(req: HttpRequest, res: HttpResponse): Promise<Readable>`
Stream S3 object to HTTP response. Handles range requests automatically.

##### `await proxy.head(req: HttpRequest, res: HttpResponse): Promise<Readable>`
Get object metadata (HEAD request). Returns empty stream with headers set.

##### `await proxy.healthCheck(): Promise<void>`
Verify bucket connectivity. Throws error if bucket is inaccessible.

##### `await proxy.healthCheckStream(res: HttpResponse): Promise<Readable>`
Health check with streaming response. Sets appropriate status code and headers.

#### Static Methods

##### `S3Proxy.version(): string`
Returns the current version of s3proxy.

##### `S3Proxy.parseRequest(req: HttpRequest): ParsedRequest`
Parse HTTP request to extract S3 key and query parameters.

### Types

```typescript
interface S3ProxyConfig extends S3ClientConfig {
  bucket: string;
}

interface HttpRequest extends IncomingMessage {
  path?: string;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[]>;
  url: string;
  method?: string;
}

interface HttpResponse extends ServerResponse {
  writeHead(statusCode: number, headers?: any): this;
}

interface ParsedRequest {
  key: string;
  query: Record<string, string | string[]>;
}
```

### Error Handling

s3proxy emits events for monitoring:

```typescript
proxy.on('error', (err: Error) => {
  console.error('S3Proxy error:', err);
});

proxy.on('init', () => {
  console.log('S3Proxy initialized successfully');
});
```

## Docker Deployment

For containerized deployments:

```bash
docker run --env BUCKET=mybucket --env PORT=8080 --publish 8080:8080 -t forkzero/s3proxy:3.0.0
```

For local development with temporary AWS credentials:

```bash
aws sts get-session-token --duration 900 > credentials.json
docker run \
  -v $PWD/credentials.json:/src/credentials.json:ro \
  -e BUCKET=mybucket \
  -e PORT=8080 \
  -e NODE_ENV=dev \
  -p 8080:8080 \
  -t forkzero/s3proxy:3.0.0
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

s3proxy maintains comprehensive test coverage across multiple dimensions to ensure reliability and performance:

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
├── index.ts          # Main S3Proxy class
├── UserException.ts  # Custom error class
├── types.ts          # Type definitions
└── version.ts        # Version information

examples/
├── express-basic.ts  # TypeScript Express example
├── fastify-basic.ts  # TypeScript Fastify example
├── fastify-docker.ts # Dockerized Fastify example
└── http.ts          # TypeScript HTTP example

test/
├── s3proxy.test.ts         # Main functionality tests
├── parse-request.test.ts   # Request parsing tests
├── mock-express.test.ts    # Express integration tests
├── types.test.ts           # Type definition tests
├── version.test.ts         # Version tests
├── imports-esm.test.ts     # ESM import tests
├── package-exports.test.ts # Package export tests
├── integration-tests.js    # Legacy integration tests
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
  - 80% coverage thresholds for all metrics
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
- **`shared-testing/configs/`** - Artillery load test configurations
  - `load-test.yml` - Main load testing config (used in Makefile)
  - `docker-container.yml` - Docker-specific load testing
  - `npm-package.yml` - NPM package load testing
  - `performance-comparison.yml` - Performance benchmarking
- **`shared-testing/scenarios/`** - Artillery test scenarios
  - `load-test.yml` - Basic load testing scenarios
  - `basic-load.yml` - Simple load patterns
  - `sustained-load.yml` - Extended load testing
  - `spike-load.yml` - Traffic spike simulation
  - `range-requests.yml` - HTTP range request testing

#### Development Tools
- **`.vscode/settings.json`** - VS Code workspace settings
  - Disables automatic Makefile configuration prompts
- **`.github/dependabot.yml`** - Automated dependency updates
- **`Makefile`** - Build automation and testing orchestration
  - Coordinates Docker and Artillery testing
  - Provides consistent commands across environments

#### AWS & Docker
- **`examples/aws-ecs/`** - ECS deployment configurations
  - CloudFormation templates for production deployment

All configuration files are actively maintained and serve specific purposes in the development, testing, and deployment pipeline.

## Use Cases

- **Static websites** - Serve React/Vue/Angular builds from S3
- **File downloads** - Stream large files without server storage
- **Media serving** - Video/audio streaming with range request support
- **API backends** - Serve user uploads or generated content
- **CDN alternative** - Cost-effective content delivery

## Performance

See [PERFORMANCE.md](PERFORMANCE.md) for detailed performance testing and benchmarks.

## Getting Help

- 📖 [Maintenance Guide](MAINTENANCE.md) - For contributors and advanced usage
- 🐛 [Report Issues](https://github.com/gmoon/s3proxy/issues)
- 💬 [Discussions](https://github.com/gmoon/s3proxy/discussions)

## Contributing

We welcome contributions! See our [Maintenance Guide](MAINTENANCE.md) for development setup and contribution guidelines.

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
