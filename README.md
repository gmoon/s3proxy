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

## Quick Start

Install and run in 3 lines:

```bash
npm install s3proxy express
PORT=3000 BUCKET=your-bucket-name node -e "
const express = require('express');
const S3Proxy = require('s3proxy');
const app = express();
const proxy = new S3Proxy({bucket: process.env.BUCKET});
proxy.init();
app.get('/*', async (req, res) => {
  (await proxy.get(req, res)).on('error', err => res.status(err.statusCode || 500).end()).pipe(res);
});
app.listen(process.env.PORT, () => console.log(\`Server running on port \${process.env.PORT}\`));
"
```

Now `curl http://localhost:3000/index.html` serves `s3://your-bucket-name/index.html`

## Usage Examples

### Express Integration

```javascript
const express = require('express');
const S3Proxy = require('s3proxy');

const app = express();
const proxy = new S3Proxy({ bucket: 'my-website-bucket' });

// Initialize the proxy
await proxy.init();

// Serve all files from S3
app.get('/*', async (req, res) => {
  try {
    const stream = await proxy.get(req, res);
    stream.on('error', (err) => {
      res.status(err.statusCode || 500).end();
    }).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch file' });
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

```javascript
app.get('/health', async (req, res) => {
  const stream = await proxy.healthCheckStream(res);
  stream.on('error', () => res.end()).pipe(res);
});
```

## Docker Deployment

For containerized deployments:

```bash
docker run --env BUCKET=mybucket --env PORT=8080 --publish 8080:8080 -t forkzero/s3proxy:2.0.2
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
  -t forkzero/s3proxy:2.0.2
```

## Configuration

### Constructor Options

```javascript
const proxy = new S3Proxy({
  bucket: 'my-bucket',        // Required: S3 bucket name
  region: 'us-west-2',        // Optional: AWS region
  accessKeyId: 'AKIA...',     // Optional: AWS credentials
  secretAccessKey: '...',     // Optional: AWS credentials  
  endpoint: 'https://...',    // Optional: Custom S3 endpoint
});
```

### Environment Variables

- `BUCKET` - S3 bucket name
- `PORT` - Server port (default: 3000)
- `AWS_REGION` - AWS region
- `NODE_ENV` - Environment (enables credential file in dev mode)

## API Reference

### Methods

- `await proxy.init()` - Initialize S3 client and verify bucket access
- `await proxy.get(req, res)` - Stream S3 object to HTTP response
- `await proxy.head(req, res)` - Get object metadata (HEAD request)
- `await proxy.healthCheck()` - Verify bucket connectivity
- `await proxy.healthCheckStream(res)` - Health check with streaming response

### Error Handling

s3proxy emits events for monitoring:

```javascript
proxy.on('error', (err) => {
  console.error('S3Proxy error:', err);
});

proxy.on('init', () => {
  console.log('S3Proxy initialized successfully');
});
```

## Use Cases

- **Static websites** - Serve React/Vue/Angular builds from S3
- **File downloads** - Stream large files without server storage
- **Media serving** - Video/audio streaming with range request support
- **API backends** - Serve user uploads or generated content
- **CDN alternative** - Cost-effective content delivery

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
