import awsServerlessExpress from 'aws-serverless-express';
import express from 'express';
import { S3Proxy } from 's3proxy';

const app = express();
const proxy = new S3Proxy({ bucket: 's3proxy-public' });

// Initialize proxy - we'll await this in the Lambda handler
const proxyInitPromise = proxy.init();

function handleError(req, res, err) {
  // sending xml because the AWS SDK sets content-type: application/xml for non-200 responses
  res.end(`<?xml version="1.0"?>\n<error time="${err.time}" code="${err.code}" statusCode="${err.statusCode}" url="${req.url}" method="${req.method}">${err.message}</error>`);
}

app.route('/*').get(async (req, res) => {
  try {
    // Ensure proxy is initialized before handling requests
    await proxyInitPromise;
    
    const stream = await proxy.get(req, res);
    stream.on('error', (err) => {
      handleError(req, res, err);
    }).pipe(res);
  } catch (err) {
    handleError(req, res, err);
  }
});

const server = awsServerlessExpress.createServer(app, null, ['image/jpeg']);

export const lambdaHandler = async (event, context) => {
  // Ensure proxy is initialized before handling any requests
  await proxyInitPromise;
  return awsServerlessExpress.proxy(server, event, context);
};

export const close = () => {
  server.close();
};
