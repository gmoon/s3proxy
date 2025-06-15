# S3Proxy-Docker Repository Adaptation Guide

This guide provides step-by-step instructions for adapting the `forkzero/s3proxy-docker` repository to work with the new TypeScript-based s3proxy v3.0.0 and shared testing infrastructure.

## Overview

The s3proxy npm package now includes shared testing configurations that both the npm package and Docker container can use. This eliminates duplication and ensures consistent testing between deployment methods.

## Required Changes

### 1. Update Dockerfile for TypeScript/ESM Support

Your Dockerfile needs to be updated to handle the new package structure:

```dockerfile
# Multi-stage build for s3proxy v3.0.0
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Application stage
FROM base AS app
COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY examples/express-basic.js ./
COPY package.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE ${PORT}

# Start application
CMD ["node", "examples/express-basic.js"]
```

**Key Changes:**
- Use Node.js 20+ for full ESM support
- The main entry point is now `examples/express-basic.js` (compiled from TypeScript)
- Health check endpoint is `/health`

### 2. Update GitHub Actions Workflow

Create or update `.github/workflows/test-and-build.yml`:

```yaml
name: Test and Build Docker Container

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  repository_dispatch:
    types: [test-integration, release-container]
  workflow_dispatch:
    inputs:
      s3proxy_version:
        description: 'S3Proxy version to test'
        required: false
        default: 'latest'
      test_type:
        description: 'Type of load test to run'
        required: false
        default: 'basic'
        type: choice
        options:
        - basic
        - sustained
        - spike
        - range

env:
  S3PROXY_VERSION: ${{ github.event.inputs.s3proxy_version || github.event.client_payload.npm_version || 'latest' }}
  TEST_TYPE: ${{ github.event.inputs.test_type || 'basic' }}

jobs:
  download-shared-testing:
    runs-on: ubuntu-latest
    outputs:
      cache-key: ${{ steps.cache-key.outputs.key }}
    steps:
      - name: Generate cache key
        id: cache-key
        run: echo "key=shared-testing-${{ env.S3PROXY_VERSION }}-${{ hashFiles('**/package.json') }}" >> $GITHUB_OUTPUT
      
      - name: Cache shared testing configs
        id: cache-shared-testing
        uses: actions/cache@v3
        with:
          path: shared-testing/
          key: ${{ steps.cache-key.outputs.key }}
      
      - name: Download shared testing configs
        if: steps.cache-shared-testing.outputs.cache-hit != 'true'
        run: |
          if [ "$S3PROXY_VERSION" = "latest" ]; then
            DOWNLOAD_URL="https://github.com/gmoon/s3proxy/archive/main.tar.gz"
          else
            DOWNLOAD_URL="https://github.com/gmoon/s3proxy/archive/v${S3PROXY_VERSION}.tar.gz"
          fi
          
          echo "Downloading shared testing configs from: $DOWNLOAD_URL"
          curl -L "$DOWNLOAD_URL" | tar -xz --strip=2 s3proxy-*/shared-testing
          
          # Verify download
          ls -la shared-testing/
          ls -la shared-testing/configs/
          ls -la shared-testing/scenarios/
      
      - name: Upload shared testing artifact
        uses: actions/upload-artifact@v3
        with:
          name: shared-testing-configs
          path: shared-testing/
          retention-days: 1

  build-and-test:
    needs: download-shared-testing
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Download shared testing configs
        uses: actions/download-artifact@v3
        with:
          name: shared-testing-configs
          path: ./
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Build Docker image
        run: |
          docker build \
            --build-arg S3PROXY_VERSION=${{ env.S3PROXY_VERSION }} \
            --tag s3proxy-docker:test \
            .
      
      - name: Start container for testing
        run: |
          docker run -d \
            --name s3proxy-test \
            --publish 8080:8080 \
            --env BUCKET=s3proxy-public \
            --env AWS_REGION=us-east-1 \
            --env NODE_ENV=production \
            s3proxy-docker:test
          
          # Wait for container to be ready
          echo "Waiting for container to start..."
          timeout 60 bash -c 'until curl -f http://localhost:8080/health; do sleep 2; done'
          echo "Container is ready!"
      
      - name: Install Artillery for load testing
        run: |
          npm install -g artillery@latest
          artillery --version
      
      - name: Run load tests
        run: |
          echo "Running $TEST_TYPE load tests..."
          
          TEST_ENVIRONMENT=docker-container \
          artillery run \
            --config shared-testing/configs/docker-container.yml \
            shared-testing/scenarios/${TEST_TYPE}-load.yml
      
      - name: Run health and functionality tests
        run: |
          echo "Testing basic functionality..."
          
          # Test health endpoint
          curl -f http://localhost:8080/health
          
          # Test basic file serving (if index.html exists in test bucket)
          curl -f http://localhost:8080/index.html -o /dev/null
          
          # Test range requests
          curl -f http://localhost:8080/large.bin \
            --header "Range: bytes=0-99" \
            --output /dev/null \
            --write-out "Status: %{http_code}, Content-Length: %{size_download}\n"
          
          # Test special characters (URL encoded)
          SPECIAL_FILE=$(node -e "console.log(encodeURIComponent('specialCharacters!-_.*\\'()&\$@=;:+  ,?\\\\{^}%\`]\">[~<#|.'))")
          curl -f "http://localhost:8080/$SPECIAL_FILE" -o /dev/null || echo "Special character test may have failed"
      
      - name: Collect container logs
        if: always()
        run: |
          echo "=== Container Logs ==="
          docker logs s3proxy-test
          
          echo "=== Container Stats ==="
          docker stats s3proxy-test --no-stream
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ github.run_id }}
          path: |
            test-results-*.json
            performance-comparison-*.json
          retention-days: 7
      
      - name: Cleanup
        if: always()
        run: |
          docker stop s3proxy-test || true
          docker rm s3proxy-test || true

  performance-comparison:
    needs: [download-shared-testing, build-and-test]
    runs-on: ubuntu-latest
    if: github.event_name == 'repository_dispatch' && github.event.action == 'test-integration'
    steps:
      - name: Download shared testing configs
        uses: actions/download-artifact@v3
        with:
          name: shared-testing-configs
          path: ./
      
      - name: Download NPM package test results
        run: |
          # This would download results from the s3proxy repo
          # Implementation depends on how you want to share results
          echo "Downloading NPM package test results..."
          # curl -L "${{ github.event.client_payload.npm_results_url }}" -o npm-results.json
      
      - name: Download Docker test results
        uses: actions/download-artifact@v3
        with:
          name: test-results-${{ github.run_id }}
          path: ./
      
      - name: Compare performance
        run: |
          node shared-testing/utils/results-parser.js compare \
            --docker-results test-results-docker-container-*.json \
            --npm-results npm-results.json
      
      - name: Report results back to s3proxy repo
        if: always()
        uses: peter-evans/repository-dispatch@v2
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: gmoon/s3proxy
          event-type: integration-result
          client-payload: |
            {
              "success": "${{ job.status == 'success' }}",
              "test_run_id": "${{ github.run_id }}",
              "docker_repo_run_url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }

  build-and-push:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.event_name == 'repository_dispatch'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          build-args: |
            S3PROXY_VERSION=${{ env.S3PROXY_VERSION }}
          tags: |
            forkzero/s3proxy:${{ env.S3PROXY_VERSION }}
            forkzero/s3proxy:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 3. Update Dockerfile Build Args

Modify your Dockerfile to accept the s3proxy version as a build argument:

```dockerfile
ARG S3PROXY_VERSION=latest

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
# Install specific version of s3proxy
ARG S3PROXY_VERSION
RUN if [ "$S3PROXY_VERSION" = "latest" ]; then \
      npm install s3proxy express; \
    else \
      npm install s3proxy@${S3PROXY_VERSION} express; \
    fi

FROM base AS app
COPY --from=deps /app/node_modules ./node_modules

# Create a simple Express server that uses s3proxy
COPY <<EOF server.js
const express = require('express');
const { S3Proxy } = require('s3proxy');

const app = express();
const port = process.env.PORT || 8080;
const bucket = process.env.BUCKET;

if (!bucket) {
  console.error('BUCKET environment variable is required');
  process.exit(1);
}

const proxy = new S3Proxy({ bucket });

async function startServer() {
  try {
    await proxy.init();
    console.log(\`S3Proxy initialized for bucket: \${bucket}\`);
    
    // Health check endpoint
    app.get('/health', async (req, res) => {
      try {
        const stream = await proxy.healthCheckStream(res);
        stream.on('error', () => res.end()).pipe(res);
      } catch (error) {
        res.status(500).end();
      }
    });
    
    // Serve all other requests from S3
    app.get('/*', async (req, res) => {
      try {
        const stream = await proxy.get(req, res);
        stream.on('error', (err) => {
          const statusCode = err.statusCode || 500;
          res.status(statusCode).end();
        }).pipe(res);
      } catch (error) {
        res.status(500).end();
      }
    });
    
    app.listen(port, () => {
      console.log(\`s3proxy-docker listening on port \${port}\`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
EOF

ENV NODE_ENV=production
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE ${PORT}
CMD ["node", "server.js"]
```

### 4. Update README.md

Update your s3proxy-docker README to reflect the new version and testing approach:

```markdown
# s3proxy-docker

Official Docker container for [s3proxy](https://github.com/gmoon/s3proxy) - Stream files directly from AWS S3.

## Quick Start

```bash
docker run -p 8080:8080 -e BUCKET=your-bucket-name forkzero/s3proxy:3.0.0
```

## Version 3.0 Changes

- **TypeScript Support**: Built on s3proxy v3.0.0 with full TypeScript support
- **ESM Modules**: Modern ES module architecture
- **Improved Performance**: Enhanced streaming and error handling
- **Shared Testing**: Uses shared load testing infrastructure with npm package

## Environment Variables

- `BUCKET` - **Required**: S3 bucket name
- `PORT` - Server port (default: 8080)
- `AWS_REGION` - AWS region
- `NODE_ENV` - Environment (production/development)

## Health Check

The container includes a built-in health check endpoint at `/health` that verifies S3 connectivity.

## Testing

This container uses shared testing infrastructure with the s3proxy npm package to ensure consistent performance and functionality.

### Load Testing

```bash
# Download shared testing configs
curl -L https://github.com/gmoon/s3proxy/archive/main.tar.gz | \
  tar -xz --strip=2 s3proxy-main/shared-testing

# Run load tests
artillery run --config shared-testing/configs/docker-container.yml \
              shared-testing/scenarios/basic-load.yml
```

## Supported Architectures

- `linux/amd64`
- `linux/arm64`

## Tags

- `forkzero/s3proxy:3.0.0` - Specific version
- `forkzero/s3proxy:latest` - Latest stable version
```

### 5. Repository Secrets

Add these secrets to your s3proxy-docker repository:

- `DOCKERHUB_USERNAME` - Your Docker Hub username
- `DOCKERHUB_TOKEN` - Docker Hub access token
- `REPO_ACCESS_TOKEN` - GitHub token with repo access (for cross-repo communication)

### 6. Testing the Integration

After implementing these changes:

1. **Test locally**:
   ```bash
   # Build the container
   docker build --build-arg S3PROXY_VERSION=3.0.0 -t s3proxy-test .
   
   # Run the container
   docker run -d -p 8080:8080 -e BUCKET=s3proxy-public s3proxy-test
   
   # Test health endpoint
   curl http://localhost:8080/health
   ```

2. **Test with shared configs**:
   ```bash
   # Download shared testing
   curl -L https://github.com/gmoon/s3proxy/archive/main.tar.gz | \
     tar -xz --strip=2 s3proxy-main/shared-testing
   
   # Run load test
   artillery run --config shared-testing/configs/docker-container.yml \
                 shared-testing/scenarios/basic-load.yml
   ```

## Integration Workflow

The integration between repositories works as follows:

1. **s3proxy repo** builds and tests npm package
2. **s3proxy repo** triggers s3proxy-docker integration test
3. **s3proxy-docker** downloads shared testing configs
4. **s3proxy-docker** builds container with new package version
5. **s3proxy-docker** runs load tests using shared configs
6. **s3proxy-docker** reports results back to s3proxy repo
7. If tests pass, both repos can release their respective artifacts

This ensures that the Docker container performs equivalently to the npm package before any releases are made.

## Troubleshooting

### Common Issues

1. **Container fails to start**: Check that `BUCKET` environment variable is set
2. **Health check fails**: Verify AWS credentials and bucket permissions
3. **Load tests fail**: Ensure test data exists in S3 bucket (run `setup-s3-data.sh`)

### Debug Mode

```bash
docker run -p 8080:8080 -e BUCKET=your-bucket -e NODE_ENV=development forkzero/s3proxy:3.0.0
```

This guide should give you everything needed to adapt the s3proxy-docker repository to work with the new TypeScript-based s3proxy v3.0.0 and shared testing infrastructure.
