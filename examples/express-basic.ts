/*
  S3Proxy Express Framework Example

  Passes HTTP GET/HEAD requests to s3proxy via the v4 fetch() API.
  Start: PORT=3000 tsx examples/express-basic.ts
  Test:  npm run test:smoke

  Author: George Moon <george.moon@gmail.com>
*/

import { XmlNode, XmlText } from '@aws-sdk/xml-builder';
import bodyParser from 'body-parser';
import express, { type Request, type Response } from 'express';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest } from '../src/types.js';

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

interface ErrorWithDetails extends Error {
  time?: string;
  code?: string;
  statusCode?: number;
}

function handleError(req: Request, res: Response, err: ErrorWithDetails): void {
  console.error(`Request error: ${req.method} ${req.url}`, {
    error: err.message,
    statusCode: err.statusCode || 500,
    code: err.code || err.name,
  });

  const errorNode = new XmlNode('error')
    .addAttribute('time', err.time || new Date().toISOString())
    .addAttribute('code', err.code || err.name || 'InternalError')
    .addAttribute('statusCode', String(err.statusCode || 500))
    .addAttribute('url', req.url)
    .addAttribute('method', req.method || 'GET')
    .addChildNode(new XmlText(err.message));

  const errorXml = `<?xml version="1.0"?>\n${errorNode.toString()}`;

  if (res.headersSent) {
    res.end();
    return;
  }
  res
    .status(err.statusCode || 500)
    .type('application/xml')
    .send(errorXml);
}

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

// Health check: throws on failure → caught by handleError → 5xx.
app.route('/health').get(async (req: Request, res: Response) => {
  try {
    await proxy.healthCheck();
    res.status(200).type('text/plain').send('OK');
  } catch (error) {
    handleError(req, res, error as ErrorWithDetails);
  }
});

app.get('/', (_req: Request, res: Response) => {
  res.redirect('/index.html');
});

app
  .route('/*splat')
  .head(async (req: Request, res: Response) => {
    try {
      const { status, headers } = await proxy.fetch({
        ...(req as unknown as HttpRequest),
        method: 'HEAD',
      });
      res.writeHead(status, headers).end();
    } catch (error) {
      handleError(req, res, error as ErrorWithDetails);
    }
  })
  .get(async (req: Request, res: Response) => {
    try {
      const { stream, status, headers } = await proxy.fetch(req as unknown as HttpRequest);
      res.writeHead(status, headers);
      stream.on('error', (err: ErrorWithDetails) => handleError(req, res, err)).pipe(res);
    } catch (error) {
      handleError(req, res, error as ErrorWithDetails);
    }
  });

if (port > 0) {
  app.listen(port, () => {
    console.log(`S3Proxy server started on port: ${port}`);
  });
}

export default app;
