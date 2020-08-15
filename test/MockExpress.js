/* eslint-env mocha, node, es6 */

const chai = require('chai');
const http = require('chai-http');
const nock = require('nock');
const express = require('express');
const Benchmark = require('benchmark');
const S3Proxy = require('..');

chai.use(http);
const { expect } = chai;
// nock.recorder.rec();

describe('MockExpress', () => {
  let proxy; let server; let scope;
  after(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
  beforeEach((done) => {
    nock.cleanAll();
    nock.disableNetConnect();
    nock.enableNetConnect(/127.0.0.1/);
    // can add , { allowUnmocked: true }
    scope = nock('https://s3proxy-public.s3.amazonaws.com:443')
      .head('/')
      .reply(200);
    proxy = new S3Proxy({ bucket: 's3proxy-public' });
    proxy.init(() => {
      const app = express();
      app.head('/*', async (req, res) => {
        await proxy.head(req, res);
        res.end();
      });
      app.get('/*', (req, res) => {
        proxy.get(req, res).pipe(res);
      });
      server = chai.request(app);
      done();
    });
  });
  it('should get header(s) from getObject call', (done) => {
    scope
      .get('/index.html')
      .reply(200, 'OK', ['x-y-z', '999']);
    server.get('/index.html').end((err, res) => {
      expect(err).to.be.equal(null);
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('x-y-z');
      done();
    });
  });
  it('should succeed via retry if first call to aws-sdk fails', (done) => {
    scope
      .get('/index.html')
      .reply(500, 'Internal Server Error', ['x-y-z', '999']);
    scope
      .get('/index.html')
      .reply(200, '<html></html>', ['x-y-z', '999']);
    server.get('/index.html').end((err, res) => {
      expect(err).to.be.equal(null);
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('x-y-z');
      done();
    });
  });
  it('should send headers for zero byte file', (done) => {
    scope
      .get('/zerobytefile')
      .reply(200, '', ['x-y-z', '999']);
    server.get('/zerobytefile').end((err, res) => {
      expect(err).to.be.equal(null);
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('x-y-z');
      expect(res.text.length).to.be.equal(0);
      done();
    });
  });
  it('head method should return headers for valid object', (done) => {
    scope
      .head('/large.bin')
      .reply(200);
    server.head('/large.bin').end((err, res) => {
      expect(err).to.be.equal(null);
      expect(res.statusCode).to.equal(200);
      done();
    });
  });
  describe.skip('Benchmark', () => {
    it('get method rate should exeed 500 calls per second', async () => {
      scope
        .get('/index.html')
        .times(1000)
        .reply(200, '<html></html>');
      let count = 0;
      const Promises = [];
      const start = Date.now();
      while (count < 500) {
        count += 1;
        Promises.push(server.get('/index.html'));
      }
      return Promise.all(Promises).then(() => {
        const end = Date.now();
        const duration = end - start;
        const ratePerSecond = count / (duration / 1000);
        console.log(`      duration: ${duration}ms, rate: ${ratePerSecond} calls per second`);
        expect(ratePerSecond).to.be.greaterThan(500);
      });
    });
    it('head method rate should exeed 500 calls per second', async () => {
      scope
        .head('/index.html')
        .times(1000)
        .reply(200, '');
      let count = 0;
      const Promises = [];
      const start = Date.now();
      while (count < 500) {
        count += 1;
        Promises.push(server.head('/index.html'));
      }
      return Promise.all(Promises).then(() => {
        const end = Date.now();
        const duration = end - start;
        const ratePerSecond = count / (duration / 1000);
        console.log(`      duration: ${duration}ms, rate: ${ratePerSecond} calls per second`);
        expect(ratePerSecond).to.be.greaterThan(500);
      });
    });
  });
});
