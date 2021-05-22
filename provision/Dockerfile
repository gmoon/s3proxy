FROM node:current-alpine as base
WORKDIR /src
COPY version.txt .
COPY express-s3proxy.js .
COPY s3proxy-*.tgz .
RUN apk update; apk upgrade; apk add curl bash
RUN npm install ./s3proxy-`cat version.txt`.tgz express body-parser morgan express-request-id

FROM base as test
COPY secrets.json .
RUN apk add jq
EXPOSE $PORT
CMD DEBUG=* \
    NODE_ENV=test \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 \
    AWS_ACCESS_KEY_ID=`jq -r .Credentials.AccessKeyId secrets.json` \
    AWS_SECRET_ACCESS_KEY=`jq -r .Credentials.SecretAccessKey secrets.json` \
    AWS_SESSION_TOKEN=`jq -r .Credentials.SessionToken secrets.json` \
    node ./express-s3proxy.js

FROM base as production
EXPOSE $PORT
CMD DEBUG=s3proxy \
    NODE_ENV=production \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 \
    node ./express-s3proxy.js
