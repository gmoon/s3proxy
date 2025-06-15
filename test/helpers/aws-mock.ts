import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

export const s3Mock = mockClient(S3Client);

/**
 * Sets up comprehensive S3 mocks for unit testing
 * Mocks all AWS SDK calls to avoid hitting real AWS services
 */
export function setupS3Mocks() {
  // Reset all mocks to clean state
  s3Mock.reset();

  // Mock HTML content
  const mockHtmlContent = `<!doctype html>

<html lang="en">
<head>
  <meta charset="utf-8">

  <title>s3proxy</title>
  <meta name="description" content="s3proxy landing page">
  <meta name="author" content="George Moon">
</head>

<body>
<h1>s3proxy public landing page</h1>
The public repo is <a href="https://github.com/gmoon/s3proxy">here</a>.
</body>
</html>

`;

  // Mock successful bucket head (for health checks and initialization)
  s3Mock.on(HeadBucketCommand).resolves({
    $metadata: {
      httpStatusCode: 200,
      requestId: 'mock-request-id',
    },
  });

  // Mock successful file head for index.html
  s3Mock
    .on(HeadObjectCommand, {
      Bucket: 's3proxy-public',
      Key: 'index.html',
    })
    .resolves({
      ContentLength: 338,
      ContentType: 'text/html',
      ETag: '"b772dda7744f7e67697c8946afbf04f1"',
      LastModified: new Date('2017-09-23T04:14:21.000Z'),
      AcceptRanges: 'bytes',
      $metadata: {
        httpStatusCode: 200,
        requestId: 'mock-request-id',
      },
    });

  // Mock successful file get for index.html
  s3Mock
    .on(GetObjectCommand, {
      Bucket: 's3proxy-public',
      Key: 'index.html',
    })
    .resolves({
      Body: Readable.from([mockHtmlContent]),
      ContentLength: 338,
      ContentType: 'text/html',
      ETag: '"b772dda7744f7e67697c8946afbf04f1"',
      LastModified: new Date('2017-09-23T04:14:21.000Z'),
      AcceptRanges: 'bytes',
      $metadata: {
        httpStatusCode: 200,
        requestId: 'mock-request-id',
      },
    });

  // Mock 404 for nonexistent files
  s3Mock
    .on(HeadObjectCommand, {
      Bucket: 's3proxy-public',
      Key: 'nonexistent-file.txt',
    })
    .rejects({
      name: 'NoSuchKey',
      message: 'The specified key does not exist.',
      $fault: 'client',
      $metadata: {
        httpStatusCode: 404,
        requestId: 'mock-request-id',
      },
    });

  s3Mock
    .on(GetObjectCommand, {
      Bucket: 's3proxy-public',
      Key: 'nonexistent-file.txt',
    })
    .rejects({
      name: 'NoSuchKey',
      message: 'The specified key does not exist.',
      $fault: 'client',
      $metadata: {
        httpStatusCode: 404,
        requestId: 'mock-request-id',
      },
    });

  // Mock for empty key (malformed requests)
  s3Mock
    .on(HeadObjectCommand, {
      Bucket: 's3proxy-public',
      Key: '',
    })
    .rejects({
      name: 'NoSuchKey',
      message: 'The specified key does not exist.',
      $fault: 'client',
      $metadata: {
        httpStatusCode: 404,
        requestId: 'mock-request-id',
      },
    });

  s3Mock
    .on(GetObjectCommand, {
      Bucket: 's3proxy-public',
      Key: '',
    })
    .rejects({
      name: 'NoSuchKey',
      message: 'The specified key does not exist.',
      $fault: 'client',
      $metadata: {
        httpStatusCode: 404,
        requestId: 'mock-request-id',
      },
    });

  // Mock range requests
  s3Mock
    .on(GetObjectCommand, {
      Bucket: 's3proxy-public',
      Key: 'index.html',
      Range: 'bytes=0-100',
    })
    .resolves({
      Body: Readable.from([mockHtmlContent.substring(0, 101)]),
      ContentLength: 101,
      ContentRange: 'bytes 0-100/338',
      ContentType: 'text/html',
      ETag: '"b772dda7744f7e67697c8946afbf04f1"',
      AcceptRanges: 'bytes',
      $metadata: {
        httpStatusCode: 206,
        requestId: 'mock-request-id',
      },
    });
}

/**
 * Cleans up S3 mocks after testing
 */
export function teardownS3Mocks() {
  s3Mock.restore();
}

/**
 * Helper to set up specific mock scenarios for individual tests
 */
export function mockS3Error(command: any, error: any) {
  s3Mock.on(command).rejects(error);
}

/**
 * Helper to verify mock calls were made
 */
export function getS3MockCalls() {
  return s3Mock.calls();
}
