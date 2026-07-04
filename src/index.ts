import { EventEmitter } from 'node:events';
import { GetObjectCommand, HeadBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { S3Forbidden, S3NotFound, S3ProxyError } from './errors.js';
import { mapHeaderToParam, parseRequest } from './request-parser.js';
import { S3Gateway } from './s3-gateway.js';
import type {
  HttpRequest,
  HttpResponse,
  RequestHandler,
  S3FetchResponse,
  S3Params,
  S3ProxyConfig,
  StaticSiteOptions,
} from './types.js';
import { UserException } from './UserException.js';
import { VERSION } from './version.js';

/**
 * Resolve an index document the way S3 website hosting does: root and
 * "directory" paths (trailing slash) map to the index key. A bare
 * `/photos` with no trailing slash is left as-is (S3 would 302-redirect
 * to `/photos/` after a ListObjects probe; that heavier behavior is out
 * of scope here).
 */
function resolveIndexKey(key: string, indexDocument: string): string {
  if (!indexDocument) return key;
  if (key === '' || key.endsWith('/')) return key + indexDocument;
  return key;
}

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
    return this.fetchKey(parseRequest(req).key, req);
  }

  /**
   * Fetch a specific key, taking the method and Range header from `req`
   * but ignoring its path. Lets the static-site layer rewrite the key
   * (index/error documents) without re-parsing or re-encoding the URL.
   */
  private fetchKey(key: string, req: HttpRequest): Promise<S3FetchResponse> {
    const params: S3Params = {
      Bucket: this.bucket,
      Key: key,
      ...mapHeaderToParam(req, 'range', 'Range'),
    };
    const command =
      req.method === 'HEAD' ? new HeadObjectCommand(params) : new GetObjectCommand(params);
    return this.gateway.send(command, params.Key);
  }

  /**
   * Convenience adapter over the pure `fetch()` primitive: fetch the
   * object and write it straight to an HTTP response. Recovers v3's
   * one-call ergonomics (`proxy.get(req, res)`) *without* v3's empty-200
   * lie — a missing key or denied object renders the honest 404/403/416
   * status instead of a silent success.
   *
   * The response body for a classified failure is a short plaintext line.
   * Callers who need a custom error page (XML, HTML, structured logging)
   * should use `fetch()` directly and render errors themselves.
   *
   * Resolves once the body has finished streaming (or the error response
   * has been written). Never rejects for classified S3 failures — it
   * renders them. It only rejects if `res.writeHead` itself throws.
   */
  public pipe(req: HttpRequest, res: HttpResponse): Promise<void> {
    return this.fetch(req).then(
      (response) => this.writeBody(res, response),
      (err) => {
        this.renderError(res, err);
      }
    );
  }

  /**
   * Write status + headers and pipe the body, resolving when it finishes.
   * The single "write the response" path shared by `pipe()`, the static-site
   * happy path, and the error-document render. Once headers are sent a
   * mid-stream S3 failure can only be handled by terminating the response —
   * the status can't change.
   */
  private writeBody(
    res: HttpResponse,
    { stream, status, headers }: S3FetchResponse
  ): Promise<void> {
    res.writeHead(status, headers);
    return new Promise<void>((resolve) => {
      stream.on('error', () => {
        res.end();
        resolve();
      });
      stream.on('end', resolve);
      stream.pipe(res);
    });
  }

  /**
   * Returns an Express/Connect-style request handler built on `pipe()`.
   * Drop-in replacement for hand-writing the try/catch + writeHead + pipe
   * boilerplate:
   *
   *   app.get('/*splat', proxy.middleware());
   *
   * If a `next` callback is supplied and an unexpected (non-classified)
   * error escapes, it is forwarded to the framework's error handler.
   */
  public middleware(): RequestHandler {
    return (req, res, next) => {
      this.pipe(req, res).catch((err) => this.onHandlerError(res, err, next));
    };
  }

  /**
   * Shared handler-error policy: forward to the framework's `next` when
   * present, otherwise render the error ourselves. `renderError` already
   * no-ops (just ends the response) once headers are sent.
   */
  private onHandlerError(res: HttpResponse, err: unknown, next?: (err?: unknown) => void): void {
    if (next) {
      next(err);
    } else {
      this.renderError(res, err);
    }
  }

  private renderError(res: HttpResponse, err: unknown): void {
    if (res.headersSent) {
      res.end();
      return;
    }
    const status = err instanceof S3ProxyError ? err.statusCode : 500;
    const message = err instanceof Error ? err.message : String(err);
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(message);
  }

  /**
   * Returns a request handler that replicates S3 static website hosting on
   * top of `fetch()`: index-document resolution (`/` → `index.html`) and,
   * when `errorDocument` is set, serving that key with the original 4xx
   * status for missing/forbidden objects. Everything else falls through to
   * `renderError` (or `next`). The pure `fetch()` primitive is unchanged —
   * this behavior lives entirely in the layer.
   *
   *   app.use(proxy.staticSite({ indexDocument: 'index.html', errorDocument: '404.html' }));
   */
  public staticSite(options: StaticSiteOptions = {}): RequestHandler {
    const indexDocument = options.indexDocument ?? 'index.html';
    const { errorDocument } = options;
    return (req, res, next) => {
      this.serveStatic(req, res, indexDocument, errorDocument).catch((err) =>
        this.onHandlerError(res, err, next)
      );
    };
  }

  private async serveStatic(
    req: HttpRequest,
    res: HttpResponse,
    indexDocument: string,
    errorDocument?: string
  ): Promise<void> {
    const key = resolveIndexKey(parseRequest(req).key, indexDocument);
    try {
      await this.writeBody(res, await this.fetchKey(key, req));
    } catch (err) {
      if (errorDocument && (err instanceof S3NotFound || err instanceof S3Forbidden)) {
        await this.serveErrorDocument(req, res, errorDocument, err.statusCode);
        return;
      }
      this.renderError(res, err);
    }
  }

  private async serveErrorDocument(
    req: HttpRequest,
    res: HttpResponse,
    errorDocument: string,
    status: number
  ): Promise<void> {
    // Fetch the error document without the original Range header — a range
    // against the error page would produce a 206 that contradicts the 4xx
    // status we're about to write.
    const errReq: HttpRequest = { ...req, headers: { ...req.headers } };
    delete errReq.headers.range;
    try {
      // Serve the error document's body under the original 4xx status.
      const response = await this.fetchKey(errorDocument, errReq);
      await this.writeBody(res, { ...response, status });
    } catch {
      // The error document itself is missing/unreadable — don't loop,
      // fall back to a bare status response.
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
      res.end();
    }
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
  HttpResponse,
  ParsedRequest,
  RequestHandler,
  S3Error,
  S3FetchResponse,
  S3ProxyConfig,
  StaticSiteOptions,
} from './types.js';
export { UserException };
export default S3Proxy;
