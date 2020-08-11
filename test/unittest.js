import test from 'ava';
import nock from 'nock';
import sinon from 'sinon';
import chai from 'chai';
import chaiHttp from 'chai-http';
import express from 'express';
import S3Proxy from '..';

chai.use(chaiHttp);
let app;
let proxy;
let scope;
let server;

test.beforeEach.cb(t => {
  scope = nock('https://s3proxy-public.s3.amazonaws.com:443')
    .head('/')
    .reply(200);
  proxy = new S3Proxy({ bucket: 's3proxy-public' });
  app = express();
  app.get('/*', (req, res) => {
    proxy.get(req, res).pipe(res);
  });
  server = chai.request(app);
  proxy.init(t.end);
});
// nock.disableNetConnect();
// nock.recorder.rec();

test.cb('s3proxy', (t) => {
  t.plan(1);
  scope
    .get(/index.html/)
    .reply(500, 'Internal Server Errors', ['foo', 'bat']);
  scope
    .get(/index.html/)
    .reply(200, 'hello-world', ['foo', 'bar']);
  server.get('/index.html').end((err, res)=>{
    console.log(res);
    t.is(res.status, 200);
    scope.done();
    setTimeout(t.end, 2000);
    // t.end();
  });
});
