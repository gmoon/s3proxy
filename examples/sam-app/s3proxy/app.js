const awsServerlessExpress = require('aws-serverless-express');
const express = require('express');
const S3Proxy = require('s3proxy');

const app = express();
const proxy = new S3Proxy({ bucket: 's3proxy-public' });
proxy.init();

function handleError(req, res, err) {
  // sending xml because the AWS SDK sets content-type: application/xml for non-200 responses
  res.end(`<?xml version="1.0"?>\n<error time="${err.time}" code="${err.code}" statusCode="${err.statusCode}" url="${req.url}" method="${req.method}">${err.message}</error>
  `);
}

app.route('/*').get(async (req, res) => {
  (await proxy.get(req, res)).on('error', (err) => {
    handleError(req, res, err);
  }).pipe(res);
});

const server = awsServerlessExpress.createServer(app, null, ['image/jpeg']);
exports.lambdaHandler = (event, context) => {
  awsServerlessExpress.proxy(server, event, context);
};
exports.close = () => { server.close(); };
