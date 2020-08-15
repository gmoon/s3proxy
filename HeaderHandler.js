// Takes an AWS.Request, source stream, and a target stream
// Collects headers from the AWS.Request
// Sends the headers to the target stream once the source stream's first data event is fired
// When the AWS.Request complete event happens, checks that the headers have been sent.
// If not, they are sent. This covers edge cases where all requests fail or the S3 Object
// is a zero byte file. In both cases, no data event on the source stream will ever fire.
//
// Reference:
//   https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Request.html
// Usage:
//   const headerHandler = require('./HeaderHandler');
//     function get(req, res) {
//       const s3request = this.s3.getObject(params);
//       const s3stream = s3request.createReadStream();
//       headerHandler.attach(s3request, s3stream, res);
//       return s3stream;
//     }
//

module.exports = class HeaderHandler {
  constructor() {
    this.httpRequest = null;
    this.sourceStream = null;
    this.targetStream = null;
    this.headersSent = false;
    this.header = {
      statusCode: null,
      headers: null,
      response: null,
      statusMessage: null,
    };
  }

  attach(httpRequest, sourceStream, targetStream) {
    this.httpRequest = httpRequest;
    this.sourceStream = sourceStream;
    this.targetStream = targetStream;
    httpRequest.on('httpHeaders', (statusCode, headers, response, statusMessage) => {
      this.header = {
        statusCode, headers, response, statusMessage,
      };
    });
    sourceStream.on('data', () => {
      this.sendHeaders();
    });
    httpRequest.on('complete', () => {
      this.sendHeaders();
    });
    // callback recieves error and request objects
    httpRequest.on('error', () => {
      this.sendHeaders();
    });
    // callback recieves error object
    sourceStream.on('error', () => {
      this.sendHeaders();
    });
  }

  sendHeaders() {
    if (!this.headersSent) {
      this.targetStream.writeHead(this.header.statusCode, this.header.headers);
      this.headersSent = true;
    }
  }
  // const debug = true;
  // if (debug) {
  //   // To enable debugging, change debug to true
  //   // and uncomment log function and subcribe function below
  //   const log = (eventName) => {
  //     console.log(`[event: ${eventName}]`);
  //   };
  //   const subscribe = (obj, events) => {
  //     events.forEach((event) => {
  //       obj.on(event, () => { log(event); });
  //     });
  //   };
  //   subscribe(httpRequest, [
  //     'send', 'retry', 'extractError', 'extractData', 'success',
  //     'error', 'complete', 'httpHeader', 'httpData', 'httpError', 'httpDone',
  //   ]);
  //   subscribe(sourceStream, ['data']);
  // }
};
