FROM alpine:3.9
WORKDIR /usr/src/app
COPY package*.json ./
COPY *.js ./
RUN apk add --no-cache nodejs npm
RUN npm install \
  && node -v \ 
  && npm list --depth=0
EXPOSE 3000
ENTRYPOINT ["node", "server"]

