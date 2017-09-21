const S3Proxy = require('s3proxy');
const http = require('http');
const argv = require('minimist')(process.argv.slice(2));

const proxy = new S3Proxy({ bucket: 'codeassist-repo' });
proxy.init();

const server = http.createServer((req, res) => {
  const stream = proxy.createReadStream(req.url);
  stream.on('httpHeaders', (statusCode, headers) => {
    res.writeHead(statusCode, headers);
  });
  stream.pipe(res);
});

if (argv.port > 0) {
  server.listen(argv.port);
}

module.exports = server;

