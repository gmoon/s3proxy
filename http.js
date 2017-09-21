const S3Proxy = require('s3proxy');
const http = require('http');

const proxy = new S3Proxy({ bucket: 'codeassist-repo' });
proxy.init();

const server = http.createServer((req, res) => {
  const stream = proxy.createReadStream(req.url);
  stream.on('httpHeaders', (statusCode, headers) => {
    res.writeHead(statusCode, headers);
  });
  stream.pipe(res);
});

module.exports = server;

