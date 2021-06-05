### build the docker container
I am building a multi-platform container because I have a Mac ARM and want to deploy on Fargate which only
supports x86_64 currently. Building multi-platform containers is probably a good idea these days anyway...

You may need to enable QEMU on your build machine: 
`docker buildx create --use --name=qemu`
