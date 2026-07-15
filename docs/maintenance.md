# s3proxy Maintenance Guide

This document contains information for maintainers and contributors
working on the s3proxy project.

## Migrating between major versions

s3proxy follows semantic versioning. For the v3 to v4 upgrade (the pure
`fetch()` contract, typed errors, and the convenience adapters), see
[MIGRATION.md](../MIGRATION.md).

## Development Setup

### Prerequisites

- Node.js 22.13.0 or higher
- AWS CLI configured
- Docker (for container and validation testing)

### Installation

```bash
git clone https://github.com/gmoon/s3proxy.git
cd s3proxy
npm install
```

### Testing

#### Unit Tests

```bash
npm test               # Unit tests (vitest)
npm run test:coverage  # Unit tests with coverage
npm run test:watch     # Watch mode
```

#### Smoke and Validation Tests

```bash
npm run test:smoke       # Boot each example and check health/200/404
npm run test:validation  # End-to-end validation against a live server
```

The smoke and validation tests need AWS credentials with read access to
the test bucket (default `s3proxy-public`).

#### Load Testing

```bash
make conformance-local       # HTTP-contract gate (status/type/length) — CI gate
make validation-local        # 24 end-to-end validation tests
make artillery-local         # Load test: kit vs a tsx server on local src/
make test-performance        # Resource usage under load
```

Each of these boots an example server with `tsx` against your local `src/`
(no build, no Docker image) via `scripts/with-local-server.sh`, runs the kit or
the validation suite against it, and cleans up. Change `src/`, re-run. Override
the framework with `EXAMPLE=examples/express-basic.ts` (conformance/validation
default to `fastify-basic.ts`, whose XML error bodies match the published
image's error contract).

`make conformance-local` is a hard gate (also run in CI): it asserts status
codes, content-types, and content-lengths with the kit's `expect`-enabled config
— the portable `scenarios/core/conformance.yml` plus the s3proxy-specific
`scenarios/s3proxy/error-contract.yml` (404/403 → `application/xml`). The load
target measures throughput only and asserts nothing, so a header/status
regression that still returns 200 slips past it but fails this gate.

Load-test configurations and scenarios come from the
[`@forkzero/s3-website-test-kit`](https://www.npmjs.com/package/@forkzero/s3-website-test-kit)
devDependency (installed under `node_modules/@forkzero/s3-website-test-kit`),
shared with `forkzero/s3proxy-docker`.

The deployable container image is not built here — it lives in
[`forkzero/s3proxy-docker`](https://github.com/forkzero/s3proxy-docker), which
builds and conformance-tests the published `forkzero/s3proxy` image in its own
CI. This repo tests the library directly against `src/`.

### Code Quality

#### Linting and Formatting

s3proxy uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
npm run lint        # Check style and lint rules
npm run lint:fix    # Apply auto-fixable fixes
npm run format      # Format the code
npm run type-check  # TypeScript type checking (src and examples)
```

#### Coverage Reports

Coverage reports are written to the `coverage/` directory after running
`npm run test:coverage`. Thresholds are enforced in `vitest.config.ts`
(branches 85%, functions 95%, lines and statements 90%).

## Release Process

Releases are driven by
[semantic-release](https://semantic-release.gitbook.io/) from Conventional
Commit messages.

```bash
npm run release:dry-run  # Preview the next release without publishing
npm run release:local    # Run a release locally
npm run ncu-upgrade      # Update dependencies (npm-check-updates)
```

### Docker Images

Container images are published as
[`forkzero/s3proxy`](https://hub.docker.com/r/forkzero/s3proxy) on Docker Hub,
built from [`forkzero/s3proxy-docker`](https://github.com/forkzero/s3proxy-docker)
(the container server, Dockerfile, and publish pipeline all live there).

### Credentials for Local Testing

Container and load tests can run against S3 with short-lived credentials.
`make credentials` writes a session token to `credentials.json`, or
generate one directly:

```bash
aws sts get-session-token --duration 900 > ~/.s3proxy/credentials.json
```

> **Security note**: the credential file is loaded only in development
> (`NODE_ENV=dev`), never when `NODE_ENV` is unset or looks like
> production.

## CI/CD Pipeline

### GitHub Actions

- **`.github/workflows/nodejs.yml`**: core tests (lint, type-check,
  build, unit tests), examples smoke test, validation tests, the
  conformance gate and load tests, and package verification. Unit tests
  run on Node 22 and 23.
- **`.github/workflows/release.yml`**: runs on a published GitHub release.

### Build Scripts

- `npm run build` - Compile TypeScript to `dist/`
- `npm run clean` - Remove build artifacts and test results

## Deployment Examples

### AWS ECS (Fargate)

See the [parameterized Fargate reference stack](https://github.com/forkzero/s3proxy-docker/tree/main/deploy/aws-ecs)
in `forkzero/s3proxy-docker` for a CloudFormation-based ECS deployment.

### Containers

See [`forkzero/s3proxy-docker`](https://github.com/forkzero/s3proxy-docker) for
the container image, and its
[`deploy/aws-ecs/`](https://github.com/forkzero/s3proxy-docker/tree/main/deploy/aws-ecs)
for a Fargate deployment.

## Monitoring and Debugging

### Health Checks

`proxy.healthCheck()` verifies bucket connectivity. Wire it into a
`/health` endpoint for load balancer integration:

- 200 when the S3 bucket is reachable
- 4xx/5xx when there are connectivity or permission issues

### Error Handling

Since v4, s3proxy throws typed errors instead of returning empty streams:

- **Classified failures**: `S3NotFound` (404), `S3Forbidden` (403),
  `S3InvalidRange` (416), and `InvalidRequest` (400). All extend
  `S3ProxyError` and carry a `statusCode` and the underlying SDK error as
  `cause`.
- **Everything else**: network failures, invalid configuration, and
  programming errors propagate unchanged.

### Event Monitoring

```javascript
proxy.on('error', (err) => {
  console.error('S3Proxy initialization error:', err);
});

proxy.on('init', () => {
  console.log('S3Proxy initialized successfully');
});
```

## Performance Considerations

### Memory Usage

s3proxy streams data directly without buffering, keeping memory usage
constant regardless of file size.

### Concurrent Connections

Each request creates a direct stream from S3. Monitor S3 request rates and
consider connection pooling for high-traffic scenarios.

### Range Requests

Range requests are passed directly to S3, enabling efficient partial
content delivery without server-side processing.

## Contributing

### Code Style

- Follow the existing Biome configuration (`biome.json`)
- Use async/await for asynchronous operations
- Include error handling
- Add tests for new functionality

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Update documentation as needed
6. Submit a pull request with a clear description

### Issue Reporting

When reporting issues, include:

- Node.js version
- s3proxy version
- Minimal reproduction case
- Error messages and stack traces
- AWS region and S3 configuration (without credentials)

## License

Apache 2.0 - see [LICENSE](LICENSE) file.
