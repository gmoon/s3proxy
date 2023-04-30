const http = require('http');
const S3Proxy = require('..');

const port = process.env.PORT;
const proxy = new S3Proxy({ bucket: 's3proxy-public' });
proxy.init();

const server = http.createServer(async (req, res) => {
  (await proxy.get(req, res)).on('error', () => {
    // just end the request and let the HTTP status code convey the error
    res.end();
  }).pipe(res);
});

if (port > 0) {
  server.listen(port);
}

module.exports = server;
