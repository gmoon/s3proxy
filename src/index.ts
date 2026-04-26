import { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';
import { GetObjectCommand, HeadBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { mapHeaderToParam, parseRequest } from './request-parser.js';
import { S3Gateway } from './s3-gateway.js';
import type {
  HttpRequest,
  HttpResponse,
  S3FetchResponse,
  S3Params,
  S3ProxyConfig,
  S3ProxyOptions,
} from './types.js';
import { UserException } from './UserException.js';
import { VERSION } from './version.js';

export class S3Proxy extends EventEmitter {
  private readonly bucket: string;
  private readonly verifyOnInit: boolean;
  private readonly gateway: S3Gateway;

  constructor(config: S3ProxyConfig) {
    super();

    if (!config) {
      throw new UserException('InvalidParameterList', 'constructor parameters are required');
    }
    if (!config.bucket) {
      throw new UserException('InvalidParameterList', 'bucket parameter is required');
    }

    this.bucket = config.bucket;
    this.verifyOnInit = config.verifyOnInit ?? true;
    const options = Object.fromEntries(
      Object.entries(config).filter(([key]) => key !== 'bucket' && key !== 'verifyOnInit')
    ) as S3ProxyOptions;
    this.gateway = new S3Gateway(options);
  }

  public static version(): string {
    return VERSION;
  }

  public isInitialized(): void {
    this.gateway.isInitialized();
  }

  public async init(): Promise<void> {
    try {
      this.gateway.init();
      if (this.verifyOnInit) {
        await this.healthCheck();
      }
      this.emit('init');
    } catch (e) {
      this.emit('error', e);
      throw e;
    }
  }

  public async healthCheck(): Promise<void> {
    await this.headBucket();
  }

  /**
   * Pure fetch: returns the stream + status + headers without writing
   * to a response. Dispatches GET or HEAD based on `req.method`
   * (defaults to GET). Throws typed S3ProxyError on classified failures.
   */
  public async fetch(req: HttpRequest): Promise<S3FetchResponse> {
    const params = this.buildParams(req);
    const command =
      req.method === 'HEAD' ? new HeadObjectCommand(params) : new GetObjectCommand(params);
    return this.gateway.send(command, params.Key);
  }

  public async healthCheckStream(res: HttpResponse): Promise<Readable> {
    const r = await this.headBucket();
    res.writeHead(r.status, r.headers);
    return r.stream as Readable;
  }

  private headBucket(): Promise<S3FetchResponse> {
    return this.gateway.send(new HeadBucketCommand({ Bucket: this.bucket }), this.bucket);
  }

  public async head(req: HttpRequest, res: HttpResponse): Promise<Readable> {
    const headReq = { ...req, method: 'HEAD' as const } as HttpRequest;
    const r = await this.fetch(headReq);
    res.writeHead(r.status, r.headers);
    return r.stream as Readable;
  }

  public async get(req: HttpRequest, res: HttpResponse): Promise<Readable> {
    const r = await this.fetch(req);
    res.writeHead(r.status, r.headers);
    return r.stream as Readable;
  }

  private buildParams(req: HttpRequest): S3Params {
    const parsed = parseRequest(req);
    return {
      Bucket: this.bucket,
      Key: parsed.key,
      ...mapHeaderToParam(req, 'range', 'Range'),
    };
  }
}

export { UserException };
export {
  InvalidRequest,
  S3Forbidden,
  S3InvalidRange,
  S3NotFound,
  S3ProxyError,
} from './errors.js';
export { mapHeaderToParam, parseRequest, stripLeadingSlash } from './request-parser.js';
export type {
  HttpRequest,
  HttpResponse,
  ParsedRequest,
  S3Error,
  S3FetchResponse,
  S3ProxyConfig,
} from './types.js';
export default S3Proxy;
