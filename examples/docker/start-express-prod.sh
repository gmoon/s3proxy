#!/bin/sh

DEBUG=s3proxy \
    PORT=$PORT \
    NODE_ENV=production \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 \
    node ./express-s3proxy.js
