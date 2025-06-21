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

**s3proxy v3.0.0+ is ESM-only and requires Node.js 20.8.1+**

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
import type { ExpressRequest, ExpressResponse } from 's3proxy';

const app = express();
const proxy = new S3Proxy({ bucket: 'your-bucket-name' });

await proxy.init();

app.get('/*', async (req, res) => {
  try {
    const stream = await proxy.get(req as ExpressRequest, res as ExpressResponse);
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
import type { ExpressRequest, ExpressResponse } from 's3proxy';

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
    const stream = await proxy.get(req as ExpressRequest, res as ExpressResponse);
    stream.on('error', (err) => {
      handleError(req, res, err);
    }).pipe(res);
  } catch (err) {
    handleError(req, res, err);
  }
});

app.listen(3000);
```

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
    const stream = await proxy.healthCheckStream(res as ExpressResponse);
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

##### `await proxy.get(req: ExpressRequest, res: ExpressResponse): Promise<Readable>`
Stream S3 object to HTTP response. Handles range requests automatically.

##### `await proxy.head(req: ExpressRequest, res: ExpressResponse): Promise<Readable>`
Get object metadata (HEAD request). Returns empty stream with headers set.

##### `await proxy.healthCheck(): Promise<void>`
Verify bucket connectivity. Throws error if bucket is inaccessible.

##### `await proxy.healthCheckStream(res: ExpressResponse): Promise<Readable>`
Health check with streaming response. Sets appropriate status code and headers.

#### Static Methods

##### `S3Proxy.version(): string`
Returns the current version of s3proxy.

##### `S3Proxy.parseRequest(req: ExpressRequest): ParsedRequest`
Parse HTTP request to extract S3 key and query parameters.

### Types

```typescript
interface S3ProxyConfig extends S3ClientConfig {
  bucket: string;
}

interface ExpressRequest extends IncomingMessage {
  path?: string;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[]>;
  url: string;
  method?: string;
}

interface ExpressResponse extends ServerResponse {
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
| AWS Lambda (SAM) | `make sam-app` | ✅ Node CI | Serverless deployment |
| Multi-Node | Node 20, 22 | ✅ Node CI | Cross-version compatibility |

#### Test Commands

```bash
# Run all tests locally
make all                    # Complete test suite
make test                   # Core tests (build, lint, unit)
make functional-tests       # Integration and Docker tests

# Individual test categories  
make test-validation-docker # 24 comprehensive validation tests
make artillery-docker       # Performance/load testing
make sam-app               # AWS Lambda testing

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
└── types.ts          # Type definitions

examples/
├── express-basic.ts  # TypeScript Express example
└── http.ts          # TypeScript HTTP example

test/
├── s3proxy.test.ts      # Main functionality tests
├── parseRequest.test.ts # Request parsing tests
└── MockExpress.test.ts  # Express integration tests
```

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
