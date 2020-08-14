/* eslint-env mocha, node, es6 */

const chai = require('chai');
const http = require('chai-http');
const nock = require('nock');
const express = require('express');
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
});
