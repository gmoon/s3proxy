FROM node:22-alpine
ARG VERSION

WORKDIR /src

# Copy and install the s3proxy package
COPY s3proxy-${VERSION}.tgz ./
RUN npm install --no-audit --no-fund --omit=dev ./s3proxy-${VERSION}.tgz

# Add type: module to the generated package.json
RUN npm pkg set type=module

# Install fastify and tsx for TypeScript execution
RUN npm install fastify tsx @aws-sdk/xml-builder

# Copy the Fastify startup script
COPY fastify-docker.ts ./fastify-docker.ts

ENV DEBUG=s3proxy NODE_ENV=development

# Set the startup command to run the Fastify server with tsx
CMD ["npx", "tsx", "fastify-docker.ts"]
