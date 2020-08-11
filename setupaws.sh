aws iam create-user --user-name s3proxy-github-actions --path '/s3proxy' || echo user already exists
aws iam create-access-key --user-name s3proxy-github-actions

