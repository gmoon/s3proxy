/*
  S3Proxy Express Framework Example

  Passes HTTP GET requests to s3proxy
  Start: PORT=3000 node express
  Test: mocha test.js

  Author: George Moon <george.moon@gmail.com>
*/

const express = require('express');
const S3Proxy = require('../');
const debug = require('debug')('s3proxy');
const bodyParser = require('body-parser');

const port = process.env.PORT;
const app = express();
app.set('view engine', 'pug');
app.use(bodyParser.json());

const proxy = new S3Proxy({ bucket: 's3proxy-public' });
proxy.init();

app.route('/health')
  .get((req, res) => {
    proxy.healthCheckStream(res).pipe(res);
  });
app.route('/*')
  .get((req, res) => {
    proxy.get(req, res).pipe(res);
  });

if (port > 0) {
  app.listen(port, () => {
    debug(`s3proxy listening on port ${port}`);
  });
}

module.exports = app;
