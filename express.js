const express = require('express');
const S3Proxy = require('s3proxy');
const argv = require('minimist')(process.argv.slice(2));

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

if (argv.port > 0) {
  app.listen(3000);
}

module.exports = app;
