/* jslint node: true, esversion: 6 */

const EventEmitter = require('events');
const AWS = require('aws-sdk');

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
    this.awsAddCredentials();
    this.healthCheck((error, data) => {
      if (error) {
        if (typeof (done) !== typeof (Function)) this.emit('error', error, data);
      } else this.emit('init', data);
      if (typeof (done) === typeof (Function)) done(error, data);
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
  awsAddCredentials() {
    this.credentials = new AWS.SharedIniFileCredentials();
    AWS.config.credentials = this.credentials;
    this.s3 = new AWS.S3({ apiVersion: '2006-03-01' });
  }
  healthCheck(done) {
    this.s3.headBucket({ Bucket: this.bucket }, (error, data) => {
      done(error, data);
    });
  }
};
