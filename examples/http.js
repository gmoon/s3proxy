const http = require('http');
const S3Proxy = require('..');

const port = process.env.PORT;
const proxy = new S3Proxy({ bucket: 's3proxy-public' });
proxy.init();

const server = http.createServer((req, res) => {
  proxy.get(req, res).pipe(res);
});

if (port > 0) {
  server.listen(port);
}

module.exports = server;
