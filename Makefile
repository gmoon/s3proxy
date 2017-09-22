SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
UUID             := $(shell date +%s)

.PHONY : apt-get-update install-node install-docker-repo packagedeps npmdeps clean eslint mocha test target tar

target :
	mkdir -p target

clean :
	rm -rf target

eslint : target
	set -o pipefail; node_modules/.bin/eslint --fix *.js | tee target/test-eslint.txt

mocha : target
	set -o pipefail; node_modules/.bin/mocha | tee target/test-mocha.txt

test : mocha eslint package-s3proxy-test

package-s3proxy-test:
	$(MAKE) test -C packages/s3proxy

tar : target test
	git archive -v -o target/$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz --format=zip HEAD

build: 
	aws --profile forkzero codebuild start-build --project-name s3proxy

docker: 
	$(eval LOGIN=$(shell aws --region us-east-1 ecr get-login))
	$(LOGIN)

