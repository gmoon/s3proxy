/**
 * S3Proxy Fastify Basic Example
 * 
 * Modern Express alternative with native async/await support
 */

import { XmlNode, XmlText } from '@aws-sdk/xml-builder';
import Fastify from 'fastify';
import { S3Proxy } from '../src/index.js';
import type { ExpressRequest, ExpressResponse } from '../src/types.js';

const fastify = Fastify({ 
  logger: process.env.NODE_ENV !== 'production' 
});

const port = Number(process.env.PORT) || 3000;
const bucket = process.env.BUCKET || 's3proxy-public';

// Initialize S3Proxy
const proxy = new S3Proxy({ bucket });
await proxy.init();

// Error handler
function createErrorXml(err: any, url: string): string {
  const errorXml = new XmlNode('error')
    .addAttribute('code', err.code || 'InternalError')
    .addAttribute('statusCode', String(err.statusCode || 500))
    .addAttribute('url', url)
    .addChildNode(new XmlText(err.message))
    .toString();

  return `<?xml version="1.0"?>\n${errorXml}`;
}

// Custom error handler
fastify.setErrorHandler(async (error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const errorXml = createErrorXml(error, request.url);
  
  reply
    .status(statusCode)
    .type('application/xml')
    .send(errorXml);
});

// Routes - No try/catch needed! Fastify handles async errors automatically
fastify.get('/health', async (request, reply) => {
  const stream = await proxy.healthCheckStream(reply.raw as ExpressResponse);
  stream.on('error', () => reply.raw.end());
  return reply.send(stream);
});

fastify.get('/', async (request, reply) => {
  return reply.redirect('/index.html');
});

fastify.head('/*', async (request, reply) => {
  const stream = await proxy.head(request.raw as ExpressRequest, reply.raw as ExpressResponse);
  stream.on('error', (err) => {
    const errorXml = createErrorXml(err, request.url);
    reply.status(err.statusCode || 500).type('application/xml').send(errorXml);
  });
  return reply.send(stream);
});

fastify.get('/*', async (request, reply) => {
  const stream = await proxy.get(request.raw as ExpressRequest, reply.raw as ExpressResponse);
  stream.on('error', (err) => {
    const errorXml = createErrorXml(err, request.url);
    reply.status(err.statusCode || 500).type('application/xml').send(errorXml);
  });
  return reply.send(stream);
});

// Start server
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
