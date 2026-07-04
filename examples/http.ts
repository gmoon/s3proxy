import { createServer } from 'node:http';
import { pipeline } from 'node:stream';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest } from '../src/types.js';

const port = Number(process.env.PORT) || 0;
const bucketName = process.env.BUCKET || 's3proxy-public';
const proxy = new S3Proxy({ bucket: bucketName });

try {
  await proxy.init();
  console.log(`S3Proxy initialized for bucket: ${bucketName}`);
} catch (error) {
  console.error('Failed to initialize S3Proxy:', error);
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    const { stream, status, headers } = await proxy.fetch(req as unknown as HttpRequest);
    res.writeHead(status, headers);
    // pipeline (not .pipe) destroys the S3 source stream if the client
    // disconnects mid-transfer, so the underlying S3 socket isn't leaked.
    pipeline(stream, res, (err) => {
      if (err && !res.writableEnded) res.end();
    });
  } catch (error) {
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;
    if (!res.headersSent) {
      res.statusCode = statusCode;
    }
    res.end();
  }
});

if (port > 0) {
  server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });
}

export default server;
