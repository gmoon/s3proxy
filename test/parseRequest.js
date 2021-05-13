/* eslint-env mocha, node, es6 */

const chai = require('chai');
const S3Proxy = require('..');

const { expect } = chai;

describe('s3proxy.parseRequest', () => {
  it('should return key and query', () => {
    expect(S3Proxy.parseRequest({ url: '/index.html' })).to.deep.equal({ key: 'index.html', query: {} });
    expect(S3Proxy.parseRequest({ url: '/index.html?foo=bar' })).to.deep.equal({ key: 'index.html', query: { foo: 'bar' } });
    expect(S3Proxy.parseRequest({ path: '/index.html', query: {} })).to.deep.equal({ key: 'index.html', query: {} });
    expect(S3Proxy.parseRequest({ path: '/index.html', query: { foo: 'bar' } })).to.deep.equal({ key: 'index.html', query: { foo: 'bar' } });
    expect(S3Proxy.parseRequest({ path: '/index.html' })).to.deep.equal({ key: 'index.html', query: {}});
  });
  it('should return key without url encodings', () => {
    expect(S3Proxy.parseRequest({ url: '/file with spaces'})).to.deep.equal({ key: 'file with spaces', query: {} });
    expect(S3Proxy.parseRequest({ path: '/file with spaces'})).to.deep.equal({ key: 'file with spaces', query: {} });
  })
  it('should decode all the special characters', () => {
    const testString = "specialCharacters!-_.*'()&$@=;:+  ,?\{^}%`]\">[~<#|.";
    const encodedTestString = encodeURIComponent(testString);
    expect(S3Proxy.parseRequest({ url: encodedTestString})).to.deep.equal({ key: testString, query: {} });
    expect(S3Proxy.parseRequest({ path: encodedTestString})).to.deep.equal({ key: testString, query: {}});
  })
});
