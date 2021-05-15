# Deploying S3Proxy on ECS Fargate

https://docs.aws.amazon.com/AmazonECS/latest/userguide/fargate-task-networking.html
https://github.com/1Strategy/fargate-cloudformation-example/blob/master/fargate.yaml

## build the docker container
I am building a multi-platform container because I have a Mac ARM and want to deploy on Fargate which only
support x86_64 currently. Building multi-platform containers is probably a good idea these days anyway...

You may need to enable QEMU on your build machine: 
`docker buildx create --use --name=qemu`

```
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin account-id.dkr.ecr.us-east-1.amazonaws.com
docker buildx build --push -t account-id.dkr.ecr.us-east-1.amazonaws.com/s3proxy:latest --platform=linux/amd64,linux/arm64 .
```

## create the stack
aws cloudformation validate-template --template-body file://S3ProxyECS.yaml
aws cloudformation create-stack --stack-name S3ProxyECS --template-body file://S3ProxyECS.yaml --capabilities CAPABILITY_NAMED_IAM
