/* jslint node: true, esversion: 6 */

const EventEmitter = require('events');

module.exports = class s3proxy extends EventEmitter {
  init() {
    this.emit('init');
  }
};
