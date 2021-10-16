SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
GIT_REV          := $(shell git rev-parse --short HEAD 2>/dev/null || echo 0)
UUID             := $(shell date +%s)

.PHONY: eslint
eslint:
	npm run eslint 

.PHONY: mocha
mocha:
	npm run nyc-coverage mocha 

.PHONY: artillery
artillery:
	npm run artillery-ci 

.PHONY: artillery-docker
artillery-docker:
	npm run package
	npm run artillery-docker

.PHONY: sam-app
sam-app:
	cd examples/sam-app && \
	sam build && \
	sam local invoke -e events/event.json && \
	cd s3proxy && \
	npm install && \
	npm run build --if-present && \
	npm test

.PHONY: test
test : eslint mocha artillery artillery-docker sam-app


