/* jslint node: true, esversion: 6 */

const EventEmitter = require('events');
const AWS = require('aws-sdk');
const stream = require('stream');

class HttpHeaderExtendedStream extends stream.Readable {

}

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
  }
  init(done) {
    const params = {};
    params.apiVersion = '2006-03-01';
    this.credentials = new AWS.SharedIniFileCredentials();
    AWS.config.credentials = this.credentials;
    this.s3 = new AWS.S3(params);
    this.s3.headBucket({ Bucket: this.bucket }, (error, data) => {
      if (error) {
        if (error.code === 'NotFound' && error.message === null) {
          error.message = `AWS S3 Bucket [${this.bucket}] Not Found`;
        }
        if (typeof done === 'undefined') {
          this.emit('error', error);
        }
      } else {
        this.emit('init', data);
      }
      if (typeof done === 'function') { done(error, data); }
    });
  }
  createReadStream(key) {
    this.isInitialized();
    const params = { Bucket: this.bucket, Key: s3proxy.stripLeadingSlash(key) };
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
  static stripLeadingSlash(str) {
    return str.replace(/^\/+/, '');
  }
};
