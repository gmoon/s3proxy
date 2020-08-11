
docker-image:
	cp ../../index.js s3proxy.js
	docker build -t 'gmoon/s3proxy' .

docker-run:
	aws sts get-session-token > .credentials
	echo AWS_ACCESS_KEY_ID=`jq -r .Credentials.AccessKeyId .credentials` > .env_file
	echo AWS_SECRET_ACCESS_KEY=`jq -r .Credentials.SecretAccessKey .credentials` >> .env_file
	echo AWS_SESSION_TOKEN=`jq -r .Credentials.SessionToken .credentials` >> .env_file
	echo DEBUG=s3proxy >> .env_file
	echo PORT=3000 >> .env_file
	docker run -p 3000:3000 --env-file ./.env_file gmoon/s3proxy 

