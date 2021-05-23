# Deploying S3Proxy on ECS Fargate

https://docs.aws.amazon.com/AmazonECS/latest/userguide/fargate-task-networking.html
https://github.com/1Strategy/fargate-cloudformation-example/blob/master/fargate.yaml

## build the docker container
I am building a multi-platform container because I have a Mac ARM and want to deploy on Fargate which only
support x86_64 currently. Building multi-platform containers is probably a good idea these days anyway...

You may need to enable QEMU on your build machine: 
`docker buildx create --use --name=qemu`

```
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ACCOUNT}.dkr.ecr.us-east-1.amazonaws.com
docker buildx build --push -t ${AWS_ACCOUNT}.dkr.ecr.us-east-1.amazonaws.com/s3proxy:latest --platform=linux/amd64,linux/arm64 .
```

## create the stack
```
aws cloudformation validate-template --template-body file://S3ProxyECS.yaml
cfn-lint -t S3ProxyECS.yaml
aws cloudformation create-stack --stack-name S3ProxyECS --template-body file://S3ProxyECS.yaml --capabilities CAPABILITY_NAMED_IAM
```

## Deploy new container image to existing service
From the [aws ecs update-service](https://docs.aws.amazon.com/cli/latest/reference/ecs/update-service.html) documentation: If your updated Docker image uses the same tag as what is in the existing task definition for your service (for example, my_image:latest ), you do not need to create a new revision of your task definition. You can update the service using the forceNewDeployment option. The new tasks launched by the deployment pull the current image/tag combination from your repository when they start.https://docs.aws.amazon.com/cli/latest/reference/ecs/update-service.htmlhttps://docs.aws.amazon.com/cli/latest/reference/ecs/update-service.html

```
aws ecs update-service --cluster S3Proxy --service S3ProxyService --force-new-deployment
```

