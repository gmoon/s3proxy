FROM node:current-alpine as base
ARG VERSION
WORKDIR /src
COPY express-s3proxy.js s3proxy-${VERSION}.tgz ./
RUN apk --update-cache upgrade \
    && npm install --production -g npm \
    && npm install --production ./s3proxy-${VERSION}.tgz express body-parser morgan express-request-id helmet \
    && npm install --production -g pm2

FROM base as test
# to generate credentials use: aws sts get-session-token --duration 900 > secrets.json
COPY secrets.json start-express-test.sh ./
RUN apk add --no-cache jq curl bash netcat-openbsd
EXPOSE $PORT
USER node
CMD AWS_ACCESS_KEY_ID=`jq -r .Credentials.AccessKeyId secrets.json` \
    AWS_SECRET_ACCESS_KEY=`jq -r .Credentials.SecretAccessKey secrets.json` \
    AWS_SESSION_TOKEN=`jq -r .Credentials.SessionToken secrets.json` \
    PORT=$PORT \
    DEBUG=s3proxy,express \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 \
    NODE_ENV=development \
    pm2-runtime -i max express-s3proxy.js

FROM base as production
COPY start-express-prod.sh .
RUN rm -rf /var/cache/apk/
EXPOSE $PORT
USER node
CMD PORT=$PORT \
    DEBUG=s3proxy \
    AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 \
    NODE_ENV=production \
    pm2-runtime -i max express-s3proxy.js
