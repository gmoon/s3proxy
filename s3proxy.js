'use strict';

const EventEmitter = require('events');

module.exports = class s3front extends EventEmitter {
   constructor() {
      super();
   };
   init() {
      this.emit('init');
   }
};


