FROM node:current-alpine
WORKDIR /src
RUN npm install s3proxy express body-parser morgan express-request-id
COPY express-s3proxy.js .
ENV PORT=80
ENV AWS_NODEJS_CONNECTION_REUSE_ENABLED=1
