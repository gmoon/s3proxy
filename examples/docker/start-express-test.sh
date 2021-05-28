#!/bin/sh

DEBUG=* \
    PORT=8080 \
    NODE_ENV=test \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 \
    AWS_ACCESS_KEY_ID=`jq -r .Credentials.AccessKeyId secrets.json` \
    AWS_SECRET_ACCESS_KEY=`jq -r .Credentials.SecretAccessKey secrets.json` \
    AWS_SESSION_TOKEN=`jq -r .Credentials.SessionToken secrets.json` \
    node ./express-s3proxy.js
