FROM node:current-alpine as base
ARG VERSION
WORKDIR /src
COPY express-s3proxy.js .
COPY s3proxy-${VERSION}.tgz .
RUN apk --update-cache upgrade \
    && npm install ./s3proxy-${VERSION}.tgz express body-parser morgan express-request-id

FROM base as test
# to generate credentials use: aws sts get-session-token --duration 900 > secrets.json
COPY secrets.json .
RUN apk add jq curl bash
EXPOSE $PORT
USER node
CMD DEBUG=* \
    NODE_ENV=test \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 \
    AWS_ACCESS_KEY_ID=`jq -r .Credentials.AccessKeyId secrets.json` \
    AWS_SECRET_ACCESS_KEY=`jq -r .Credentials.SecretAccessKey secrets.json` \
    AWS_SESSION_TOKEN=`jq -r .Credentials.SessionToken secrets.json` \
    node ./express-s3proxy.js

FROM base as production
EXPOSE $PORT
RUN rm -rf /var/cache/apk/
USER node
CMD DEBUG=s3proxy \
    NODE_ENV=production \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 \
    node ./express-s3proxy.js
