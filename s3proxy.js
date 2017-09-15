'use strict';

const EventEmitter = require('events');

module.exports = class s3proxy extends EventEmitter {
   constructor() {
      super();
   };
   init() {
      this.emit('init');
   }
};


