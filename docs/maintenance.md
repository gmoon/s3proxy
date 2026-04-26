# s3proxy Maintenance Guide

This document contains information for maintainers and contributors working on the s3proxy project.

## Breaking Changes in v2.0

> **Note**: s3proxy v2.0+ uses async/await exclusively. Update your code:

```diff
  app.get('/*', 
-   (req, res) => {
-     proxy.get(req, res)
+   async (req, res) => {
+     (await proxy.get(req, res))
        .on('error', (err) => {
          // handle error
        }).pipe(res);
    });
```

## Development Setup

### Prerequisites
- Node.js 16+
- AWS CLI configured
- Docker (for container testing)

### Installation
```bash
git clone https://github.com/gmoon/s3proxy.git
cd s3proxy
npm install
```

### Testing

#### Unit Tests
```bash
npm run nyc-coverage  # Run tests with coverage
npm run mocha         # Run tests without coverage
```

#### Load Testing
```bash
npm run artillery-local-3000  # Test against local server on port 3000
npm run artillery-local-8080  # Test against local server on port 8080
npm run artillery-ecs         # Test against ECS deployment
```

#### Docker Testing
```bash
npm run dockerize-for-test    # Build test image
npm run artillery-docker      # Test Docker container
```

### Code Quality

#### Linting
```bash
npm run eslint        # Check code style
npm run eslint-fix    # Fix auto-fixable issues
```

#### Coverage Reports
Coverage reports are generated in the `coverage/` directory after running `npm run nyc-coverage`.

## Release Process

### Version Management
```bash
npm run ncu-upgrade   # Update dependencies
npm version patch     # Bump version (patch/minor/major)
```

### Docker Builds

#### Test Builds
```bash
npm run dockerize-for-test
```

#### Production Builds
```bash
# Docker Hub
npm run docker-login-dockerhub
npm run dockerize-for-prod-dockerhub

# AWS ECR
npm run docker-login-aws
npm run dockerize-for-prod-aws
```

### Security

#### Software Bill of Materials
```bash
npm run software-bill-of-materials
```

#### Credential Management
For local development, temporary credentials can be generated:
```bash
npm run credentials  # Generates credentials.json for 15 minutes
```

> **Security Note**: Credential file loading is disabled when `NODE_ENV` is undefined or matches `/^prod/i` (e.g., `prod` or `production`).

## CI/CD Pipeline

### GitHub Actions
The project uses GitHub Actions for:
- Automated testing on multiple Node.js versions
- Docker image building and publishing
- Security scanning
- Dependency updates

### Build Scripts
- `npm run package` - Create npm package
- `npm run cleanup` - Remove build artifacts

## Deployment Examples

### AWS ECS
See [examples/aws-ecs/](examples/aws-ecs/) for complete ECS deployment configuration.

### AWS Lambda with SAM
See [examples/sam-app/](examples/sam-app/) for serverless deployment.

### Docker Compose
See [examples/docker/](examples/docker/) for container orchestration examples.

## Monitoring and Debugging

### Health Checks
The `/health` endpoint is designed for load balancer integration and returns:
- 200 OK when S3 bucket is accessible
- 4xx/5xx when there are connectivity or permission issues

### Error Handling
s3proxy distinguishes between:
- **Non-fatal errors**: NoSuchKey, NoSuchBucket, AccessDenied (return empty stream)
- **Fatal errors**: Network issues, invalid configuration (throw exception)

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
s3proxy streams data directly without buffering, keeping memory usage constant regardless of file size.

### Concurrent Connections
Each request creates a direct stream from S3. Monitor S3 request rates and consider implementing connection pooling for high-traffic scenarios.

### Range Requests
Range requests are passed directly to S3, enabling efficient partial content delivery without server-side processing.

## Contributing

### Code Style
- Follow existing ESLint configuration
- Use async/await for asynchronous operations
- Include comprehensive error handling
- Add tests for new functionality

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Update documentation as needed
6. Submit pull request with clear description

### Issue Reporting
When reporting issues, include:
- Node.js version
- s3proxy version
- Minimal reproduction case
- Error messages and stack traces
- AWS region and S3 configuration (without credentials)

## License

Apache 2.0 - see [LICENSE](LICENSE) file.
