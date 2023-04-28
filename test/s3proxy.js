/* eslint-env mocha, node, es6 */

const chai = require('chai');
const S3Proxy = require('..');

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
    it('should throw an exception if it is not initialized', () => {
      expect(() => { proxy.isInitialized() }).to.throw('S3Proxy is uninitialized');
    });
    it("should emit an 'init' event", (done) => {
      proxy.on('init', () => {
        done();
      });
      proxy.init();
    });

    it('should pass the provided options through to the AWS.S3 constructor', async () => {
      const configuredProxy = new S3Proxy({
        bucket: 's3proxy-public',
        httpOptions: { connectTimeout: 1 },
      });
      await configuredProxy.init();
      expect(configuredProxy.s3.config.httpOptions.connectTimeout).to.equal(1);
    });
  });
  describe('healthCheck', () => {
    it('should pass for valid bucket', async () => {
      const proxy = new S3Proxy({ bucket: 's3proxy-public' });
      expect( async () => await proxy.init() ).to.not.throw();
    });
  });
  describe('invalid bucket', () => {
    let proxy;
    beforeEach(() => {
      proxy = new S3Proxy({ bucket: '.Bucket.name.cannot.start.with.a.period' });
    });
    it('should return NotFound error via callback', async () => {
      try {
        const result = await proxy.init()
      } catch (e) {
        expect(e.name).to.equal('NotFound');
      }
    });
    it('should return NotFound error via event emitter', async () => {
      proxy.on('error', (error) => {
        expect(error.code).to.equal('NotFound');
      });
      proxy.init();
    });
  });
  describe('createReadStream error codes', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });
    before( async () => {
      await proxy.init();
    });
    it('should return error code NoSuchKey for nonexistent key', async () => {
      const { s3stream, statusCode, headers } = await proxy.createReadStream({ url: 'small.txt' });
      expect(statusCode).to.equal(404);
    });
  });
  describe('createReadStream', () => {
    const proxy = new S3Proxy({ bucket: 's3proxy-public' });
    let length, page;
    before( async () => {
      await proxy.init();
      page = await proxy.createReadStream({ url: 'index.html' });
      const chunks = [];
      for await (const chunk of page.s3stream) {
        chunks.push(Buffer.from(chunk));
      }
      length = Buffer.concat(chunks).toString("utf-8").length;
    });
    it('should have headers', () => {
      expect(page.headers).to.have.keys(['accept-ranges', 'content-length', 'content-type', 'date', 'etag', 'last-modified', 'server', 'x-amz-id-2', 'x-amz-request-id']);
    });
    it('should have length of 338', () => {
      expect(length).to.equal(338);
    });
  });
});
