import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  type GetObjectCommandOutput,
  type HeadBucketCommand,
  type HeadBucketCommandOutput,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  NoSuchBucket,
  NoSuchKey,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { S3Forbidden, S3InvalidRange, S3NotFound, type S3ProxyError } from './errors.js';
import type { S3FetchResponse, S3ProxyOptions } from './types.js';
import { UserException } from './UserException.js';

type SupportedCommand = GetObjectCommand | HeadObjectCommand | HeadBucketCommand;
type SupportedOutput = GetObjectCommandOutput | HeadObjectCommandOutput | HeadBucketCommandOutput;

const OUTPUT_HEADER_MAP: ReadonlyArray<readonly [string, string]> = [
  ['ContentType', 'content-type'],
  ['ContentLength', 'content-length'],
  ['ContentRange', 'content-range'],
  ['ContentEncoding', 'content-encoding'],
  ['ContentLanguage', 'content-language'],
  ['ContentDisposition', 'content-disposition'],
  ['CacheControl', 'cache-control'],
  ['ETag', 'etag'],
  ['LastModified', 'last-modified'],
  ['AcceptRanges', 'accept-ranges'],
  ['Expires', 'expires'],
];

function createEmptyReadstream(): Readable {
  const stream = new Readable();
  stream.push(null);
  return stream;
}

function getReadstream(body: unknown): Readable {
  if (body === undefined) return createEmptyReadstream();
  if (body instanceof Readable) return body;
  throw new Error('unrecognized type');
}

function outputToHeaders(output: SupportedOutput): Record<string, string> {
  const h: Record<string, string> = {};
  const fields = output as unknown as Record<string, unknown>;
  for (const [src, dst] of OUTPUT_HEADER_MAP) {
    const v = fields[src];
    if (v === undefined || v === null) continue;
    h[dst] = v instanceof Date ? v.toUTCString() : String(v);
  }
  return h;
}

function mapError(e: unknown, target: string): S3ProxyError | never {
  if (e instanceof NoSuchKey || e instanceof NoSuchBucket) {
    return new S3NotFound(target, { cause: e });
  }
  if (e instanceof S3ServiceException) {
    if (e.name === 'AccessDenied') return new S3Forbidden(target, { cause: e });
    if (e.name === 'InvalidRange') return new S3InvalidRange(target, { cause: e });
  }
  throw e;
}

/**
 * Owns the AWS S3Client lifecycle and turns SDK responses into the
 * library's public S3FetchResponse shape (or a typed S3ProxyError).
 * The proxy orchestrates request parsing and routing; the gateway
 * is the boundary with the AWS SDK.
 */
export class S3Gateway {
  private s3?: S3Client;

  constructor(private readonly options: S3ProxyOptions) {}

  init(): void {
    this.s3 = new S3Client(this.options);
  }

  isInitialized(): void {
    void this.client;
  }

  private get client(): S3Client {
    if (!this.s3) {
      throw new UserException('UninitializedError', 'S3Proxy is uninitialized (call s3proxy.init)');
    }
    return this.s3;
  }

  async send(command: SupportedCommand, target: string): Promise<S3FetchResponse> {
    try {
      const output = await this.dispatch(command);
      const body = 'Body' in output ? output.Body : undefined;
      return {
        stream: getReadstream(body),
        status: output.$metadata.httpStatusCode ?? 200,
        headers: outputToHeaders(output),
      };
    } catch (e) {
      throw mapError(e, target);
    }
  }

  // S3Client.send is overloaded per command type; a union argument
  // doesn't match any single overload. Discriminate on the command
  // class to recover the precise signature without an `any` cast.
  private async dispatch(command: SupportedCommand): Promise<SupportedOutput> {
    if (command instanceof GetObjectCommand) return this.client.send(command);
    if (command instanceof HeadObjectCommand) return this.client.send(command);
    return this.client.send(command);
  }
}
