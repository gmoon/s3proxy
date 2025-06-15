import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { parse as parseUrl } from 'node:url';
import { GetObjectCommand, HeadBucketCommand, HeadObjectCommand, NoSuchBucket, NoSuchKey, S3Client, S3ServiceException, } from '@aws-sdk/client-s3';
import { UserException } from './UserException.js';
// Import version from generated file
import { VERSION } from './version.js';
export class S3Proxy extends EventEmitter {
    bucket;
    options;
    s3;
    constructor(config) {
        super();
        if (!config) {
            throw new UserException('InvalidParameterList', 'constructor parameters are required');
        }
        if (!config.bucket) {
            throw new UserException('InvalidParameterList', 'bucket parameter is required');
        }
        this.bucket = config.bucket;
        this.options = Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'bucket'));
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
    static mapHeaderToParam(req, headerKey, paramKey) {
        if (req.headers?.[headerKey]) {
            const headerValue = req.headers[headerKey];
            const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
            if (typeof value === 'string') {
                return { [paramKey]: value };
            }
        }
        return {};
    }
    static version() {
        return VERSION;
    }
    /**
     * Test the Error object to see if it should be treated as non-fatal
     */
    static isNonFatalError(e) {
        return (e instanceof NoSuchKey ||
            e instanceof NoSuchBucket ||
            (e instanceof S3ServiceException && e.name === 'AccessDenied'));
    }
    /**
     * From s3proxy object and http request, return S3 Params
     *   - Bucket: (required) name of bucket, taken from s3proxy object
     *   - Key: (required) name of key to stream
     *   - Range: (optional) byte range to return
     */
    getS3Params(req) {
        const r = S3Proxy.parseRequest(req);
        const params = {
            Bucket: this.bucket,
            Key: r.key,
            ...S3Proxy.mapHeaderToParam(req, 'range', 'Range'),
        };
        return params;
    }
    isInitialized() {
        if (!this.s3) {
            const error = new UserException('UninitializedError', 'S3Proxy is uninitialized (call s3proxy.init)');
            throw error;
        }
    }
    /**
     * Return key and query from request object, since Express and HTTP
     * modules have different req objects.
     * key is req.path if defined, or pathname from url.parse object
     * key also has any leading slash stripped
     * query is req.query, or query from url.parse object
     */
    static parseRequest(req) {
        const obj = {
            key: '',
            query: {},
        };
        // Express objects have path, HTTP objects do not
        if (typeof req.path === 'undefined') {
            const parsedUrl = parseUrl(req.url, true);
            // Filter out undefined values from query
            const query = parsedUrl.query || {};
            obj.query = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));
            obj.key = decodeURIComponent(parsedUrl.pathname || '');
        }
        else {
            obj.query = req.query || {};
            obj.key = decodeURIComponent(req.path);
        }
        obj.key = S3Proxy.stripLeadingSlash(obj.key);
        return obj;
    }
    static stripLeadingSlash(str) {
        return str.replace(/^\/+/, '');
    }
    static createEmptyReadstream() {
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
    async send(command) {
        this.isInitialized();
        let headers = {};
        let statusCode = 200;
        let s3stream;
        // Add middleware to capture response metadata
        command.middlewareStack.add((next) => async (args) => {
            const result = await next(args);
            headers = result.response.headers || {};
            statusCode = result.response.statusCode || 200;
            return result;
        }, 
        // priority: low is important here, otherwise middleware is never
        // executed for non-2xx responses. Not sure why
        // Link: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
        { step: 'deserialize', priority: 'low' });
        try {
            const item = await this.s3?.send(command);
            s3stream = S3Proxy.getReadstream(item.Body);
        }
        catch (e) {
            if (S3Proxy.isNonFatalError(e)) {
                s3stream = S3Proxy.createEmptyReadstream();
            }
            else {
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
    static getReadstream(body) {
        if (body === undefined) {
            return S3Proxy.createEmptyReadstream();
        }
        if (body instanceof Readable) {
            return body;
        }
        throw new Error('unrecognized type');
    }
    async getObject(req) {
        const params = this.getS3Params(req);
        const command = new GetObjectCommand(params);
        return this.send(command);
    }
    async headObject(req) {
        const params = this.getS3Params(req);
        const command = new HeadObjectCommand(params);
        return this.send(command);
    }
    async headBucket() {
        const command = new HeadBucketCommand({ Bucket: this.bucket });
        return this.send(command);
    }
    /*
    =========================================================================================
  
      Public Methods
  
    =========================================================================================
    */
    async init() {
        try {
            this.s3 = new S3Client(this.options);
            await this.healthCheck();
            this.emit('init');
        }
        catch (e) {
            this.emit('error', e);
            throw e;
        }
    }
    async healthCheck() {
        const command = new HeadBucketCommand({ Bucket: this.bucket });
        await this.s3?.send(command);
    }
    async healthCheckStream(res) {
        const { s3stream, statusCode, headers } = await this.headBucket();
        res.writeHead(statusCode, headers);
        return s3stream;
    }
    async head(req, res) {
        const { s3stream, statusCode, headers } = await this.headObject(req);
        res.writeHead(statusCode, headers);
        return s3stream;
    }
    async get(req, res) {
        const { s3stream, statusCode, headers } = await this.getObject(req);
        res.writeHead(statusCode, headers);
        return s3stream;
    }
}
export { UserException };
export default S3Proxy;
//# sourceMappingURL=index.js.map