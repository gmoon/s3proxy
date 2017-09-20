/* eslint-env mocha, node, es6 */

const chai = require('chai');
const S3Proxy = require('./s3proxy.js');

const { expect } = chai;

describe('s3proxy', () => {
  describe('constructor', () => {
    it('should be an object', () => {
      const proxy = new S3Proxy();
      expect(proxy).to.be.an('object');
    });
  });
  describe('initialization', () => {
    const proxy = new S3Proxy();
    it('should throw an exception if it is not initialized', (done) => {
      try {
        proxy.isInitialized();
      } catch (e) {
        expect(e.code).to.equal('UninitializedError');
        done();
      }
    });
    it("should emit an 'init' event", (done) => {
      proxy.on('init', () => {
        done();
      });
      proxy.init();
    });
  });
  describe('createReadStream error codes', () => {
    const proxy = new S3Proxy();
    before(() => {
      proxy.init();
    });
    it('should return error code NoSuchBucket for nonexistent bucket', (done) => {
      const stream = proxy.createReadStream('.Bucket.name.cannot.start.with.a.period', 'xxxx');
      stream.on('error', (error) => {
        expect(error.code).to.equal('NoSuchBucket');
        done();
      });
    });
    it('should return error code NoSuchKey for nonexistent key', (done) => {
      const stream = proxy.createReadStream('codeassist-repo', 'small.txt');
      stream.on('error', (error) => {
        expect(error.code).to.equal('NoSuchKey');
        done();
      });
    });
  });
  describe('createReadStream', () => {
    const proxy = new S3Proxy();
    const page = {};
    before((done) => {
      proxy.init();
      const stream = proxy.createReadStream('codeassist-repo', 'index.html');
      page.length = 0;
      stream.on('data', (chunk) => {
        page.length += chunk.length;
      });
      stream.on('httpHeaders', (statusCode, headers) => {
        page.headers = headers;
        page.statusCode = statusCode;
      });
      stream.on('end', () => {
        done();
      });
    });
    it('should have headers', () => {
      expect(page.headers).to.have.keys(['accept-ranges', 'content-length', 'content-type', 'date', 'etag', 'last-modified', 'server', 'x-amz-id-2', 'x-amz-request-id']);
    });
    it('should have length of 58', () => {
      expect(page.length).to.equal(58);
    });
  });
});
