"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const stream_1 = require("stream");
const client_s3_1 = require("@aws-sdk/client-s3");
const url_1 = __importDefault(require("url"));
const UserException_1 = __importDefault(require("./UserException"));
const s3proxyVersion = require('../package.json').version;
module.exports = class s3proxy extends events_1.default {
    constructor(p) {
        super();
        if (!p) {
            throw new UserException_1.default('InvalidParameterList', 'constructor parameters are required');
        }
        if (!p.bucket) {
            throw new UserException_1.default('InvalidParameterList', 'bucket parameter is required');
        }
        this.bucket = p.bucket;
        this.options = Object.getOwnPropertyNames(p)
            .filter((name) => name !== 'bucket')
            .reduce((obj, name) => {
            const withName = {};
            withName[name] = p[name];
            return Object.assign(Object.assign({}, obj), withName);
        }, {});
    }
    /*
      If headerKey is present in the http headers, then return an object whose
      key is paramKey and whose value is the value of headerKey in the http
      header.
  
      If headerKey is not present in the http headers, then return an empty
      object: {}
  
      This return value is designed to be merged to the S3 params via the
      spread operator (...)
      */
    static mapHeaderToParam(req, headerKey, paramKey) {
        let retval = {};
        if (typeof req.headers !== 'undefined') {
            if (typeof req.headers[headerKey] !== 'undefined') {
                retval = { [paramKey]: req.headers[headerKey] };
            }
        }
        return retval;
    }
    static version() {
        return s3proxyVersion;
    }
    /*
      Test the Error object to see if it should be treated as non-fatal
    */
    static isNonFatalError(e) {
        return (e instanceof client_s3_1.NoSuchKey)
            || (e instanceof client_s3_1.NoSuchBucket)
            || ((e instanceof client_s3_1.S3ServiceException) && (e.name === 'AccessDenied'));
    }
    /*
      From s3proxy object and http request, return S3 Params
        - Bucket: (required) name of bucket, taken from s3proxy object
        - Key: (required) name of key to stream
        - Range: (optional) byte range to return
    */
    getS3Params(req) {
        const r = s3proxy.parseRequest(req);
        const params = Object.assign({ Bucket: this.bucket, Key: r.key }, s3proxy.mapHeaderToParam(req, 'range', 'Range'));
        return params;
    }
    isInitialized() {
        if (!this.s3) {
            const error = new UserException_1.default('UninitializedError', 'S3Proxy is uninitialized (call s3proxy.init)');
            throw error;
        }
    }
    /*
      Return key and query from request object, since Express and HTTP
      modules have different req objects.
      key is req.path if defined, or pathname from url.parse object
      key also has any leading slash stripped
      query is req.query, or query from url.parse object
    */
    static parseRequest(req) {
        console.log("req = ", req.constructor.name);
        // Express objects have path, HTTP objects do not
        if (typeof req.path === 'undefined') {
            const parsedUrl = url_1.default.parse(req.url, true);
            obj.query = parsedUrl.query;
            obj.key = decodeURIComponent(parsedUrl.pathname);
        }
        else {
            if (typeof req.query === 'undefined') {
                obj.query = {};
            }
            else {
                obj.query = req.query;
            }
            obj.key = decodeURIComponent(req.path);
        }
        obj.key = s3proxy.stripLeadingSlash(obj.key);
        return obj;
    }
    static stripLeadingSlash(str) {
        return str.replace(/^\/+/, '');
    }
    static createEmptyReadstream() {
        const stream = new stream_1.Readable();
        stream.push(null);
        return stream;
    }
    /*
      1. Send provided command through the s3 client
      2. Use middleware to capture
        2a. item.Body as Readable s3stream (empty if item.Body is missing)
        2b. req.headers as headers
        2c. req.statusCode as statusCode
      3. return { s3stream, statusCode, headers }
    */
    send(command) {
        return __awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            let headers;
            let statusCode = 200;
            let s3stream;
            command.middlewareStack.add((next) => (args) => __awaiter(this, void 0, void 0, function* () {
                const result = yield next(args);
                headers = result.response.headers;
                statusCode = result.response.statusCode;
                return result;
            }), 
            // priority: low is important here, otherwise middleware is never
            // executed for non-2xx responses. Not sure why
            // Link: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
            { step: 'deserialize', priority: 'low' });
            try {
                const item = yield this.s3.send(command);
                s3stream = s3proxy.getReadstream(item.Body);
            }
            catch (e) {
                if (s3proxy.isNonFatalError(e)) {
                    s3stream = s3proxy.createEmptyReadstream();
                }
                else {
                    throw (e);
                }
            }
            return { s3stream, statusCode, headers };
        });
    }
    /*
      Get a Readstream from Body.
      Type definition is:
        Body?: SdkStream<undefined | Readable | Blob | ReadableStream<any>>
  
        We don't need to consider the ReadableStream or Blob type as those don't exist
      on node, only browser.
    */
    static getReadstream(body) {
        let stream;
        if (body === undefined) {
            stream = s3proxy.createEmptyReadstream();
        }
        else if (body instanceof stream_1.Readable) {
            stream = body;
        }
        else {
            throw new Error('unrecognized type');
        }
        return stream;
    }
    getObject(req) {
        const params = this.getS3Params(req);
        const command = new client_s3_1.GetObjectCommand(params);
        return this.send(command);
    }
    headObject(req) {
        const params = this.getS3Params(req);
        const command = new client_s3_1.HeadObjectCommand(params);
        return this.send(command);
    }
    headBucket() {
        const command = new client_s3_1.HeadBucketCommand({ Bucket: this.bucket });
        return this.send(command);
    }
    /*
    =========================================================================================
  
      Public Methods
  
    =========================================================================================
    */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.s3 = new client_s3_1.S3Client(Object.assign({}, this.options));
                yield this.healthCheck();
                this.emit('init');
            }
            catch (e) {
                this.emit('error', e);
                throw e;
            }
        });
    }
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            const command = new client_s3_1.HeadBucketCommand({ Bucket: this.bucket });
            yield this.s3.send(command);
        });
    }
    healthCheckStream(res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { s3stream, statusCode, headers } = yield this.headBucket();
            res.writeHead(statusCode, headers);
            return s3stream;
        });
    }
    head(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { s3stream, statusCode, headers } = yield this.headObject(req);
            res.writeHead(statusCode, headers);
            return s3stream;
        });
    }
    get(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { s3stream, statusCode, headers } = yield this.getObject(req);
            res.writeHead(statusCode, headers);
            return s3stream;
        });
    }
};
