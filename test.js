/* eslint-env mocha, node, es6 */

const chai = require('chai');
const S3Proxy = require('./s3proxy.js');

const { expect } = chai;
const proxy = new S3Proxy();

describe('s3proxy', () => {
  describe('constructor', () => {
    it('should be an object', () => {
      expect(proxy).to.be.an('object');
    });
  });
  describe('initialization', () => {
    it("should emit an 'init' event", (done) => {
      proxy.on('init', () => {
        done();
      });
      proxy.init();
    });
  });
});
