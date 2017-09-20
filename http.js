const S3Proxy = require('./s3proxy');
const http = require('http');

const proxy = new S3Proxy({ bucket: 'codeassist-repo' });
proxy.init();

http.createServer((req, res) => {
  const stream = proxy.createReadStream(req.url);
  stream.on('httpHeaders', (statusCode, headers) => {
    res.writeHead(statusCode, headers);
  });
  stream.pipe(res);
}).listen(3000);

process.stdout.write('Example app listening on port 3000\n');
