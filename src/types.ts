import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
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

export interface S3ProxyResponse {
  s3stream: NodeJS.ReadableStream;
  statusCode: number;
  headers: Record<string, string>;
}

export interface HttpRequest extends IncomingMessage {
  path?: string;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[]>;
  url: string;
  method?: string;
}

export interface HttpResponse extends ServerResponse {
  // We need to be compatible with Node.js ServerResponse writeHead overloads
  writeHead(statusCode: number, headers?: OutgoingHttpHeaders): this;
  writeHead(statusCode: number, statusMessage?: string, headers?: OutgoingHttpHeaders): this;
}

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
