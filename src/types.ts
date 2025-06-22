import type { IncomingMessage, ServerResponse } from 'node:http';
import type { S3ClientConfig } from '@aws-sdk/client-s3';

export interface S3ProxyConfig extends S3ClientConfig {
  bucket: string;
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
  // Use any to avoid complex type conflicts
  writeHead(statusCode: number, headers?: any): this;
}

export interface S3ProxyEvents {
  init: () => void;
  error: (error: Error) => void;
}

// Utility types for better type safety
export type S3ProxyOptions = Omit<S3ProxyConfig, 'bucket'>;
export type HeaderMap = Record<string, string | string[]>;
export type S3Params = {
  Bucket: string;
  Key: string;
  Range?: string;
};
