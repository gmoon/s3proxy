FROM node:current-alpine as base
ARG VERSION
WORKDIR /src
# Set default environment variables. Can be overridden via docker run -e
ENV PORT=8080 DEBUG=s3proxy AWS_NODEJS_CONNECTION_REUSE_ENABLED=1 NODE_ENV=production PM2_INSTANCES=max
EXPOSE $PORT
COPY checkenv.sh express-s3proxy.js s3proxy-${VERSION}.tgz ./
HEALTHCHECK CMD curl -f http://localhost:${PORT}/health || exit 1
RUN apk --update-cache upgrade \
    && npm install --production -g npm \
    && npm install --production ./s3proxy-${VERSION}.tgz express body-parser morgan express-request-id helmet \
    && npm install --production -g pm2 \
    && apk add --no-cache curl \
    && npm cache clean --force \
    && rm -rf ~/.npm

FROM base as test
RUN apk add --no-cache jq bash netcat-openbsd
USER node
CMD DEBUG=s3proxy,express \
    NODE_ENV=development \
    ./checkenv.sh pm2-runtime -i $PM2_INSTANCES express-s3proxy.js

FROM base as production
RUN rm -rf /var/cache/apk/
USER node
CMD ./checkenv.sh pm2-runtime -i $PM2_INSTANCES express-s3proxy.js
