# s3proxy
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
![Node CI][actions-image]

Use AWS S3 as the storage backend for a nodejs web server.

## Features
* Designed to be embedded into your nodejs application
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
1. Clone this repo, `cd s3proxy`
1. Edit express.js, replace `s3proxy-public` with your S3 bucket name
1. Install dependencies `npm install`
1. Start the server
`PORT=3000 node express`
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
const proxy = new S3Proxy({ bucket: 's3proxy-public' });
proxy.init();

app.route('/health')
  .get((req, res) => {
    proxy.healthCheckStream(res).pipe(res);
  });

// Make sure to add an error handler (as shown below), otherwise your server will crash if the stream
// encounters an error (which occurs, for instance, when the requested object doesn't
// exist).
app.route('/*')
  .get((req, res) => {
    proxy.get(req,res)
      .on('error', () => res.end())
      .pipe(res);
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
const proxy = new S3Proxy({ bucket: 's3proxy-public' });
proxy.init();

// Make sure to add an error handler (as shown below), otherwise your server will crash if the stream
// encounters an error (which occurs, for instance, when the requested object doesn't
// exist).
const server = http.createServer((req, res) => {
  proxy.get(req,res)
    .on('error', () => res.end())
    .pipe(res);
});

if (port > 0) {
  server.listen(port);
}

module.exports = server;
```
## Configuring the AWS.S3 Object

The AWS.S3 object accepts options as defined [here](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property). These options can be passed through via the S3Proxy constructor.

```
const configuredProxy = new S3Proxy({
  bucket: 's3proxy-public',
  httpOptions: { connectTimeout: 1 },
  logger: console
});
```

[npm-image]: https://img.shields.io/npm/v/s3proxy.svg
[npm-url]: https://npmjs.org/package/s3proxy
[downloads-image]: https://img.shields.io/npm/dm/s3proxy.svg
[downloads-url]: https://npmjs.org/package/s3proxy
[actions-image]: https://github.com/gmoon/s3proxy/workflows/Node%20CI/badge.svg


## init method

S3Proxy is a subclass of EventEmitter. That means you can register event listeners on the async calls.
```
proxy.on('init', () => {
  app.listen();
});
proxy.on('error', (error) => {
  console.error(error);
});
proxy.init();
```

`init` also accepts a callback function:
```
proxy.init((error) => {
  if (error) {
    console.error(error);
  }
  else {
    app.listen();
  }
});
```

## Development
### Test execution
The current test suite consists of some unit tests, but most of the tests are functional tests that require AWS S3 access.
It uses a public bucket called s3proxy-public.

```
# Run the test suite
make test

# Run it faster: execute steps in parallel
make -j test
```
### Update dependencies, fix security vulnerabilities in dependencies
```
# see the status
npm outdated
npm a

# install npm-check-updates
npm install --global npm-check-updates

# update all dependencies
ncu -a

# run audit
npm audit

# address audit issues
npm audit fix
```
### Setup AWS Credentials for Github Actions
```
./setupaws.sh
```
Add secrets to GitHub Secrets in the repo, per https://github.com/aws-actions/configure-aws-credentials
