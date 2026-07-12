import type { S3ClientConfig } from '@aws-sdk/client-s3';

export interface S3ProxyConfig extends S3ClientConfig {
  bucket: string;
  /**
   * If true (default), `init()` calls `healthCheck()` against the bucket
   * and rejects if it fails — fail-fast on misconfiguration.
   * Set to false in orchestrator deployments (Kubernetes, ECS) where the
   * platform's own readiness probe should determine health, so a missing
   * bucket doesn't crashloop the pod before logs/dashboards are wired up.
   */
  verifyOnInit?: boolean;
}

export interface ParsedRequest {
  key: string;
  query: Record<string, string | string[]>;
}

/**
 * Options for `proxy.staticSite()` — replicates S3 static website hosting
 * semantics as an opt-in layer on top of the pure `fetch()` primitive.
 * The core `fetch()` never applies these; they live entirely in the
 * middleware.
 */
export interface StaticSiteOptions {
  /**
   * Key served when the request path is the root or ends in `/`.
   * `/` → `index.html`, `/blog/` → `blog/index.html`. Defaults to
   * `'index.html'`; set to `''` to disable index resolution.
   */
  indexDocument?: string;
  /**
   * Key served (with the original 4xx status) when the requested object
   * is missing or forbidden — the S3 "custom error document" feature,
   * e.g. `'404.html'`. When unset, 404/403 render a plaintext status.
   */
  errorDocument?: string;
}

/**
 * Public response shape returned by `proxy.fetch()`. Pure — caller is
 * responsible for writing headers and piping the stream.
 */
export interface S3FetchResponse {
  stream: NodeJS.ReadableStream;
  status: number;
  headers: Record<string, string>;
}

/**
 * Structural subset of an HTTP request that proxy.fetch() reads.
 * Express's Request, Fastify's request.raw, and Node's IncomingMessage
 * all satisfy it (with light casts where method is broader-typed). Kept
 * minimal so request objects from any framework can be passed without
 * subclassing IncomingMessage or implementing its full surface.
 */
export interface HttpRequest {
  url: string;
  method?: string;
  headers: Record<string, string | string[]>;
  path?: string;
  query?: Record<string, string | string[]>;
}

/**
 * Structural subset of an HTTP response that the optional convenience
 * adapter (`proxy.pipe()` / `proxy.middleware()`) writes to. Node's
 * ServerResponse, Express's Response, and Fastify's reply.raw all satisfy
 * it. The pure `proxy.fetch()` primitive never touches a response — this
 * type only exists for callers who opt into the write-it-for-me path.
 */
export interface HttpResponse extends NodeJS.WritableStream {
  writeHead(statusCode: number, headers?: Record<string, string>): unknown;
  readonly headersSent?: boolean;
}

/**
 * Express/Connect-style handler returned by `proxy.middleware()` and
 * `proxy.staticSite()`. When `next` is supplied, an unexpected
 * (non-classified) error is forwarded to the framework's error handler.
 */
export type RequestHandler = (
  req: HttpRequest,
  res: HttpResponse,
  next?: (err?: unknown) => void
) => void;

// Error interface for S3 operations
export interface S3Error extends Error {
  statusCode?: number;
  code?: string;
}

export interface S3ProxyEvents {
  init: () => void;
  error: (error: Error) => void;
}

// Utility types for better type safety
export type S3ProxyOptions = Omit<S3ProxyConfig, 'bucket' | 'verifyOnInit'>;
export type HeaderMap = Record<string, string | string[]>;
export type S3Params = {
  Bucket: string;
  Key: string;
  Range?: string;
};
