ClusterName=S3Proxy
Region=us-east-1
SecurityGroups=sg-06fff1d355d027a32
Subnets=subnet-045344ab6e9eb9916\\,subnet-063e832a899050f71
command=--config=/etc/ecs/container-insights/otel-task-metrics-config.yaml
aws cloudformation update-stack --stack-name AOCECS-${ClusterName}-${Region} \
    --template-body file://./aws-otel-fargate-sidecar-deployment-cfn.yaml \
    --parameters ParameterKey=ClusterName,ParameterValue=${ClusterName} \
                 ParameterKey=CreateIAMRoles,ParameterValue=True \
                 ParameterKey=SecurityGroups,ParameterValue=${SecurityGroups} \
                 ParameterKey=Subnets,ParameterValue=${Subnets} \
                 ParameterKey=command,ParameterValue=${command} \
    --capabilities CAPABILITY_NAMED_IAM \
    --region ${Region}

