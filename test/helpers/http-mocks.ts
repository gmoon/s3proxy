import type { HttpRequest } from '../../src/types.js';

export function makeReq(path: string, headers: Record<string, string> = {}): HttpRequest {
  return { url: path, headers, method: 'GET', path };
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
