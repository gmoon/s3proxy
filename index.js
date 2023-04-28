const EventEmitter = require('events');
const { Readable } = require('stream');
const {
  S3Client, GetObjectCommand, HeadBucketCommand, HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const url = require('url');
const UserException = require('./UserException');
const s3proxyVersion = require('./package.json').version;

module.exports = class s3proxy extends EventEmitter {
  constructor(p) {
    super();
    if (!p) {
      throw new UserException('InvalidParameterList', 'constructor parameters are required');
    }
    if (!p.bucket) {
      throw new UserException('InvalidParameterList', 'bucket parameter is required');
    }
    this.bucket = p.bucket;
    this.options = Object.getOwnPropertyNames(p)
      .filter((name) => name !== 'bucket')
      .reduce((obj, name) => {
        const withName = {};
        withName[name] = p[name];
        return { ...obj, ...withName };
      }, {});
  }

  async init() {
    try {
      this.s3 = new S3Client({ ...this.options });
      await this.healthCheck();
      this.emit('init');
    } catch (e) {
      this.emit('error', e);
      throw e;
    }
    // this.healthCheck((error, data) => {
    //   if (error) {
    //     if (typeof (done) !== typeof (Function)) this.emit('error', error, data);
    //   } else this.emit('init', data);
    //   if (typeof (done) === typeof (Function)) done(error, data);
    // });
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
    From s3proxy object and http request, return S3 Params
      - Bucket: (required) name of bucket, taken from s3proxy object
      - Key: (required) name of key to stream
      - Range: (optional) byte range to return
  */
  getS3Params(req) {
    const r = s3proxy.parseRequest(req);
    const params = {
      ...{ Bucket: this.bucket, Key: r.key },
      ...s3proxy.mapHeaderToParam(req, 'range', 'Range'),
    };
    return params;
  }

  async createReadStream(req) {
    this.isInitialized();
    const params = this.getS3Params(req);
    const command = new GetObjectCommand(params);
    let headers; let statusCode; let
      s3stream;
    command.middlewareStack.add(
      (next) => async (args) => {
        const result = await next(args);
        headers = result.response.headers;
        statusCode = result.response.statusCode;
        return result;
      },
      // priority: low is important here, otherwise middleware is never
      // executed for non-2xxx responses. Not sure why
      // Link: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
      { step: 'deserialize', priority: 'low' },
    );
    try {
      const item = await this.s3.send(command);
      if (item.Body === undefined) {
        s3stream = new Readable();
        s3stream.push(null);
      } else {
        s3stream = Readable.from(item.Body);
      }
    } catch (e) {
      s3stream = new Readable();
      s3stream.push(null);
    }
    return { s3stream, statusCode, headers };
  }

  isInitialized() {
    if (!this.s3) {
      const error = new UserException('UninitializedError', 'S3Proxy is uninitialized (call s3proxy.init)');
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
    const obj = {};
    // Express objects have path, HTTP objects do not
    if (typeof req.path === 'undefined') {
      const parsedUrl = url.parse(req.url, true);
      obj.query = parsedUrl.query;
      obj.key = decodeURIComponent(parsedUrl.pathname);
    } else {
      if (typeof req.query === 'undefined') {
        obj.query = {};
      } else {
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

  async healthCheck() {
    const command = new HeadBucketCommand({ Bucket: this.bucket });
    await this.s3.send(command);
  }

  async healthCheckStream(res) {
    this.isInitialized();
    const command = new HeadBucketCommand({ Bucket: this.bucket });
    let headers; let statusCode; let
      s3stream;
    command.middlewareStack.add(
      (next) => async (args) => {
        const result = await next(args);
        headers = result.response.headers;
        statusCode = result.response.statusCode;
        return result;
      },
      // priority: low is important here, otherwise middleware is never
      // executed for non-2xxx responses. Not sure why
      // Link: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
      { step: 'deserialize', priority: 'low' },
    );
    try {
      const item = await this.s3.send(command);
      s3stream = (item.Body === undefined) ? new Readable() : item.Body;
    } catch (e) {
      s3stream = new Readable();
    }
    res.writeHead(statusCode, headers);
    return s3stream;
  }

  async head(req, res) {
    this.isInitialized();
    const params = this.getS3Params(req);
    const command = new HeadObjectCommand(params);
    let headers = []; let statusCode = '000'; let
      s3stream;
    command.middlewareStack.add(
      (next) => async (args) => {
        const result = await next(args);
        headers = result.response.headers;
        statusCode = result.response.statusCode;
        return result;
      },
      // priority: low is important here, otherwise middleware is never
      // executed for non-2xxx responses. Not sure why
      // Link: https://aws.amazon.com/blogs/developer/middleware-stack-modular-aws-sdk-js/
      { step: 'deserialize', priority: 'low' },
    );
    try {
      const item = await this.s3.send(command);
      if (item.Body === undefined) {
        s3stream = new Readable();
        s3stream.push(null);
      } else {
        s3stream = Readable.from(item.Body);
      }
    } catch (e) {
      s3stream = new Readable();
      s3stream.push(null);
    }
    // const s3request = this.s3.getObject(params);
    // const s3stream = s3request.createReadStream();
    res.writeHead(statusCode, headers);
    return s3stream;
  }

  async get(req, res) {
    const { s3stream, statusCode, headers } = await this.createReadStream(req);
    res.writeHead(statusCode, headers);
    return s3stream;
  }
};
