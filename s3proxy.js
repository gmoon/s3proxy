/* jslint node: true, esversion: 6 */

const EventEmitter = require('events');
const AWS = require('aws-sdk');

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
    const params = { Bucket: bucket, Key: key };
    const s3request = this.s3.getObject(params);
    const s3stream = s3request.createReadStream();
    s3request.on('httpHeaders', (statusCode, headers) => {
      s3stream.emit('httpHeaders', statusCode, headers);
    });
    return s3stream;
  }
};
