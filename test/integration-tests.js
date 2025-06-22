/* eslint-env mocha, node, es6 */
const chai = require('chai');
const http = require('chai-http');
const httpServer = require('../examples/http.js');
const expressServer = require('../examples/express-basic.js');

const { expect } = chai;

chai.use(http);
const testString = 'specialCharacters!-_.*\'()&$@=;:+  ,?\\{^}%`]">[~<#|.';
const encodedTestString = encodeURIComponent(testString);

describe('Examples', () => {
  describe('HTTP server', () => {
    it('should get index.html', (done) => {
      chai
        .request(httpServer)
        .get('/index.html')
        .end((error, res) => {
          expect(res).to.have.status(200);
          done(error);
        });
    });
    it('should respond with 404 Not Found for nonexistent key', (done) => {
      chai
        .request(httpServer)
        .get('/nonexistent.file')
        .end((error, res) => {
          expect(res).to.have.status(404);
          done(error);
        });
    });
    it('should get object with special characters in the name', (done) => {
      chai
        .request(httpServer)
        .get(`/${encodedTestString}`)
        .end((error, res) => {
          expect(res).to.have.status(200);
          done(error);
        });
    });
  });

  describe('Express server', () => {
    it('should get head of index.html', (done) => {
      chai
        .request(expressServer)
        .head('/index.html')
        .end((error, res) => {
          expect(res).to.have.status(200);
          done(error);
        });
    });
    it('should get index.html', (done) => {
      chai
        .request(expressServer)
        .get('/index.html')
        .end((error, res) => {
          expect(res).to.have.status(200);
          done(error);
        });
    });
    it('should respond with 404 Not Found for nonexistent key', (done) => {
      chai
        .request(expressServer)
        .get('/nonexistent.file')
        .end((error, res) => {
          expect(res).to.have.status(404);
          done(error);
        });
    });
    it('should respond with 403 Forbidden for unauthorized access request', (done) => {
      chai
        .request(expressServer)
        .get('/unauthorized.html')
        .end((error, res) => {
          expect(res).to.have.status(403);
          done(error);
        });
    });
    it('should respond to health check', (done) => {
      chai
        .request(expressServer)
        .get('/health')
        .end((error, res) => {
          expect(res).to.have.status(200);
          done(error);
        });
    });
    it('should respond to head request', (done) => {
      chai
        .request(expressServer)
        .head('/index.html')
        .end((error, res) => {
          expect(res).to.have.status(200);
          done(error);
        });
    });
  });
});
