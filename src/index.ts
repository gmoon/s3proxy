import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { parse as parseUrl } from 'node:url';
import {
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchBucket,
  NoSuchKey,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
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

// Import version from generated file
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
   * Test the Error object to see if it should be treated as non-fatal
   */
  public static isNonFatalError(e: unknown): boolean {
    return (
      e instanceof NoSuchKey ||
      e instanceof NoSuchBucket ||
      (e instanceof S3ServiceException && e.name === 'AccessDenied') ||
      (e instanceof S3ServiceException && e.name === 'InvalidRange')
    );
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
    if (!this.s3) {
      const error = new UserException(
        'UninitializedError',
        'S3Proxy is uninitialized (call s3proxy.init)'
      );
      throw error;
    }
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

  /**
   * 1. Send provided command through the s3 client
   * 2. Use middleware to capture
   *   2a. item.Body as Readable s3stream (empty if item.Body is missing)
   *   2b. req.headers as headers
   *   2c. req.statusCode as statusCode
   * 3. return { s3stream, statusCode, headers }
   */
  private async send(
    command: GetObjectCommand | HeadObjectCommand | HeadBucketCommand
  ): Promise<S3ProxyResponse> {
    this.isInitialized();
    let headers: Record<string, string> = {};
    let statusCode = 200;
    let s3stream: Readable;

    // Add middleware to capture response metadata
    // Using any here is necessary for AWS SDK middleware compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (command as any).middlewareStack.add(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next: any) => async (args: any) => {
        const result = await next(args);
        headers = result.response.headers || {};
        statusCode = result.response.statusCode || 200;
        return result;
      },
      // priority: low is important here, otherwise middleware is never
      // executed for non-2xx responses. Not sure why
      // Link: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
      { step: 'deserialize', priority: 'low' }
    );

    try {
      const item = await this.s3?.send(command as any);
      s3stream = S3Proxy.getReadstream((item as GetObjectCommandOutput).Body);
    } catch (e) {
      if (S3Proxy.isNonFatalError(e)) {
        s3stream = S3Proxy.createEmptyReadstream();
        // Try to get the actual HTTP status code from the exception
        if (e instanceof S3ServiceException && e.$response?.statusCode) {
          statusCode = e.$response.statusCode;
        }
      } else {
        throw e;
      }
    }
    return { s3stream, statusCode, headers };
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
    return this.send(command);
  }

  private async headObject(req: HttpRequest): Promise<S3ProxyResponse> {
    const params = this.getS3Params(req);
    const command = new HeadObjectCommand(params);
    return this.send(command);
  }

  private async headBucket(): Promise<S3ProxyResponse> {
    const command = new HeadBucketCommand({ Bucket: this.bucket });
    return this.send(command);
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
    await this.s3?.send(command);
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
export type { HttpRequest, HttpResponse, ParsedRequest, S3Error, S3ProxyConfig } from './types.js';
export default S3Proxy;
