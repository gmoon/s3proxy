/*
  S3Proxy Express Framework Example

  Passes HTTP GET requests to s3proxy
  Start: node express --port=3000
  Test: mocha test.js

  Author: George Moon <george.moon@gmail.com>
*/

const express = require('express');
const S3Proxy = require('s3proxy');

const port = process.env.PORT;
const app = express();
const proxy = new S3Proxy({ bucket: 'codeassist-repo' });
proxy.init();

app.route('/*')
  .get((req, res) => {
    const stream = proxy.createReadStream(req.url);
    stream.on('httpHeaders', (statusCode, headers) => {
      res.writeHead(statusCode, headers);
    });
    stream.pipe(res);
  });

if (port > 0) {
  app.listen(port);
}

module.exports = app;
