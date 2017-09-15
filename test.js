var expect = require('chai').expect
  , s3proxy = require('./s3proxy.js')
  , proxy   = new s3proxy();

describe('s3front', function() {
   describe('constructor', function() {
      it('should be an object', function() {
         expect(proxy).to.be.an('object');
      });
   });
   describe('initialization', function() {
      it("should emit an 'init' event", function(done) {
         proxy.on('init', () => {
            done(); 
         });
         proxy.init();
      });
   });
});



