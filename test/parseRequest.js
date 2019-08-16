/* eslint-env mocha, node, es6 */

const chai = require('chai');
const S3Proxy = require('../');

const { expect } = chai;

describe('s3proxy.parseRequest', () => {
  it('should return key and query', () => {
    expect(S3Proxy.parseRequest({ url: '/index.html' })).to.deep.equal({ key: 'index.html', query: {} });
    expect(S3Proxy.parseRequest({ url: '/index.html?foo=bar' })).to.deep.equal({ key: 'index.html', query: { foo: 'bar' } });
    expect(S3Proxy.parseRequest({ path: '/index.html', query: {} })).to.deep.equal({ key: 'index.html', query: {} });
    expect(S3Proxy.parseRequest({ path: '/index.html', query: { foo: 'bar' } })).to.deep.equal({ key: 'index.html', query: { foo: 'bar' } });
  });
});
