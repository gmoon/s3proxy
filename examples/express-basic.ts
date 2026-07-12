/*
  S3Proxy Express Framework Example

  Serves HTTP GET/HEAD requests from S3 using the v4.1 `proxy.middleware()`
  convenience adapter — a drop-in handler built on the pure fetch() API that
  writes status + headers + body for you and renders honest 404/403/416
  responses (no v3-style empty-200). For a custom error body (XML/HTML) or a
  non-Express framework, use fetch() directly — see fastify-basic.ts.

  Start: PORT=3000 tsx examples/express-basic.ts
  Test:  npm run test:smoke

  Author: George Moon <george.moon@gmail.com>
*/

import bodyParser from 'body-parser';
import express, { type Request, type Response } from 'express';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest, HttpResponse } from '../src/types.js';

const port = Number(process.env.PORT) || 0;
const app = express();

app.set('view engine', 'pug');
app.use(bodyParser.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

const bucketName = process.env.BUCKET || 's3proxy-public';
const proxy = new S3Proxy({ bucket: bucketName });

try {
  await proxy.init();
  console.log(`S3Proxy initialized for bucket: ${bucketName}`);
} catch (error) {
  console.error(`Failed to initialize S3Proxy for bucket: ${bucketName}`, error);
  process.exit(1);
}

proxy.on('error', (err: Error) => {
  console.error(`S3Proxy error for bucket: ${bucketName}`, err);
});

// Health check: healthCheck() throws on bucket unreachability.
app.route('/health').get(async (_req: Request, res: Response) => {
  try {
    await proxy.healthCheck();
    res.status(200).type('text/plain').send('OK');
  } catch (error) {
    res.status(503).type('text/plain').send(String(error));
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.redirect('/index.html');
});

// One line serves every key. middleware() dispatches GET vs HEAD by
// req.method and renders the correct status for missing/forbidden keys.
const s3 = proxy.middleware();
app.all('/*splat', (req: Request, res: Response) =>
  s3(req as unknown as HttpRequest, res as unknown as HttpResponse)
);

if (port > 0) {
  app.listen(port, () => {
    console.log(`S3Proxy server started on port: ${port}`);
  });
}

export default app;
