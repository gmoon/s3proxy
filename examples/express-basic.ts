/*
  S3Proxy Express Framework Example

  Passes HTTP GET requests to s3proxy
  Start: PORT=3000 tsx examples/express-basic.ts
  Test: npm run test

  Author: George Moon <george.moon@gmail.com>
*/

import { XmlNode, XmlText } from '@aws-sdk/xml-builder';
import bodyParser from 'body-parser';
import express, { type Request, type Response } from 'express';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { S3Proxy } from '../src/index.js';
import type { ExpressRequest, ExpressResponse } from '../src/types.js';

// Create logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'production'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        },
      }),
});

const port = Number(process.env.PORT) || 0;
const app = express();

app.set('view engine', 'pug');
app.use(pinoHttp({ logger }));
app.use(bodyParser.json());

interface ErrorWithDetails extends Error {
  time?: string;
  code?: string;
  statusCode?: number;
}

function handleError(req: Request, res: Response, err: ErrorWithDetails): void {
  // Log error with context using pino
  req.log.error({ err, statusCode: err.statusCode || 500 }, 'Request error');

  // Build XML response using AWS SDK XMLNode and XMLText
  const errorNode = new XmlNode('error')
    .addAttribute('time', err.time || new Date().toISOString())
    .addAttribute('code', err.code || 'InternalError')
    .addAttribute('statusCode', String(err.statusCode || 500))
    .addAttribute('url', req.url)
    .addAttribute('method', req.method || 'GET')
    .addChildNode(new XmlText(err.message));

  const errorXml = `<?xml version="1.0"?>\n${errorNode.toString()}`;

  res
    .status(err.statusCode || 500)
    .type('application/xml')
    .send(errorXml);
}

// initialize the s3proxy
const bucketName = process.env.BUCKET || 's3proxy-public';
const proxy = new S3Proxy({ bucket: bucketName });

// Initialize proxy with proper error handling
try {
  await proxy.init();
  logger.info({ bucket: bucketName }, 'S3Proxy initialized');
} catch (error) {
  logger.fatal({ err: error, bucket: bucketName }, 'Failed to initialize S3Proxy');
  process.exit(1);
}

proxy.on('error', (err: Error) => {
  logger.error({ err, bucket: bucketName }, 'S3Proxy error');
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
app.get('/', (_req: Request, res: Response) => {
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
    logger.info({ port }, 'S3Proxy server started');
  });
}

export default app;
