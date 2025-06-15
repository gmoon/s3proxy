import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { UserException } from './UserException.js';
import type { ExpressRequest, ExpressResponse, ParsedRequest, S3ProxyConfig } from './types.js';
export declare class S3Proxy extends EventEmitter {
    private readonly bucket;
    private readonly options;
    private s3?;
    constructor(config: S3ProxyConfig);
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
    static mapHeaderToParam(req: ExpressRequest, headerKey: string, paramKey: string): Record<string, string> | Record<string, never>;
    static version(): string;
    /**
     * Test the Error object to see if it should be treated as non-fatal
     */
    static isNonFatalError(e: unknown): boolean;
    /**
     * From s3proxy object and http request, return S3 Params
     *   - Bucket: (required) name of bucket, taken from s3proxy object
     *   - Key: (required) name of key to stream
     *   - Range: (optional) byte range to return
     */
    private getS3Params;
    isInitialized(): void;
    /**
     * Return key and query from request object, since Express and HTTP
     * modules have different req objects.
     * key is req.path if defined, or pathname from url.parse object
     * key also has any leading slash stripped
     * query is req.query, or query from url.parse object
     */
    static parseRequest(req: ExpressRequest): ParsedRequest;
    static stripLeadingSlash(str: string): string;
    static createEmptyReadstream(): Readable;
    /**
     * 1. Send provided command through the s3 client
     * 2. Use middleware to capture
     *   2a. item.Body as Readable s3stream (empty if item.Body is missing)
     *   2b. req.headers as headers
     *   2c. req.statusCode as statusCode
     * 3. return { s3stream, statusCode, headers }
     */
    private send;
    /**
     * Get a Readstream from Body.
     * Type definition is:
     *   Body?: SdkStream<undefined | Readable | Blob | ReadableStream<any>>
     *
     * We don't need to consider the ReadableStream or Blob type as those don't exist
     * on node, only browser.
     */
    static getReadstream(body: any): Readable;
    private getObject;
    private headObject;
    private headBucket;
    init(): Promise<void>;
    healthCheck(): Promise<void>;
    healthCheckStream(res: ExpressResponse): Promise<Readable>;
    head(req: ExpressRequest, res: ExpressResponse): Promise<Readable>;
    get(req: ExpressRequest, res: ExpressResponse): Promise<Readable>;
}
export { UserException };
export default S3Proxy;
//# sourceMappingURL=index.d.ts.map