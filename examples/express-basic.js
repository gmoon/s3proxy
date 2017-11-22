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
const fs = require('fs');

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
  .get((req, res, next) => {
    proxy.get(req, res).on('error', (err) => {
      handleError(req, res, err);
    }).pipe(res);
  });

if (port > 0) {
  app.listen(port, () => {
    debug(`s3proxy listening on port ${port}`);
  });
}

function handleError(req, res, err) {
  // sending xml because the AWS SDK sets content-type: application/xml for non-200 responses
  res.end(`<?xml version="1.0"?>
    <error time="${err.time}" code="${err.code}" statusCode="${err.statusCode}" url="${req.url}" method="${req.method}">${err.message}</error>
  `);
}

module.exports = app;
