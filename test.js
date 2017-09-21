/* eslint-env mocha, node, es6 */
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('./http.js');

const { expect } = chai;

chai.use(chaiHttp);

describe('HTTP server', () => {
  it('should get index.html', (done) => {
    chai.request(server).get('/index.html').end((error, res) => {
      expect(res).to.have.status(200);
      done();
    });
  });
});
