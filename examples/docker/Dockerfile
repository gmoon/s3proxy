FROM node:current-alpine as base
ARG VERSION
WORKDIR /src
COPY express-s3proxy.js .
COPY s3proxy-${VERSION}.tgz .
RUN apk --update-cache upgrade \
    && npm install ./s3proxy-${VERSION}.tgz express body-parser morgan express-request-id helmet

FROM base as test
# to generate credentials use: aws sts get-session-token --duration 900 > secrets.json
COPY secrets.json .
COPY start-express-test.sh .
RUN apk add --no-cache jq curl bash netcat-openbsd
EXPOSE $PORT
USER node
CMD ./start-express-test.sh

FROM base as production
COPY start-express-prod.sh .
RUN rm -rf /var/cache/apk/
EXPOSE 8080
USER node
CMD ./start-express-prod.sh
