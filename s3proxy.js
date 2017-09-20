/* jslint node: true, esversion: 6 */

const EventEmitter = require('events');
const AWS = require('aws-sdk');
const stream = require('stream');

class HttpHeaderExtendedStream extends stream.Readable {

}

class UserException {
  constructor(code, message) {
    this.code = code;
    this.message = message;
  }
}

module.exports = class s3proxy extends EventEmitter {
  init(p) {
    const params = p || {};
    params.apiVersion = '2006-03-01';
    this.credentials = new AWS.SharedIniFileCredentials();
    AWS.config.credentials = this.credentials;
    this.s3 = new AWS.S3(params);
    this.emit('init');
  }
  createReadStream(bucket, key) {
    this.isInitialized();
    const params = { Bucket: bucket, Key: key };
    const s3request = this.s3.getObject(params);
    const s3stream = s3request.createReadStream();
    s3request.on('httpHeaders', (statusCode, headers) => {
      s3stream.emit('httpHeaders', statusCode, headers);
    });
    return s3stream;
  }
  isInitialized() {
    if (!this.s3) {
      throw new UserException('UninitializedError', 'S3Proxy is uninitialized (call s3proxy.init)');
    }
  }
};
