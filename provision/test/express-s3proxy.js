/* eslint-disable import/no-extraneous-dependencies, no-console, import/no-unresolved */

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
const S3Proxy = require('s3proxy');

const port = process.env.PORT;
const app = express();
app.set('view engine', 'pug');
app.use(addRequestId);
app.use(bodyParser.json());

debug(`port is ${port}`);
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

if (port > 0) {
  app.listen(port, () => {
    debug(`s3proxy listening on port ${port}`);
  });
}

module.exports = app;
