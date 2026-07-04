/*
  S3Proxy Static Website Example

  Replicates S3 static website hosting (index document + custom error
  document) using `proxy.staticSite()` — an opt-in layer on top of the pure
  fetch() primitive. `/` and `/dir/` resolve to index.html; a missing or
  forbidden key serves the error document with the correct 4xx status.

  Start: PORT=3000 tsx examples/static-site.ts
  Test:  npm run test:smoke

  Author: George Moon <george.moon@gmail.com>
*/

import express, { type Request, type Response } from 'express';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest, HttpResponse } from '../src/types.js';

const port = Number(process.env.PORT) || 0;
const app = express();

const bucketName = process.env.BUCKET || 's3proxy-public';
const proxy = new S3Proxy({ bucket: bucketName });

try {
  await proxy.init();
  console.log(`S3Proxy initialized for bucket: ${bucketName}`);
} catch (error) {
  console.error(`Failed to initialize S3Proxy for bucket: ${bucketName}`, error);
  process.exit(1);
}

app.route('/health').get(async (_req: Request, res: Response) => {
  try {
    await proxy.healthCheck();
    res.status(200).type('text/plain').send('OK');
  } catch (error) {
    res.status(503).type('text/plain').send(String(error));
  }
});

// One handler for the whole site: index-document resolution + custom error
// document, exactly like S3 website hosting — but the bucket stays private.
// Mounted with app.use so it also matches the root path `/` (which the
// Express 5 `/*splat` wildcard does not) — root then resolves to index.html.
const site = proxy.staticSite({ indexDocument: 'index.html', errorDocument: 'error.html' });
app.use((req: Request, res: Response) =>
  site(req as unknown as HttpRequest, res as unknown as HttpResponse)
);

if (port > 0) {
  app.listen(port, () => {
    console.log(`S3Proxy static-site server started on port: ${port}`);
  });
}

export default app;
