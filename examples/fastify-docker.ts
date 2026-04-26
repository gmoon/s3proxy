/**
 * S3Proxy Fastify Docker Example
 *
 * Docker-compatible version that imports from the installed s3proxy package.
 * Uses the v4 proxy.fetch() API.
 */

import fs from 'node:fs';
import { XmlNode, XmlText } from '@aws-sdk/xml-builder';
import Fastify from 'fastify';
import type { HttpRequest } from 's3proxy';
import { S3Proxy } from 's3proxy';

const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'production',
});

const port = Number(process.env.PORT) || 3000;
const bucket = process.env.BUCKET || 's3proxy-public';

function getCredentials() {
  const dockerFile = '/src/credentials.json';
  const localFile = './credentials.json';
  const file = fs.existsSync(dockerFile) ? dockerFile : localFile;
  let contents: { accessKeyId: string; secretAccessKey: string; sessionToken: string } | undefined;
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

const credentials = getCredentials();
const proxy = new S3Proxy(credentials ? { bucket, credentials } : { bucket });
await proxy.init();

function createErrorXml(
  err: { statusCode?: number; code?: string; name?: string; message: string },
  url: string
): string {
  const errorXml = new XmlNode('error')
    .addAttribute('code', err.code || err.name || 'InternalError')
    .addAttribute('statusCode', String(err.statusCode || 500))
    .addAttribute('url', url)
    .addChildNode(new XmlText(err.message))
    .toString();

  return `<?xml version="1.0"?>\n${errorXml}`;
}

fastify.setErrorHandler(async (error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const errorXml = createErrorXml(error, request.url);
  reply.status(statusCode).type('application/xml').send(errorXml);
});

fastify.get('/health', async (_request, reply) => {
  return reply.status(200).send('OK');
});

fastify.head('/*', async (request, reply) => {
  const { status, headers } = await proxy.fetch({
    ...(request.raw as unknown as HttpRequest),
    method: 'HEAD',
  });
  reply.raw.writeHead(status, headers).end();
  return reply.hijack();
});

fastify.get('/*', async (request, reply) => {
  const { stream, status, headers } = await proxy.fetch(request.raw as unknown as HttpRequest);
  reply.raw.writeHead(status, headers);
  stream.on('error', (err: { statusCode?: number; code?: string; message: string }) => {
    if (!reply.raw.headersSent) {
      const errorXml = createErrorXml(err, request.url);
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
