/* jslint node: true, esversion: 6 */

const EventEmitter = require('events');
const AWS = require('aws-sdk');
const url = require('url');
const { PassThrough } = require('stream');

class UserException extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

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
      .filter(name => name !== 'bucket')
      .reduce((obj, name) => {
        const withName = {};
        withName[name] = p[name];
        return Object.assign({}, obj, withName);
      }, {});
  }

  init(done) {
    this.s3 = new AWS.S3(Object.assign({ apiVersion: '2006-03-01' }, this.options));
    this.healthCheck((error, data) => {
      if (error) {
        if (typeof (done) !== typeof (Function)) this.emit('error', error, data);
      } else this.emit('init', data);
      if (typeof (done) === typeof (Function)) done(error, data);
    });
  }

  createReadStream(req) {
    let s3stream;
    this.isInitialized();
    const r = s3proxy.parseRequest(req);
    if (typeof r.query.expression !== 'undefined') {
      console.log('select request');
      s3stream = this.createSelectObjectContentStream(r);
    } else {
      s3stream = this.createGetObjectStream(r);
    }
    return s3stream;
  }

  createSelectObjectContentStream(r, existingStream) {
    const s3stream = (typeof existingStream === 'undefined') ? new PassThrough() : existingStream;
    s3stream.on('foo', (data) => { console.log(data); });
    const params = {
      Bucket: this.bucket,
      Key: r.key,
      Expression: r.query.expression,
      ExpressionType: 'SQL',
      InputSerialization: {
        JSON: {
          Type: 'DOCUMENT',
        },
      },
      OutputSerialization: {
        JSON: {},
      },
    };
    const s3request = this.s3.selectObjectContent(params);
    s3request.on('httpHeaders', (statusCode, headers) => {
      s3stream.emit('httpHeaders', statusCode, headers);
    });
    s3request.send((err, data) => {
      if (err) {
        throw err;
      } else {
        data.Payload.on('data', (event) => {
          if (event.Records) {
            s3stream.write(event.Records.Payload);
          } else if (event.Stats) {
            console.log(`stats: ${JSON.stringify(event)}`);
          } else if (event.Progress) {
            console.log(`progress: ${JSON.stringify(event)}`);
          } else if (event.Cont) {
            console.log(`cont: ${JSON.stringify(event)}`);
          } else if (event.End) {
            s3stream.emit('end');
          }
        });
        data.Payload.on('error', (error) => { throw error; });
      }
    });
    return s3stream;
  }

  createGetObjectStream(r) {
    const params = { Bucket: this.bucket, Key: r.key };
    const s3request = this.s3.getObject(params);
    const s3stream = s3request.createReadStream();
    s3request.on('httpHeaders', (statusCode, headers) => {
      s3stream.emit('httpHeaders', statusCode, headers);
    });
    return s3stream;
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
      obj.key = parsedUrl.pathname;
    } else {
      obj.query = req.query;
      obj.key = req.path;
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

  head(req, res) {
    const stream = this.createReadStream(req);
    stream.addHeaderEventListener(res);
    return stream;
  }

  get(req, res) {
    const stream = this.createReadStream(req);
    stream.on('httpHeaders', (statusCode, headers) => {
      res.writeHead(statusCode, headers);
    });
    return stream;
  }
};
