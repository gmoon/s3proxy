var expect = require('chai').expect
  , s3front = require('./s3front.js')
  , s3proxy = new s3front();

describe('s3front', function() {
   describe('constructor', function() {
      it('should be an object', function() {
         expect(s3proxy).to.be.an('object');
      });
   });
   describe('initialization', function() {
      it("should emit an 'init' event", function(done) {
         s3proxy.on('init', () => {
            done(); 
         });
         s3proxy.init();
      });
   });
});



