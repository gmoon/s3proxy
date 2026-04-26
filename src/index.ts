import { EventEmitter } from 'node:events';
import { GetObjectCommand, HeadBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { mapHeaderToParam, parseRequest } from './request-parser.js';
import { S3Gateway } from './s3-gateway.js';
import type { HttpRequest, S3FetchResponse, S3Params, S3ProxyConfig } from './types.js';
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

    const { bucket, verifyOnInit, ...options } = config;
    this.bucket = bucket;
    this.verifyOnInit = verifyOnInit ?? true;
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
    await this.gateway.send(new HeadBucketCommand({ Bucket: this.bucket }), this.bucket);
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

  private buildParams(req: HttpRequest): S3Params {
    const parsed = parseRequest(req);
    return {
      Bucket: this.bucket,
      Key: parsed.key,
      ...mapHeaderToParam(req, 'range', 'Range'),
    };
  }
}

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
  ParsedRequest,
  S3Error,
  S3FetchResponse,
  S3ProxyConfig,
} from './types.js';
export { UserException };
export default S3Proxy;
