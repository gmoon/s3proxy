/* eslint-env mocha, node, es6 */

const chai = require('chai');
const S3Proxy = require('.');

const { expect } = chai;

describe('s3proxy', () => {
  describe('constructor', () => {
    it('should return an object', () => {
      const proxy = new S3Proxy({ bucket: 's3proxy-public' });
      expect(proxy).to.be.an('object');
    });
  });
  describe('initialization', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });
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
  describe('healthCheck', () => {
    it('should pass for valid bucket', (done) => {
      const proxy = new S3Proxy({ bucket: 's3proxy-public' });
      proxy.init((error) => {
        expect(error).to.equal(null);
        proxy.healthCheck((checkError) => {
          done(checkError);
        });
      });
    });
  });
  describe('invalid bucket', () => {
    let proxy;
    beforeEach(() => {
      proxy = new S3Proxy({ bucket: '.Bucket.name.cannot.start.with.a.period' });
    });
    it('should return NotFound error via callback', (done) => {
      proxy.init((error) => {
        expect(error.code).to.equal('NotFound');
        done();
      });
    });
    it('should return NotFound error via event emitter', (done) => {
      proxy.on('error', (error) => {
        expect(error.code).to.equal('NotFound');
        done();
      });
      proxy.init();
    });
  });
  describe('createReadStream error codes', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });
    before((done) => {
      proxy.init(done);
    });
    it('should return error code NoSuchKey for nonexistent key', (done) => {
      const stream = proxy.createReadStream('small.txt');
      stream.on('error', (error) => {
        expect(error.code).to.equal('NoSuchKey');
        done();
      });
    });
  });
  describe('createReadStream', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });
    const page = {};
    before((done) => {
      proxy.init();
      const stream = proxy.createReadStream('index.html');
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
    it('should have length of 338', () => {
      expect(page.length).to.equal(338);
    });
  });
});
