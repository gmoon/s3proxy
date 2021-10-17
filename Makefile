SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
GIT_REV          := $(shell git rev-parse --short HEAD 2>/dev/null || echo 0)
UUID             := $(shell date +%s)

.PHONY: eslint
eslint:
	npm run eslint 

.PHONY: unit-tests
unit-tests:
	npm run nyc-coverage

.PHONY: artillery
artillery-ci:
	npm run artillery-ci

.PHONY: sam-app
sam-app:
	cd examples/sam-app && sam build
	cd examples/sam-app && sam local invoke -e events/event.json

.PHONY: sam-app-s3proxy
sam-app-s3proxy:
	cd examples/sam-app/s3proxy && npm install
	cd examples/sam-app/s3proxy && npm run build --if-present
	cd examples/sam-app/s3proxy && npm test

.PHONY: dockerize-for-test
dockerize-for-test:
	npm run dockerize-for-test

.PHONY: artillery-docker
artillery-docker: dockerize-for-test
	npm run artillery-docker

###################################################################
##
## These are the top level targets: test, functional-tests, all.
## They are expected to pass using parallel mode (make -j), 
## e.g. make -j all
##
###################################################################

.PHONY: test
test : eslint unit-tests artillery-ci sam-app sam-app-s3proxy

.PHONY: functional-tests
functional-tests: dockerize-for-test artillery-docker

.PHONY: all
all: test functional-tests