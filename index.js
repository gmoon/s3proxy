const EventEmitter = require('events');
const AWS = require('aws-sdk');
const url = require('url');
const UserException = require('./UserException');
const HeaderHandler = require('./HeaderHandler');

// AWS.config.logger = console;

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

  init(done) {
    this.s3 = new AWS.S3({ apiVersion: '2006-03-01', ...this.options });
    this.healthCheck((error, data) => {
      if (error) {
        if (typeof (done) !== typeof (Function)) this.emit('error', error, data);
      } else this.emit('init', data);
      if (typeof (done) === typeof (Function)) done(error, data);
    });
  }

  createReadStream(req) {
    this.isInitialized();
    const r = s3proxy.parseRequest(req);
    const params = { Bucket: this.bucket, Key: r.key };
    const s3request = this.s3.getObject(params);
    const s3stream = s3request.createReadStream();
    return { s3request, s3stream };
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

  healthCheck(done) {
    const s3request = this.s3.headBucket({ Bucket: this.bucket }, (error, data) => {
      done(error, data);
    });
    return s3request;
  }

  healthCheckStream(res) {
    const s3request = this.s3.headBucket({ Bucket: this.bucket });
    const s3stream = s3request.createReadStream();
    s3request.on('httpHeaders', (statusCode, headers) => {
      res.writeHead(statusCode, headers);
      s3stream.emit('httpHeaders', statusCode, headers);
    });
    return s3stream;
  }

  async head(req, res) {
    this.isInitialized();
    const r = s3proxy.parseRequest(req);
    const params = { Bucket: this.bucket, Key: r.key };
    const s3request = this.s3.headObject(params);
    const promise = s3request.promise()
      .catch(() => { res.end(); });
    const stubStream = new EventEmitter();
    const header = new HeaderHandler();
    header.attach(s3request, stubStream, res);
    return promise;
  }

  get(req, res) {
    const { s3request, s3stream } = this.createReadStream(req);
    const header = new HeaderHandler();
    header.attach(s3request, s3stream, res);
    return s3stream;
  }
};
