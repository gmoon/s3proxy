https://docs.aws.amazon.com/AmazonECS/latest/userguide/fargate-task-networking.html
https://github.com/1Strategy/fargate-cloudformation-example/blob/master/fargate.yaml

# one-time setup
aws cloudformation validate-template --template-body file://S3ProxyECS.yaml
aws cloudformation create-stack --stack-name S3ProxyECS --template-body file://S3ProxyECS.yaml --capabilities CAPABILITY_NAMED_IAM

aws iam create-role --role-name S3ProxyECSExecutionRole --assume-role-policy-document file://S3ProxyECSExecutionRole-TrustPolicy.json
aws iam put-role-policy --role-name S3ProxyECSExecutionRole --policy-name S3ProxyECSExecutionPolicy --policy-document file://
aws ecr create-repository --repository-name s3proxy
aws ecs create-cluster --cluster-name s3proxy
aws ecs register-task-definition --cli-input-json file://./express-s3proxy-task.json
aws ecs create-service --cluster s3proxy --service-name s3proxy-service --task-definition s3proxy-fargate:2 --desired-count 1 --launch-type "FARGATE" --network-configuration "awsvpcConfiguration={subnets=[subnet-045344ab6e9eb9916],securityGroups=[sg-035cad0aaf1192d3d]}"

# as the container iterates...
cp ../examples/express-s3proxy.js .
#docker build -t 624920530251.dkr.ecr.us-east-1.amazonaws.com/s3proxy:latest .
#may need to run this once on your build machine: docker buildx create --use --name=qemu
docker buildx build -t 624920530251.dkr.ecr.us-east-1.amazonaws.com/s3proxy:latest --platform=linux/amd64,linux/arm64 .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 624920530251.dkr.ecr.us-east-1.amazonaws.com
docker push 624920530251.dkr.ecr.us-east-1.amazonaws.com/s3proxy:latest 
# TODO deploy new container image

Path: ''  
RoleName: 'S3proxyECSExecutionRole' # [REQUIRED] The name of the role to create.
AssumeRolePolicyDocument: 
    Version: "2012-10-17"
    Statement:
        - Effect: Allow
        Principal:
            Service:
            - ecs-tasks.amazonaws.com
        Action:
            - 'sts:AssumeRole'
Description: 'S3Proxy ECS Execution Role'
MaxSessionDuration: 0 # The maximum session duration (in seconds) that you want to set for the specified role.
PermissionsBoundary: '' # The ARN of the policy that is used to set the permissions boundary for the role.


# https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}

Policy using VPC endpoints for ECR
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "aws:sourceVpce": "vpce-xxxxxx",
                    "aws:sourceVpc": "vpc-xxxxx"
                }
            }
        }
    ]
}

Trust Policy:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}