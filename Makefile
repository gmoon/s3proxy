SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
GIT_REV          := $(shell git rev-parse --short HEAD 2>/dev/null || echo 0)
UUID             := $(shell date +%s)
ifeq ($(CI_ENGINE),CodeBuild)
	ESLINT_OPTS := --output-file target/$(PACKAGE_NAME)-$(PACKAGE_VERSION)-$(GIT_REV)-eslint.txt
	MOCHA_OPTS  := | tee target/$(PACKAGE_NAME)-$(PACKAGE_VERSION)-$(GIT_REV)-mocha.txt
else
	ESLINT_OPTS := --fix
endif

.PHONY : clean target npm-install eslint mocha test build docker tar package-s3proxy-test

target :
	mkdir -p target

clean :
	rm -rf target

npm-install:
	npm install

eslint : target npm-install
	node_modules/.bin/eslint $(ESLINT_OPTS) *.js

mocha : target npm-install
	set -o pipefail; node_modules/.bin/mocha $(MOCHA_OPTS)

test : mocha eslint package-s3proxy-test

package-s3proxy-test:
	$(MAKE) test -C packages/s3proxy

tar : target test
	git archive -v -o target/$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz --format=tar HEAD

build: 
	aws --profile forkzero codebuild start-build --project-name s3proxy

docker: 
	$(eval LOGIN=$(shell aws --region us-east-1 ecr get-login))
	$(LOGIN)

