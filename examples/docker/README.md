# S3Proxy Docker Container

A docker container that runs S3Proxy via an Express app

## Build

### Test Target
Build the `s3proxy:test` image and load/output it into your local docker system.
``` bash
npm run package
npm run credentials
npm run dockerize-for-test
```

### Production Target
``` bash
npm run package
npm run dockerize-for-prod
```

This builds a multi-platform container which is useful if you are targeting multiple runtime architectures. For example, a Mac M1 (arm64) and AWS Fargate (amd64).

You may need to enable QEMU on your build machine: 
`docker buildx create --use --name=qemu`

## Test
``` bash
aws sts get-session-token --duration 900 > credentials.json
docker run -v $PWD/credentials.json:/src/credentials.json:ro \
  --rm \
  --name s3proxy-test \
  -d \
  -p 8080:8080 \
  -e BUCKET=mybucket \
  -e PORT=8080 \
  -t s3proxy:test
curl http://localhost:8080/index.html     # serves s3://mybucket/index.html
docker kill s3proxy-test
```
