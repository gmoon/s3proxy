import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { parse as parseUrl } from 'node:url';
import {
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadBucketCommand,
  type HeadBucketCommandOutput,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  NoSuchBucket,
  NoSuchKey,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { S3Forbidden, S3InvalidRange, S3NotFound, type S3ProxyError } from './errors.js';
import type {
  HttpRequest,
  HttpResponse,
  ParsedRequest,
  S3Params,
  S3ProxyConfig,
  S3ProxyOptions,
  S3ProxyResponse,
} from './types.js';
import { UserException } from './UserException.js';
import { VERSION } from './version.js';

export class S3Proxy extends EventEmitter {
  private readonly bucket: string;
  private readonly options: S3ProxyOptions;
  private s3?: S3Client;

  constructor(config: S3ProxyConfig) {
    super();

    if (!config) {
      throw new UserException('InvalidParameterList', 'constructor parameters are required');
    }
    if (!config.bucket) {
      throw new UserException('InvalidParameterList', 'bucket parameter is required');
    }

    this.bucket = config.bucket;
    this.options = Object.fromEntries(
      Object.entries(config).filter(([key]) => key !== 'bucket')
    ) as S3ProxyOptions;
  }

  /**
   * If headerKey is present in the http headers, then return an object whose
   * key is paramKey and whose value is the value of headerKey in the http
   * header.
   *
   * If headerKey is not present in the http headers, then return an empty
   * object: {}
   *
   * This return value is designed to be merged to the S3 params via the
   * spread operator (...)
   */
  public static mapHeaderToParam(
    req: HttpRequest,
    headerKey: string,
    paramKey: string
  ): Record<string, string> | Record<string, never> {
    if (req.headers?.[headerKey]) {
      const headerValue = req.headers[headerKey];
      const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if (typeof value === 'string') {
        return { [paramKey]: value };
      }
    }
    return {};
  }

  public static version(): string {
    return VERSION;
  }

  /**
   * From s3proxy object and http request, return S3 Params
   *   - Bucket: (required) name of bucket, taken from s3proxy object
   *   - Key: (required) name of key to stream
   *   - Range: (optional) byte range to return
   */
  private getS3Params(req: HttpRequest): S3Params {
    const r = S3Proxy.parseRequest(req);
    const params: S3Params = {
      Bucket: this.bucket,
      Key: r.key,
      ...S3Proxy.mapHeaderToParam(req, 'range', 'Range'),
    };
    return params;
  }

  public isInitialized(): void {
    void this.client;
  }

  private get client(): S3Client {
    if (!this.s3) {
      throw new UserException('UninitializedError', 'S3Proxy is uninitialized (call s3proxy.init)');
    }
    return this.s3;
  }

  /**
   * Return key and query from request object, since different HTTP frameworks
   * (Express, Fastify, etc.) and the HTTP module have different req objects.
   * key is req.path if defined, or pathname from url.parse object
   * key also has any leading slash stripped
   * query is req.query, or query from url.parse object
   */
  public static parseRequest(req: HttpRequest): ParsedRequest {
    const obj: ParsedRequest = {
      key: '',
      query: {},
    };

    // HTTP framework objects (Express, Fastify) have path, raw HTTP objects do not
    if (typeof req.path === 'undefined') {
      const parsedUrl = parseUrl(req.url, true);
      // Filter out undefined values from query
      const query = parsedUrl.query || {};
      obj.query = Object.fromEntries(
        Object.entries(query).filter(([, value]) => value !== undefined)
      ) as Record<string, string | string[]>;
      obj.key = decodeURIComponent(parsedUrl.pathname || '');
    } else {
      obj.query = req.query || {};
      obj.key = decodeURIComponent(req.path);
    }
    obj.key = S3Proxy.stripLeadingSlash(obj.key);
    return obj;
  }

  public static stripLeadingSlash(str: string): string {
    return str.replace(/^\/+/, '');
  }

  public static createEmptyReadstream(): Readable {
    const stream = new Readable();
    stream.push(null);
    return stream;
  }

  // Maps typed SDK output fields to lowercase HTTP header names. Replaces the
  // command-middleware hack that read pre-serialized wire headers; this uses
  // public typed fields, so no `any` casts are needed.
  private static readonly OUTPUT_HEADER_MAP: ReadonlyArray<readonly [string, string]> = [
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

  private static outputToHeaders(
    output: GetObjectCommandOutput | HeadObjectCommandOutput | HeadBucketCommandOutput
  ): Record<string, string> {
    const h: Record<string, string> = {};
    const fields = output as unknown as Record<string, unknown>;
    for (const [src, dst] of S3Proxy.OUTPUT_HEADER_MAP) {
      const v = fields[src];
      if (v === undefined || v === null) continue;
      h[dst] = v instanceof Date ? v.toUTCString() : String(v);
    }
    return h;
  }

  /**
   * Map an AWS SDK error to a typed S3ProxyError. The original SDK error
   * is attached as `cause` for diagnostics. Anything we can't classify
   * is rethrown unchanged.
   */
  private mapError(e: unknown, target: string): S3ProxyError | never {
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
   * Get a Readstream from Body.
   * Type definition is:
   *   Body?: SdkStream<undefined | Readable | Blob | ReadableStream<any>>
   *
   * We don't need to consider the ReadableStream or Blob type as those don't exist
   * on node, only browser.
   */
  public static getReadstream(body: unknown): Readable {
    if (body === undefined) {
      return S3Proxy.createEmptyReadstream();
    }
    if (body instanceof Readable) {
      return body;
    }
    throw new Error('unrecognized type');
  }

  private async getObject(req: HttpRequest): Promise<S3ProxyResponse> {
    const params = this.getS3Params(req);
    const command = new GetObjectCommand(params);
    try {
      const output = await this.client.send(command);
      return {
        s3stream: S3Proxy.getReadstream(output.Body),
        statusCode: output.$metadata.httpStatusCode ?? 200,
        headers: S3Proxy.outputToHeaders(output),
      };
    } catch (e) {
      throw this.mapError(e, params.Key);
    }
  }

  private async headObject(req: HttpRequest): Promise<S3ProxyResponse> {
    const params = this.getS3Params(req);
    const command = new HeadObjectCommand(params);
    try {
      const output = await this.client.send(command);
      return {
        s3stream: S3Proxy.createEmptyReadstream(),
        statusCode: output.$metadata.httpStatusCode ?? 200,
        headers: S3Proxy.outputToHeaders(output),
      };
    } catch (e) {
      throw this.mapError(e, params.Key);
    }
  }

  private async headBucket(): Promise<S3ProxyResponse> {
    const command = new HeadBucketCommand({ Bucket: this.bucket });
    try {
      const output = await this.client.send(command);
      return {
        s3stream: S3Proxy.createEmptyReadstream(),
        statusCode: output.$metadata.httpStatusCode ?? 200,
        headers: S3Proxy.outputToHeaders(output),
      };
    } catch (e) {
      throw this.mapError(e, this.bucket);
    }
  }

  /*
  =========================================================================================

    Public Methods

  =========================================================================================
  */

  public async init(): Promise<void> {
    try {
      this.s3 = new S3Client(this.options);
      await this.healthCheck();
      this.emit('init');
    } catch (e) {
      this.emit('error', e);
      throw e;
    }
  }

  public async healthCheck(): Promise<void> {
    const command = new HeadBucketCommand({ Bucket: this.bucket });
    await this.client.send(command);
  }

  public async healthCheckStream(res: HttpResponse): Promise<Readable> {
    const { s3stream, statusCode, headers } = await this.headBucket();
    res.writeHead(statusCode, headers);
    return s3stream as Readable;
  }

  public async head(req: HttpRequest, res: HttpResponse): Promise<Readable> {
    const { s3stream, statusCode, headers } = await this.headObject(req);
    res.writeHead(statusCode, headers);
    return s3stream as Readable;
  }

  public async get(req: HttpRequest, res: HttpResponse): Promise<Readable> {
    const { s3stream, statusCode, headers } = await this.getObject(req);
    res.writeHead(statusCode, headers);
    return s3stream as Readable;
  }
}

export { UserException };
export { S3Forbidden, S3InvalidRange, S3NotFound, S3ProxyError } from './errors.js';
export type { HttpRequest, HttpResponse, ParsedRequest, S3Error, S3ProxyConfig } from './types.js';
export default S3Proxy;
