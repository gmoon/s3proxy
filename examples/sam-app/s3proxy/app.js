const awsServerlessExpress = require('aws-serverless-express');
const express = require('express');
const S3Proxy = require('s3proxy');
const app = express();
const proxy = new S3Proxy({ bucket: 's3proxy-public' });
proxy.init();

app.route('/*').get(proxyToS3);

function proxyToS3(req, res) {
  proxy.get(req,res).on('error', () => res.end()).pipe(res);
}

const server = awsServerlessExpress.createServer(app, null, ['image/jpeg']);
//exports.lambdaHandler = proxy.lambdaHandler;
exports.lambdaHandler = (event, context) => { awsServerlessExpress.proxy(server, event, context); };
exports.close = () => { server.close(); };
