FROM node:20-alpine
ARG VERSION

WORKDIR /src

# Copy and install the s3proxy package
COPY s3proxy-${VERSION}.tgz ./
RUN npm install --no-audit --no-fund --omit=dev ./s3proxy-${VERSION}.tgz

# Add type: module to the generated package.json
RUN npm pkg set type=module

# Install express
RUN npm install express

# Copy the Express startup script
COPY server.js ./server.js

ENV DEBUG=s3proxy,express NODE_ENV=development

# Set the startup command to run the Express server
CMD ["node", "server.js"]
