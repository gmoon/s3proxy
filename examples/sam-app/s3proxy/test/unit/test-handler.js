/* eslint-env mocha, node, es6 */
/* eslint-disable import/no-extraneous-dependencies */
const chai = require('chai');
const app = require('../../app.js');

const { expect } = chai;
const event = {
  httpMethod: 'GET',
  body: null,
  resource: '/{proxy+}',
  requestContext: {
    resourceId: '123456',
    apiId: '1234567890',
    resourcePath: '/{proxy+}',
    httpMethod: 'GET',
    requestId: 'c6af9ac6-7b61-11e6-9a41-93e8deadbeef',
    accountId: '123456789012',
    stage: 'Prod',
    identity: {
      apiKey: null,
      userArn: null,
      cognitoAuthenticationType: null,
      caller: null,
      userAgent: 'Custom User Agent String',
      user: null,
      cognitoIdentityPoolId: null,
      cognitoAuthenticationProvider: null,
      sourceIp: '127.0.0.1',
      accountId: null,
    },
    extendedRequestId: null,
    path: '/{proxy+}',
  },
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  headers: {
    Host: 'localhost:3000',
    'User-Agent': 'curl/7.64.1',
    Accept: '*/*',
    'X-Forwarded-Proto': 'http',
    'X-Forwarded-Port': '3000',
  },
  multiValueHeaders: {
    Host: ['localhost:3000'],
    'User-Agent': ['curl/7.64.1'],
    Accept: ['*/*'],
    'X-Forwarded-Proto': ['http'],
    'X-Forwarded-Port': ['3000'],
  },
  pathParameters: {
    proxy: 'yin-yang.jpeg',
  },
  stageVariables: null,
  path: '/yin-yang.jpeg',
  isBase64Encoded: false,
};

describe('Tests index', () => {
  after((done) => {
    app.close();
    done();
  });
  it('verifies successful response', (done) => {
    const succeed = (result) => {
      expect(result).to.be.an('object');
      expect(result.statusCode).to.equal(200);
      expect(result.body).to.be.an('string');
      done();
    };
    app.lambdaHandler(event, { succeed });
  });
});
