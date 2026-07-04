import { Writable } from 'node:stream';
import type { HttpRequest, HttpResponse, RequestHandler } from '../../src/types.js';

export function makeReq(path: string, headers: Record<string, string> = {}): HttpRequest {
  return { url: path, headers, method: 'GET', path };
}

/**
 * A ServerResponse-shaped sink: a Writable that records the
 * writeHead(status, headers) call and buffers the body, so the convenience
 * adapters (pipe/middleware/staticSite) can be asserted against without a
 * real HTTP server.
 */
export class FakeResponse extends Writable implements HttpResponse {
  status?: number;
  headers?: Record<string, string>;
  headersSent = false;
  private chunks: Buffer[] = [];

  writeHead(status: number, headers?: Record<string, string>): this {
    this.status = status;
    this.headers = headers;
    this.headersSent = true;
    return this;
  }

  _write(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error | null) => void): void {
    this.chunks.push(Buffer.from(chunk));
    cb();
  }

  get body(): string {
    return Buffer.concat(this.chunks).toString('utf-8');
  }
}

/**
 * A response whose writeHead marks headers as sent and then throws — used
 * to drive the adapters' error-forwarding (`next`) and already-sent guard
 * paths, which a normal S3 failure never reaches (those get rendered inside
 * pipe/serveStatic, not rejected).
 */
export class ThrowingResponse extends FakeResponse {
  writeHead(): never {
    this.headersSent = true;
    throw new Error('writeHead failed');
  }
}

/** Run a request handler to completion (finish/close) and return the response. */
export function serve(handler: RequestHandler, req: HttpRequest): Promise<FakeResponse> {
  const res = new FakeResponse();
  return new Promise((resolve) => {
    res.on('finish', () => resolve(res));
    res.on('close', () => resolve(res));
    handler(req, res);
  });
}

export async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Resolves to the rejection reason of a promise, or `null` if it fulfilled.
 * Use when a test needs to inspect properties on a thrown error
 * (e.g. `cause`, `statusCode`) beyond just its type.
 */
export async function catchError<T>(promise: Promise<T>): Promise<unknown> {
  return promise.then(
    () => null,
    (e) => e
  );
}
