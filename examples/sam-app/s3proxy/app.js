const awsServerlessExpress = require('aws-serverless-express');
const express = require('express');
const S3Proxy = require('s3proxy');

const app = express();
const proxy = new S3Proxy({ bucket: 's3proxy-public' });
proxy.init();

function proxyToS3(req, res) {
  proxy.get(req, res).on('error', () => res.end()).pipe(res);
}

app.route('/*').get(proxyToS3);

const server = awsServerlessExpress.createServer(app, null, ['image/jpeg']);
exports.lambdaHandler = (event, context) => {
  awsServerlessExpress.proxy(server, event, context);
};
exports.close = () => { server.close(); };
