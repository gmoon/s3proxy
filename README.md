# s3proxy
Use AWS S3 as the storage backend for a web server.

## Features
* Provides stream interface; stream files, even very large files, quickly and with a low memory footprint
* HTTP GET requests are translated to S3 GetObject calls
* AWS S3 headers are provided as the HTTP response headers, including content-type and content-length
* Easily integrated with common nodejs web frameworks; examples include http and express apps.

## Benefits

### Private web endpoint

AWS S3 provides native web hosting, but it lacks fine grained security controls. By hosting your own web 
server, you can use all of the AWS features including Security Groups, Route53, and networks 
access control lists to control access to your resources

### Dynamic content

AWS S3 web hosting only serves static content. By using S3 as the backend, you can stream files
through your favorite templating engine for dynamic content on the fly.

## Quick Start
1. Get the express script
`curl -O https://github.com/gmoon/s3proxy/blob/master/express.js`
1. Replace `my-bucket` with the correct S3 bucket name
1. Start the server
`node express --port=3000`
1. Aternately, start it with pm2:
`pm2 start express.js -- --port=3000`
1. Test it out (change index.html to the name of a file that exists in your bucket)
`curl http://localhost:3000/index.html`

## Installation
* `npm install s3proxy --save`

## Express Example
```
/*
  S3Proxy Express Framework Example

  Passes HTTP GET requests to s3proxy
  Start: node express --port=3000
*/

const express = require('express');
const S3Proxy = require('s3proxy');
const argv = require('minimist')(process.argv.slice(2));

const app = express();
const proxy = new S3Proxy({ bucket: 'my-bucket' });
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
```

### HTTP Example
```
const S3Proxy = require('s3proxy');
const http = require('http');
const argv = require('minimist')(process.argv.slice(2));

const proxy = new S3Proxy({ bucket: 'my-bucket' });
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
```

