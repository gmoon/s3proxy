import fs from 'node:fs';
import express from 'express';
import { S3Proxy } from 's3proxy';

const app = express();
const bucket = process.env.BUCKET || 'your-bucket-name';
const port = process.env.PORT || 3000;

// In non-production environments, if a credentials file exists, return the credentials
// To create a temporary credentials file:
//     aws sts get-session-token --duration 900 > credentials.json
//
function getCredentials() {
  // Try Docker path first, then local path
  const dockerFile = '/src/credentials.json';
  const localFile = './credentials.json';
  const file = fs.existsSync(dockerFile) ? dockerFile : localFile;
  let contents;
  try {
    const credentials = JSON.parse(fs.readFileSync(file, 'utf8')).Credentials;
    if (process.env.NODE_ENV?.match(/^prod/i)) {
      throw new Error('will not use a credentials file in production');
    }
    contents = {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    };
    console.log(`using credentials from ${file}`);
  } catch (_e) {
    console.log('using sdk credential chain');
  }
  return contents;
}

// Initialize the s3proxy with credentials
const credentials = getCredentials();
const proxy = new S3Proxy({ bucket, credentials });

await proxy.init();

// Simple health check
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Handle GET requests for S3 proxy - using regex pattern to avoid path-to-regexp issues
app.get(/.*/, async (req, res) => {
  try {
    const stream = await proxy.get(req, res);
    stream.on('error', (err) => res.status(err.statusCode || 500).end()).pipe(res);
  } catch (err) {
    res.status(err.statusCode || 500).end();
  }
});

// Handle HEAD requests for S3 proxy (for metadata)
app.head(/.*/, async (req, res) => {
  try {
    await proxy.head(req, res);
    res.end();
  } catch (err) {
    res.status(err.statusCode || 500).end();
  }
});

app.listen(port, () => {
  console.log(`S3Proxy server running on port ${port}, serving bucket: ${bucket}`);
});
