/* eslint-disable import/no-extraneous-dependencies, no-console */

/*
  S3Proxy Express Framework Example

  Passes HTTP GET requests to s3proxy
  Start: PORT=3000 node express
  Test: mocha test.js

  Author: George Moon <george.moon@gmail.com>
*/

const express = require('express');
const debug = require('debug')('s3proxy');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const addRequestId = require('express-request-id')({ headerName: 'x-request-id' });
const S3Proxy = require('..');

const port = process.env.PORT;
const app = express();
app.set('view engine', 'pug');
app.use(addRequestId);
app.use(bodyParser.json());

function handleError(req, res, err) {
  // sending xml because the AWS SDK sets content-type: application/xml for non-200 responses
  res.end(`<?xml version="1.0"?>\n<error time="${err.time}" code="${err.code}" statusCode="${err.statusCode}" url="${req.url}" method="${req.method}">${err.message}</error>
  `);
}

// Use morgan for request logging except during test execution
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(
    'request :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] '
    + '":referrer" ":user-agent" ":response-time ms" :res[x-request-id] :res[x-amz-request-id]',
  ));
}

// initialize the s3proxy
const bucketName = 's3proxy-public';
const proxy = new S3Proxy({ bucket: bucketName });
proxy.init();
proxy.on('error', (err) => {
  console.log(`error initializing s3proxy for bucket ${bucketName}: ${err.name} ${err.message}`);
});

// health check api, suitable for integration with ELB health checking
app.route('/health')
  .get(async (req, res) => {
    (await proxy.healthCheckStream(res)).on('error', () => {
      // just end the request and let the HTTP status code convey the error
      res.end();
    }).pipe(res);
  });

// redirect requests to root
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// route all get requests to s3proxy
app.route('/*')
  .head(async (req, res) => {
    (await proxy.head(req, res)).on('error', (err) => {
      handleError(req, res, err);
    }).pipe(res);
  })
  .get(async (req, res) => {
    (await proxy.get(req, res)).on('error', (err) => {
      handleError(req, res, err);
    }).pipe(res);
  });

if (port > 0) {
  app.listen(port, () => {
    debug(`s3proxy listening on port ${port}`);
  });
}

module.exports = app;
