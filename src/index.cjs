// CommonJS wrapper for backward compatibility
// This file provides CommonJS exports for the ESM module

const { S3Proxy } = require('./index.js');

// Export as both named export and default export for maximum compatibility
module.exports = S3Proxy;
module.exports.S3Proxy = S3Proxy;
module.exports.default = S3Proxy;
