## Deploying S3Proxy on ECS Fargate

https://docs.aws.amazon.com/AmazonECS/latest/userguide/fargate-task-networking.html
https://github.com/1Strategy/fargate-cloudformation-example/blob/master/fargate.yaml

### create the stack
``` bash
aws cloudformation validate-template --template-body file://S3ProxyECS.yaml
cfn-lint -t S3ProxyECS.yaml
aws cloudformation create-stack --stack-name S3ProxyECS --template-body file://S3ProxyECS.yaml --capabilities CAPABILITY_NAMED_IAM
```

### update the stack (pulls from Docker Registry)
``` bash
aws cloudformation update-stack --stack-name S3ProxyECS --template-body file://S3ProxyECS.yaml --capabilities CAPABILITY_NAMED_IAM --parameters ParameterKey=BucketName,ParameterValue=<bucketname>
```

### Deploy new container image to existing service
From the [aws ecs update-service](https://docs.aws.amazon.com/cli/latest/reference/ecs/update-service.html) documentation: If your updated Docker image uses the same tag as what is in the existing task definition for your service (for example, my_image:latest ), you do not need to create a new revision of your task definition. You can update the service using the forceNewDeployment option. The new tasks launched by the deployment pull the current image/tag combination from your repository when they start.https://docs.aws.amazon.com/cli/latest/reference/ecs/update-service.htmlhttps://docs.aws.amazon.com/cli/latest/reference/ecs/update-service.html

``` bash
aws ecs update-service --cluster S3Proxy --service S3ProxyService --force-new-deployment
```

## Testing keepalive
``` bash
echo -e "GET /index.html HTTP/1.1\n\n\n" | nc localhost 8080
echo -e "GET /index.html HTTP/1.1\nConnection: keep-alive\n\n" | nc localhost 8080
echo -e "GET /index.html HTTP/1.1\nConnection: close\n\n" | nc localhost 8080
```