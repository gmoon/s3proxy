FROM node:current-alpine as base
ARG VERSION
WORKDIR /src
# Set default environment variables. Can be overridden via docker run -e
ENV PORT=8080 DEBUG=s3proxy AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 NODE_ENV=production
EXPOSE $PORT
COPY express-s3proxy.js s3proxy-${VERSION}.tgz ./
RUN apk --update-cache upgrade \
    && npm install --production -g npm \
    && npm install --production ./s3proxy-${VERSION}.tgz express body-parser morgan express-request-id helmet \
    && npm install --production -g pm2 \
    && apk add --no-cache curl

FROM base as test
# to generate credentials use: aws sts get-session-token --duration 900 > secrets.json
COPY secrets.json start-express-test.sh ./
RUN apk add --no-cache jq bash netcat-openbsd
USER node
CMD AWS_ACCESS_KEY_ID=`jq -r .Credentials.AccessKeyId secrets.json` \
    AWS_SECRET_ACCESS_KEY=`jq -r .Credentials.SecretAccessKey secrets.json` \
    AWS_SESSION_TOKEN=`jq -r .Credentials.SessionToken secrets.json` \
    DEBUG=s3proxy,express \
    NODE_ENV=development \
    pm2-runtime -i max express-s3proxy.js

FROM base as production
COPY start-express-prod.sh .
RUN rm -rf /var/cache/apk/
USER node
CMD pm2-runtime -i max express-s3proxy.js
