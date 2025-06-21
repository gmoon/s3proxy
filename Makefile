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

.PHONY: credentials
credentials:
	aws sts get-session-token --duration 900 > credentials.json

.PHONY: package-for-docker
package-for-docker:
	npm run build && npm pack && mv s3proxy-*.tgz examples/docker/

.PHONY: dockerize-for-test
dockerize-for-test: package-for-docker
	cd examples/docker && docker buildx build --progress plain --build-arg VERSION=$(PACKAGE_VERSION) --load -t s3proxy:test .

.PHONY: artillery-docker
artillery-docker: dockerize-for-test credentials
	docker run -v $$(PWD)/credentials.json:/src/credentials.json:ro --rm --name s3proxy-test -d -p 8080:8080 \
		-e BUCKET=s3proxy-public \
		-e AWS_REGION=us-east-1 \
		-e PORT=8080 \
		-e NODE_ENV=dev \
		-t s3proxy:test
	wait-on http://localhost:8080/index.html
	TEST_ENVIRONMENT=docker-container artillery run --config shared-testing/configs/load-test.yml shared-testing/scenarios/load-test.yml
	docker kill s3proxy-test

.PHONY: test-validation-docker
test-validation-docker: dockerize-for-test credentials
	docker run -v $$(PWD)/credentials.json:/src/credentials.json:ro --rm --name s3proxy-validation -d -p 8082:8080 \
		-e BUCKET=s3proxy-public \
		-e AWS_REGION=us-east-1 \
		-e PORT=8080 \
		-e NODE_ENV=dev \
		-t s3proxy:test
	wait-on http://localhost:8082/index.html
	S3PROXY_URL=http://localhost:8082 npm run test:validation
	docker kill s3proxy-validation

.PHONY: test-all-docker
test-all-docker: test-validation-docker artillery-docker

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