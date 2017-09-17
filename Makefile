SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
UUID             := $(shell date +%s)

.PHONY : packagedeps npmdeps clean eslint mocha test target tar

debuginfo:
	@echo node --version $(shell node --version)
	@echo npm --version $(shell npm --version)
	@echo debian version $(shell cat /etc/debian_version)
	@echo os-release 
	@echo $(shell cat /etc/os-release)

npmdeps: 
	npm install

install-docker-repo:
	apt-get update
	apt-get -y install apt-transport-https ca-certificates curl gnupg2 software-properties-common
	curl -fsSL https://download.docker.com/linux/$(shell . /etc/os-release; echo "$ID")/gpg | sudo apt-key add -
	apt-key fingerprint 0EBFCD88
	add-apt-repository \
		"deb [arch=amd64] https://download.docker.com/linux/$(shell . /etc/os-release; echo "$ID") \
		$(shell lsb_release -cs) \
		stable"

packagedeps: install-docker-repo
	apt-get update
	apt-get -y install jq docker-ce

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
	
