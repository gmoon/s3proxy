SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
UUID             := $(shell date +%s)
OS               := $(shell source /etc/os-release; echo "$$ID")

.PHONY : apt-get-update install-node install-docker-repo packagedeps npmdeps clean eslint mocha test target tar

debuginfo:
	@echo node --version $(shell node --version)
	@echo npm --version $(shell npm --version)
	@echo debian version $(shell cat /etc/debian_version)
	@echo os-release 
	@echo $(shell cat /etc/os-release)
	@echo Operating System $(OS)

npmdeps: install-node
	npm install

apt-get-update:
	apt-get update

install-node: apt-get-update
	apt-get -y install npm
	npm install -g n
	n stable

install-docker-repo:
	apt-get update
	apt-get -y install apt-transport-https ca-certificates curl gnupg2 software-properties-common
	curl -fsSL https://download.docker.com/linux/$(OS)/gpg | sudo apt-key add -
	apt-key fingerprint 0EBFCD88
	add-apt-repository \
		"deb [arch=amd64] https://download.docker.com/linux/$(OS) \
		$(shell lsb_release -cs) \
		stable"

packagedeps: apt-get-update install-node
	apt-get -y install jq

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

tar : target test
	rm -f target/$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz
	rm -rf target/source
	mkdir -p target/source/$(PACKAGE_NAME)-$(PACKAGE_VERSION)/
	cp s3proxy.js README.md LICENSE target/source/$(PACKAGE_NAME)-$(PACKAGE_VERSION)/
	cd target/source; tar -cvzf ../$(PACKAGE_NAME)-$(PACKAGE_VERSION).tar.gz *

build: 
	aws --profile forkzero codebuild start-build --project-name s3proxy

docker: 
	$(eval LOGIN=$(shell aws --region us-east-1 ecr get-login))
	$(LOGIN)

