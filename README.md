# s3proxy
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node CI][actions-image]][actions-url]
[![Docker Pulls][dockerpulls-image]][dockerpulls-url]

Use AWS S3 as the storage backend for a nodejs web server.

## Usage
``` bash
docker run --env BUCKET=mybucket --env PORT=8080 --publish 8080:8080 -t forkzero/s3proxy:1.5.1
curl http://localhost:8080/index.html  # serves s3://mybucket/index.html
```
If you need to pass temporary AWS credentials to your docker container (for local development, for example), generate the temporary credentials with the `aws cli`, store it in a file called `credentials.json`, and then mount that file into your container at `/src/credentials.json`. *Note:* this capability is disabled if `NODE_ENV=prod` or `NODE_ENV=production`.
``` bash
aws sts get-session-token --duration 900 > credentials.json
docker run \
  -v $PWD/credentials.json:/src/credentials.json:ro \
  -e BUCKET=mybucket \
  -e PORT=8080 \
  -p 8080:8080 \
  -t forkzero/s3proxy:1.5.1
curl http://localhost:8080/index.html  # serves s3://mybucket/index.html
```
Run it locally without docker:
``` bash
npm install s3proxy express body-parser morgan express-request-id helmet
PORT=8080 BUCKET=mybucket node ./examples/express-s3proxy
curl http://localhost:8080/index.html  # serves s3://mybucket/index.html
```

## Features
* Designed to be embedded into your nodejs application
* Provides stream interface; stream files, even very large files, quickly and with a low memory footprint
* HTTP GET requests are translated to S3 GetObject calls
* HTTP HEAD requests are translated to S3 HeadObject calls
* Transparently handles retries against the AWS S3 backend
* AWS S3 headers are provided as the HTTP response headers, including content-type and content-length
* Easily integrated with common nodejs web frameworks; examples include http and express apps.
* HealthCheck API verifies bucket connectivity and authentication, suitable for ELB health checks or monitoring services

## Deployment Examples

* Docker image source is [here](examples/docker/) and a public image is available on [DockerHub](https://hub.docker.com/repository/docker/forkzero/s3proxy)
* Popular nodejs web frameworks [express](examples/express-s3proxy.js) and [http](examples/http.js)
* [AWS Elastic Container Service](examples/aws-ecs/) CloudFormation stack
* [AWS Serverless Application Model (SAM)](/examples/sam-app/)

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
the files via HTTP like `yum` expects. The additional benefit is that only one piece of our infrastructure has a dependency on S3.

## Quick Start

1. Clone this repo, `cd s3proxy`
1. Edit examples/express-basic.js, replace `s3proxy-public` with your S3 bucket name
1. Install dependencies `npm install`
1. Start the server
`PORT=8080 node express-basic`
1. Test it out (change index.html to the name of a file that exists in your bucket)
`curl http://localhost:3000/index.html`

## New Project
```
mkdir website
cd website
npm init
npm install --save express express-request-id morgan s3proxy
curl -O https://raw.githubusercontent.com/gmoon/s3proxy/master/examples/express-s3proxy.js
DEBUG=s3proxy PORT=8080 BUCKET=mybucket node express-s3proxy
```

## Credentials
s3proxy needs read access (s3:GetObject) on your bucket, and uses the [AWS javascript sdk](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/welcome.html). You can provide credentials using any method supported:

https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html

The [Environment Variables](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-environment.html) option is easy to get started, just make sure the variables are defined before you start the node process.

Alternatively, you can specify the profile to use on command line:

`AWS_PROFILE=foo PORT=8080 node examples/express-basic.js`

One way to test is to verify that your aws cli works from command line (substitute your bucket name):

`aws s3 ls s3://s3proxy-public/`

## Permissions
Here is the minimal set of permissions needed to run s3proxy (replace mybucket with your bucket name):
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "s3proxyAccess",
            "Effect": "Allow",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::mybucket/*"
        }
    ]
}
```

## Special Characters in Object Names
As of version 1.5, the request URL is decoded prior to passing the key name to the S3 GetObject method. This has unit and integration test coverage and is tested against the special
characters specified [here](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-keys.html) across all three categories: 
 * Safe characters
 * Characters that might require special handling
 * Characters to avoid

### Testing from command-line:
start your server:
```
PORT=3000 node examples/express-basic.js
```
curl the url-encoded object:
```
# object name: specialCharacters!-_.*'()&$@=;:+  ,?\{^}%`]">[~<#|.
# url-encoded object name: specialCharacters!-_.*'()%26%24%40%3D%3B%3A%2B%20%20%2C%3F%5C%7B%5E%7D%25%60%5D%22%3E%5B~%3C%23%7C.
# bash-safe and url-encoded object name: specialCharacters\!-_.*'()%26%24%40%3D%3B%3A%2B%20%20%2C%3F%5C%7B%5E%7D%25%60%5D%22%3E%5B~%3C%23%7C.
curl -v "http://localhost:3000/specialCharacters\!-_.*'()%26%24%40%3D%3B%3A%2B%20%20%2C%3F%5C%7B%5E%7D%25%60%5D%22%3E%5B~%3C%23%7C."
```

## Performance and Reliability
Performance is highly dependent on the types of files served and the infrastructure. See the [Load Testing](#load-testing) section for some data on different scenarios.

A tip to increase performance is to configure the aws-sdk to [reuse TCP connections](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-reusing-connections.html). In Load Testing, setting the `AWS_NODEJS_CONNECTION_REUSE_ENABLED=1` environment variable reduced median response times by nearly 50% over a 60-second period.

When running s3proxy on an EC2 instance and comparing the artillery run (running on the same instance) against the AWS public S3 website, the response times for s3proxy were about 50% lower. This at least means s3proxy is not adding a lot of overhead over the AWS public S3 website.

Reliability can be achieved by fronting the web server with a Load Balancer. Each instance of s3proxy will utilize retries, which are enabled by the aws-sdk by default and can be further configured via the [AWS SDK Global Configuration Object](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/global-config-object.html)

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
  .head(async (req, res) => {
    await proxy.head(req, res);
    res.end();
  })
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
[actions-url]: https://github.com/gmoon/s3proxy/actions?query=workflow%3A%22Node+CI%22
[dockerpulls-image]: https://img.shields.io/docker/pulls/forkzero/s3proxy?style=flat-square
[dockerpulls-url]: https://hub.docker.com/repository/docker/forkzero/s3proxy


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
npm install
AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 PORT=3000 node examples/express-basic.js

# In a different console
cd s3proxy
npm run artillery
```
Response time p95 is less than 35ms and median response time is 12.3ms.
```
All virtual users finished
Summary report @ 01:36:53(+0000) 2020-08-17
  Scenarios launched:  1200
  Scenarios completed: 1200
  Requests completed:  1200
  Mean response/sec: 19.87
  Response time (msec):
    min: 8.1
    max: 275.9
    median: 12.3
    p95: 34.4
    p99: 62.9
  Scenario counts:
    0: 245 (20.417%)
    1: 225 (18.75%)
    2: 220 (18.333%)
    3: 260 (21.667%)
    4: 250 (20.833%)
  Codes:
    200: 730
    403: 220
    404: 250
```
#### Development Laptop
Below are the results from a run on a MacBook Pro with home internet (fast.com measured 61Mbps download and 5.0Mbps upload). It shows ~20 responses per second, the p95 response time was just under 250ms, and the median response time was 44.7ms.
```
All virtual users finished
Summary report @ 21:46:11(-0400) 2020-08-16
  Scenarios launched:  1200
  Scenarios completed: 1200
  Requests completed:  1200
  Mean response/sec: 19.86
  Response time (msec):
    min: 22.8
    max: 918.4
    median: 44.7
    p95: 246.3
    p99: 339.6
  Scenario counts:
    0: 248 (20.667%)
    1: 212 (17.667%)
    2: 256 (21.333%)
    3: 266 (22.167%)
    4: 218 (18.167%)
  Codes:
    200: 726
    403: 256
    404: 218
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
ncu --upgrade

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

### Release npm module
 1. git clone https://github.com/gmoon/s3proxy.git
 1. npm version minor
 1. npm test
 1. npm run package
 1. npm run artillery-docker
 1. npm publish
 1. git push
 1. create GitHub Release
