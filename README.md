# s3proxy
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]

Use AWS S3 as the storage backend for a web server.

## Features
* Provides stream interface; stream files, even very large files, quickly and with a low memory footprint
* HTTP GET requests are translated to S3 GetObject calls
* AWS S3 headers are provided as the HTTP response headers, including content-type and content-length
* Easily integrated with common nodejs web frameworks; examples include http and express apps.
* HealthCheck API verifies bucket connectivity and authentication, suitable for ELB health checks or monitoring services

## Benefits

### Private web endpoint

AWS S3 provides native web hosting, but it lacks fine grained security controls. By hosting your own web 
server, you can use all of the AWS features including Security Groups, Route53, and networks 
access control lists to control access to your resources

### Dynamic content

AWS S3 web hosting only serves static content. By using S3 as the backend, you can stream files
through your favorite templating engine for dynamic content on the fly.

## Use Cases

### Private artifact repo

A build process pushes RPM artifacts and metadata to a S3 bucket. The linux hosts need to use `yum` to install packages from this repo.

Rather than running [yum-s3](https://github.com/jbraeuer/yum-s3-plugin) and supplying credentials to each host, we use s3proxy to expose
the files via HTTP like `yum` expects. The additional benefit is that only one piece of our infrastructure has a dependency on S3, although
we do now have to keep the web server available (but we are pretty good at doing that anyway).

## Quick Start
1. Get the express script
`curl -O https://github.com/gmoon/s3proxy/blob/master/express.js`
1. Replace `my-bucket` with the correct S3 bucket name
1. Start the server
`PORT=3000 node express`
1. Aternately, start it with pm2:
`PORT=3000 pm2 start express.js`
1. Test it out (change index.html to the name of a file that exists in your bucket)
`curl http://localhost:3000/index.html`

## Installation
* `npm install s3proxy --save`

## Express Example
```
/*
  S3Proxy Express Framework Example

  Passes HTTP GET requests to s3proxy
  Start: PORT=3000 node express
*/

const express = require('express');
const S3Proxy = require('s3proxy');

const port = process.env.PORT;
const app = express();
const proxy = new S3Proxy({ bucket: 'my-bucket' });
proxy.init();

app.route('/health')
  .get((req, res) => {
    proxy.healthCheckStream(res).pipe(res);
  });
app.route('/*')
  .get((req, res) => {
    proxy.get(req,res).pipe(res);
  });

if (port > 0) {
  app.listen(port);
}

module.exports = app;
```

### HTTP Example
```
const S3Proxy = require('s3proxy');
const http = require('http');

const port = process.env.PORT;
const proxy = new S3Proxy({ bucket: 'my-bucket' });
proxy.init();

const server = http.createServer((req, res) => {
  proxy.get(req,res).pipe(res);
});

if (port > 0) {
  server.listen(port);
}

module.exports = server;
```
[npm-image]: https://img.shields.io/npm/v/s3proxy.svg
[npm-url]: https://npmjs.org/package/s3proxy
[downloads-image]: https://img.shields.io/npm/dm/s3proxy.svg
[downloads-url]: https://npmjs.org/package/s3proxy

