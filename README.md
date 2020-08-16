# s3proxy
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
![Node CI][actions-image]

Use AWS S3 as the storage backend for a nodejs web server.

## Features
* Designed to be embedded into your nodejs application
* Provides stream interface; stream files, even very large files, quickly and with a low memory footprint
* HTTP GET requests are translated to S3 GetObject calls
* HTTP HEAD requests are translated to S3 HeadObject calls
* Transparently handles retries against the AWS S3 backend
* AWS S3 headers are provided as the HTTP response headers, including content-type and content-length
* Easily integrated with common nodejs web frameworks; examples include http and express apps.
* HealthCheck API verifies bucket connectivity and authentication, suitable for ELB health checks or monitoring services

## Benefits

### Private web endpoint

AWS S3 provides native web hosting, but it lacks fine-grained security controls. By hosting your own web
server, you can use all of the AWS features including Security Groups, Route53, and network
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
1. Edit examples/express-basic.js, replace `s3proxy-public` with your S3 bucket name
1. Install dependencies `npm install`
1. Start the server
`PORT=3000 node express-basic`
1. Test it out (change index.html to the name of a file that exists in your bucket)
`curl http://localhost:3000/index.html`

## New Project
```
mkdir website
cd website
npm init
npm install --save express express-request-id morgan s3proxy
curl -O https://raw.githubusercontent.com/gmoon/s3proxy/master/examples/express-s3proxy.js
PORT=3000 node express-s3proxy
```
## Credentials
s3proxy needs read access (s3:GetObject) on your bucket, and uses the [AWS javascript sdk](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/welcome.html). You can provide credentials using any method supported:

https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html

The [Environment Variables](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html) option is easy to get started, just make sure the variables are defined before you start the node process.

Alternatively, you can specify the profile to use on command line:
`AWS_PROFILE=foo PORT=3000 node examples/express-basic.js`

One way to test is to verify that your aws cli works from command line (substitute your bucket name):

`aws s3 ls s3://s3proxy-public/`

## Permissions
Here is the minimal set of permissions needed to run s3proxy (replace s3proxy-public with your bucket name):
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "s3proxyAccess",
            "Effect": "Allow",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::s3proxy-public/*"
        }
    ]
}
```

## Performance and Reliability
Performance is highly dependent on the types of files served and the infrastructure. See the [Load Testing](#load-testing) section for some data on different scenarios.

Reliability can be achieved by fronting the web server with a Load Balancer. Each instance of s3proxy will utilize retries, which are configurable through the [Global Configuration Object](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/global-config-object.html)

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
### Load testing
Artillery can be used to send load to your endpoint. You can view the scenarios we use [here](test/artillery.yml).

If you run this, please make sure to run it against your bucket.
#### AWS EC2 Instance
Below are the results from a run on a t2.micro Amazon Linux 2 instance. Steps to run the load test:
```
# Install git and node
sudo yum install git
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install node

# Clone the s3proxy repo
git clone https://github.com/gmoon/s3proxy.git

# Run the test
cd s3proxy
PORT=3000 node examples/express-basic.js
```
Response time p95 is less than 100ms and median response time is 31ms. This includes 37 requests for a 10M binary (labled as Scenario 1 below).
```
All virtual users finished
Summary report @ 03:01:24(+0000) 2020-08-16
  Scenarios launched:  200
  Scenarios completed: 200
  Requests completed:  200
  Mean response/sec: 19.25
  Response time (msec):
    min: 13.1
    max: 207.5
    median: 31.9
    p95: 93.2
    p99: 147.8
  Scenario counts:
    0: 45 (22.5%)
    1: 37 (18.5%)
    2: 40 (20%)
    3: 43 (21.5%)
    4: 35 (17.5%)
  Codes:
    200: 125
    403: 40
    404: 35
```
#### Development Laptop
Below are the results from a run on a MacBook Pro with home internet (fast.com measured 61Mbps download and 5.0Mbps upload). It shows ~20 responses per second, the p95 response time was just over 400ms, and the median response time was 220ms. This includes serving a 10MB binary file 43 times (labeled Scenario 1 below).
```
All virtual users finished
Summary report @ 22:22:14(-0400) 2020-08-15
  Scenarios launched:  200
  Scenarios completed: 200
  Requests completed:  200
  Mean response/sec: 19.19
  Response time (msec):
    min: 120
    max: 608.8
    median: 220.8
    p95: 436.8
    p99: 574.9
  Scenario counts:
    0: 43 (21.5%)
    1: 43 (21.5%)
    2: 42 (21%)
    3: 33 (16.5%)
    4: 39 (19.5%)
  Codes:
    200: 119
    403: 42
    404: 39
```
To execute the tests:
1. start your local web server on port 3000
1. run artillery
```
npm run artillery
```
### Run GitHub Actions locally
Note: This is currently not working, as this stage fails:
[Node CI/build-2]   ❌  Failure - Configure AWS Credentials
```
brew install nektos/tap/act
act
```
### Update dependencies, fix security vulnerabilities in dependencies
```
# see the status
npm outdated

# install npm-check-updates
npm install --global npm-check-updates

# update all dependencies
ncu --update

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
