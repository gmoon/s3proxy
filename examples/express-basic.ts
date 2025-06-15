/*
  S3Proxy Express Framework Example

  Passes HTTP GET requests to s3proxy
  Start: PORT=3000 tsx examples/express-basic.ts
  Test: npm run test

  Author: George Moon <george.moon@gmail.com>
*/

import bodyParser from 'body-parser';
import debug from 'debug';
import express, { type Request, type Response } from 'express';
import addRequestId from 'express-request-id';
import morgan from 'morgan';
import { S3Proxy } from '../src/index.js';
import type { ExpressRequest, ExpressResponse } from '../src/types.js';

const debugLog = debug('s3proxy');
const port = Number(process.env.PORT) || 0;
const app = express();

app.set('view engine', 'pug');
app.use(addRequestId({ headerName: 'x-request-id' }));
app.use(bodyParser.json());

interface ErrorWithDetails extends Error {
  time?: string;
  code?: string;
  statusCode?: number;
}

function handleError(req: Request, res: Response, err: ErrorWithDetails): void {
  // sending xml because the AWS SDK sets content-type: application/xml for non-200 responses
  const errorXml = `<?xml version="1.0"?>
<error time="${err.time || new Date().toISOString()}" code="${err.code || 'InternalError'}" statusCode="${err.statusCode || 500}" url="${req.url}" method="${req.method}">${err.message}</error>`;

  res
    .status(err.statusCode || 500)
    .type('application/xml')
    .send(errorXml);
}

// Use morgan for request logging except during test execution
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan(
      'request :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ' +
        '":referrer" ":user-agent" ":response-time ms" :res[x-request-id] :res[x-amz-request-id]'
    )
  );
}

// initialize the s3proxy
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

proxy.on('error', (err: Error) => {
  console.log(`error initializing s3proxy for bucket ${bucketName}: ${err.name} ${err.message}`);
});

// health check api, suitable for integration with ELB health checking
app.route('/health').get(async (req: Request, res: Response) => {
  try {
    const stream = await proxy.healthCheckStream(res as ExpressResponse);
    stream
      .on('error', () => {
        // just end the request and let the HTTP status code convey the error
        res.end();
      })
      .pipe(res);
  } catch (error) {
    handleError(req, res, error as ErrorWithDetails);
  }
});

// redirect requests to root
app.get('/', (req: Request, res: Response) => {
  res.redirect('/index.html');
});

// route all get requests to s3proxy
app
  .route('/*')
  .head(async (req: Request, res: Response) => {
    try {
      const stream = await proxy.head(req as ExpressRequest, res as ExpressResponse);
      stream
        .on('error', (err: ErrorWithDetails) => {
          handleError(req, res, err);
        })
        .pipe(res);
    } catch (error) {
      handleError(req, res, error as ErrorWithDetails);
    }
  })
  .get(async (req: Request, res: Response) => {
    try {
      const stream = await proxy.get(req as ExpressRequest, res as ExpressResponse);
      stream
        .on('error', (err: ErrorWithDetails) => {
          handleError(req, res, err);
        })
        .pipe(res);
    } catch (error) {
      handleError(req, res, error as ErrorWithDetails);
    }
  });

if (port > 0) {
  app.listen(port, () => {
    debugLog(`s3proxy listening on port ${port}`);
  });
}

export default app;
