const S3Proxy = require('./s3proxy');
const http = require('http');

const proxy = new S3Proxy();
proxy.init();

http.createServer((req, res) => {
  // console.log(`${req.method} ${req.url}`);
  proxy.createReadStream('codeassist-repo', 'index.html').pipe(res);
}).listen(3000);

process.stdout.write('Example app listening on port 3000\n');
