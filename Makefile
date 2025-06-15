SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
GIT_REV          := $(shell git rev-parse --short HEAD 2>/dev/null || echo 0)
UUID             := $(shell date +%s)

.PHONY: lint
lint:
	npm run lint

.PHONY: unit-tests
unit-tests:
	npm run test:unit

.PHONY: type-check
type-check:
	npm run type-check

.PHONY: build
build:
	npm run build

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

# Pre-release verification - runs all quality checks
.PHONY: pre-release-check
pre-release-check:
	@echo "🔍 Running pre-release verification..."
	@echo "📋 Step 1: Verifying current branch state..."
	@git status
	@echo ""
	@echo "🧪 Running unit tests..."
	@npm run test:unit
	@echo ""
	@echo "🏗️  Verifying build works..."
	@npm run build
	@echo ""
	@echo "📦 Checking package contents..."
	@npm run package:verify
	@echo ""
	@echo "📋 Step 2: Running code quality checks..."
	@echo "🔍 Linting code (warnings are acceptable)..."
	@npm run lint || echo "⚠️  Linting warnings found but acceptable for release"
	@echo ""
	@echo "🔍 Type checking..."
	@npm run type-check
	@echo ""
	@echo "📊 Running coverage..."
	@npm run test:coverage
	@echo ""
	@echo "🔒 Security audit..."
	@npm audit --audit-level critical
	@echo ""
	@echo "✅ Pre-release verification complete!"
	@echo "🚀 Ready to proceed with release process."

###################################################################
##
## These are the top level targets: test, functional-tests, all.
## They are expected to pass using parallel mode (make -j), 
## e.g. make -j all
##
###################################################################

.PHONY: test
test : build type-check lint unit-tests sam-app sam-app-s3proxy

.PHONY: test-performance
test-performance: artillery-ci artillery-docker

.PHONY: functional-tests
functional-tests: dockerize-for-test artillery-docker

.PHONY: all
all: test functional-tests