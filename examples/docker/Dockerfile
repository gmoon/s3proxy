FROM forkzero/s3proxy:2.0.2 as base
ARG VERSION

USER root
COPY s3proxy-${VERSION}.tgz ./
RUN npm install --no-audit --no-fund --omit=dev ./s3proxy-${VERSION}.tgz

ENV DEBUG=s3proxy,express NODE_ENV=development
