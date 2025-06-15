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
export interface ExpressRequest extends IncomingMessage {
    path?: string;
    query?: Record<string, string | string[]>;
    headers: Record<string, string | string[]>;
    url: string;
    method?: string;
}
export interface ExpressResponse extends ServerResponse {
    writeHead(statusCode: number, headers?: any): this;
}
export interface S3ProxyEvents {
    init: () => void;
    error: (error: Error) => void;
}
export type S3ProxyOptions = Omit<S3ProxyConfig, 'bucket'>;
export type HeaderMap = Record<string, string | string[]>;
export type S3Params = {
    Bucket: string;
    Key: string;
    Range?: string;
};
//# sourceMappingURL=types.d.ts.map