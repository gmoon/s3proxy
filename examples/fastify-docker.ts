/**
 * S3Proxy Fastify Docker Example
 * 
 * Docker-compatible version that imports from the installed s3proxy package
 */

import { XmlNode, XmlText } from '@aws-sdk/xml-builder';
import Fastify from 'fastify';
import fs from 'node:fs';
import { S3Proxy } from 's3proxy';
import type { HttpRequest, HttpResponse } from 's3proxy';

const fastify = Fastify({ 
  logger: process.env.NODE_ENV !== 'production' 
});

const port = Number(process.env.PORT) || 3000;
const bucket = process.env.BUCKET || 's3proxy-public';

// In non-production environments, if a credentials file exists, return the credentials
// To create a temporary credentials file:
//     aws sts get-session-token --duration 900 > credentials.json
//
function getCredentials() {
  // Try Docker path first, then local path
  const dockerFile = '/src/credentials.json';
  const localFile = './credentials.json';
  const file = fs.existsSync(dockerFile) ? dockerFile : localFile;
  let contents;
  try {
    const credentials = JSON.parse(fs.readFileSync(file, 'utf8')).Credentials;
    if (process.env.NODE_ENV?.match(/^prod/i)) {
      throw new Error('will not use a credentials file in production');
    }
    contents = {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    };
    console.log(`using credentials from ${file}`);
  } catch (_e) {
    console.log('using sdk credential chain');
  }
  return contents;
}

// Initialize S3Proxy with credentials
const credentials = getCredentials();
const proxy = new S3Proxy({ bucket, credentials });
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
  // Simple health check that returns "OK" - matches test expectations
  return reply.status(200).send('OK');
});

fastify.get('/', async (request, reply) => {
  return reply.redirect('/index.html');
});

fastify.head('/*', async (request, reply) => {
  const stream = await proxy.head(request.raw as HttpRequest, reply.raw as HttpResponse);
  stream.on('error', (err) => {
    const errorXml = createErrorXml(err, request.url);
    reply.status(err.statusCode || 500).type('application/xml').send(errorXml);
  });
  return reply.send(stream);
});

fastify.get('/*', async (request, reply) => {
  const stream = await proxy.get(request.raw as HttpRequest, reply.raw as HttpResponse);
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
