/* eslint-env mocha, node, es6 */
const EventEmitter = require('events');
const sinon = require('sinon');
const chai = require('chai');
const headerHandler = require('../HeaderHandler');

const { expect } = chai;

describe('HeaderHandler', () => {
  let request; let input; let output; let writeHeadSpy;
  beforeEach(() => {
    request = new EventEmitter();
    input = new EventEmitter();
    output = new EventEmitter();
    output.writeHead = () => { };
    writeHeadSpy = sinon.spy(output, 'writeHead');
    headerHandler.attach(request, input, output);
  });
  it('request should have one listener for httpHeaders', () => {
    expect(request.listeners('httpHeaders')).lengthOf(1);
  });
  it('input should have one listener for data', () => {
    expect(input.listeners('data')).lengthOf(1);
  });
  it('writeHead should not be called if httpData event has not been sent', () => {
    request.emit('httpHeaders');
    sinon.assert.notCalled(writeHeadSpy);
  });
  it('writeHead should be called after data event', () => {
    input.emit('data');
    sinon.assert.calledOnce(writeHeadSpy);
  });
  it('writeHead should be called with statusCode 200', () => {
    request.emit('httpHeaders', 200);
    input.emit('data');
    sinon.assert.calledWith(writeHeadSpy.firstCall, 200);
  });
  it('writeHead should be called with statusCode 999 and headers match', () => {
    request.emit('httpHeaders', 999, { ID: '000', Code: 'XXX' }, null, 'Info');
    input.emit('data');
    sinon.assert.calledWith(writeHeadSpy.firstCall, 999, { ID: '000', Code: 'XXX' });
  });
});
