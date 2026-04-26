/**
 * S3Proxy Fastify Basic Example
 *
 * Modern Express alternative with native async/await support. Uses the
 * v4 proxy.fetch() API: pure data fetch, frameworks own the response.
 */

import { XmlNode, XmlText } from '@aws-sdk/xml-builder';
import Fastify from 'fastify';
import { S3Proxy } from '../src/index.js';
import type { HttpRequest, S3Error } from '../src/types.js';

const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

const port = Number(process.env.PORT) || 3000;
const bucket = process.env.BUCKET || 's3proxy-public';

const proxy = new S3Proxy({ bucket });
await proxy.init();

function createErrorXml(err: S3Error, url: string): string {
  const errorXml = new XmlNode('error')
    .addAttribute('code', err.code || err.name || 'InternalError')
    .addAttribute('statusCode', String(err.statusCode || 500))
    .addAttribute('url', url)
    .addChildNode(new XmlText(err.message))
    .toString();

  return `<?xml version="1.0"?>\n${errorXml}`;
}

fastify.setErrorHandler(async (error, request, reply) => {
  const err = error as S3Error;
  const statusCode = err.statusCode || 500;
  const errorXml = createErrorXml(err, request.url);
  reply.status(statusCode).type('application/xml').send(errorXml);
});

fastify.get('/health', async (_request, reply) => {
  await proxy.healthCheck();
  return reply.status(200).type('text/plain').send('OK');
});

fastify.get('/', async (_request, reply) => {
  return reply.redirect('/index.html');
});

fastify.head('/*', async (request, reply) => {
  const { status, headers } = await proxy.fetch({
    ...(request.raw as unknown as HttpRequest),
    method: 'HEAD',
  });
  reply.raw.writeHead(status, headers).end();
  // Tell Fastify we've handled the response ourselves.
  return reply.hijack();
});

fastify.get('/*', async (request, reply) => {
  const { stream, status, headers } = await proxy.fetch(request.raw as unknown as HttpRequest);
  reply.raw.writeHead(status, headers);
  stream.on('error', (err: S3Error) => {
    const errorXml = createErrorXml(err, request.url);
    if (!reply.raw.headersSent) {
      reply
        .status(err.statusCode || 500)
        .type('application/xml')
        .send(errorXml);
    } else {
      reply.raw.end();
    }
  });
  stream.pipe(reply.raw);
  return reply.hijack();
});

if (port > 0) {
  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`S3Proxy server running on port ${port}, serving bucket: ${bucket}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

export default fastify;
