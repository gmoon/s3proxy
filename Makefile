SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)

.PHONY : packagedeps npmdeps clean eslint mocha test target tar

npmdeps: 
	npm install

packagedeps:
	which jq 2>/dev/null || apt-get -y install jq

builddeps: packagedeps npmdeps

target :
	mkdir -p target

clean :
	rm -rf target

eslint : target
	set -o pipefail; node_modules/.bin/eslint *.js | tee target/test-eslint.txt

mocha : target
	set -o pipefail; node_modules/.bin/mocha | tee target/test-mocha.txt

test : mocha eslint
	aws --region us-east-1 ecr get-login

tar : target test
	rm -f target/$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz
	rm -rf target/source
	mkdir -p target/source/$(PACKAGE_NAME)-$(PACKAGE_VERSION)/
	cp s3proxy.js README.md LICENSE target/source/$(PACKAGE_NAME)-$(PACKAGE_VERSION)/
	cd target/source; tar -cvzf ../$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz *

build: 
	aws --profile forkzero codebuild start-build --project-name s3proxy
	
