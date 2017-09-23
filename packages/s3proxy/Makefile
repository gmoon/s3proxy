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

.PHONY : target clean npm-install eslint mocha test

target :
	mkdir -p target

clean :
	rm -rf target

npm-install:
	npm install

eslint : target npm-install
	set -o pipefail; node_modules/.bin/eslint $(ESLINT_OPTS) *.js

mocha : target npm-install
	set -o pipefail; node_modules/.bin/mocha $(MOCHA_OPTS)

test : mocha eslint

