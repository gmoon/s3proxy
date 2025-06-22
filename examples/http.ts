import { createServer } from 'node:http';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest, HttpResponse } from '../src/types.js';

const port = Number(process.env.PORT) || 0;
const bucketName = process.env.BUCKET || 's3proxy-public';
const proxy = new S3Proxy({ bucket: bucketName });

// Initialize proxy with proper error handling
try {
  await proxy.init();
  console.log(`S3Proxy initialized for bucket: ${bucketName}`);
} catch (error) {
  console.error('Failed to initialize S3Proxy:', error);
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    const stream = await proxy.get(req as HttpRequest, res as HttpResponse);
    stream
      .on('error', () => {
        // just end the request and let the HTTP status code convey the error
        res.end();
      })
      .pipe(res);
  } catch (error) {
    console.error('Error handling request:', error);
    res.statusCode = 500;
    res.end();
  }
});

if (port > 0) {
  server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });
}

export default server;
