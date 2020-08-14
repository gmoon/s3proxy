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

module.exports = {
  attach: (httpRequest, sourceStream, targetStream) => {
    let header = {
      statusCode: null,
      headers: null,
      response: null,
      statusMessage: null,
    };
    let headersSent = false;
    const sendHeaders = () => {
      if (!headersSent) {
        targetStream.writeHead(header.statusCode, header.headers);
        headersSent = true;
      }
    };
    httpRequest.on('httpHeaders', (statusCode, headers, response, statusMessage) => {
      header = {
        statusCode, headers, response, statusMessage,
      };
    });
    sourceStream.on('data', () => {
      sendHeaders();
    });
    httpRequest.on('complete', () => {
      sendHeaders();
    });
    // callback recieves error and request objects
    httpRequest.on('error', () => {
      sendHeaders();
    });
    // callback recieves error object
    sourceStream.on('error', () => {
      sendHeaders();
    });
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
  },
};
