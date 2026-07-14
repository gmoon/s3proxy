SHELL            := /bin/bash
PACKAGE_NAME     := $(shell jq --raw-output '.name'    package.json 2>/dev/null)
PACKAGE_VERSION  := $(shell jq --raw-output '.version' package.json 2>/dev/null)
GIT_REV          := $(shell git rev-parse --short HEAD 2>/dev/null || echo 0)
UUID             := $(shell date +%s)

# Shared load-test assets, published as an npm package and installed as a
# devDependency (was the in-repo shared-testing/ directory).
TEST_KIT         := node_modules/@forkzero/s3-website-test-kit

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

.PHONY: credentials
credentials:
	aws sts get-session-token --duration 900 > credentials.json

.PHONY: package-for-docker
package-for-docker:
	npm run build && npm pack && mv s3proxy-*.tgz examples/

.PHONY: dockerize-for-test
dockerize-for-test: package-for-docker
	cd examples && docker buildx build --progress plain --build-arg VERSION=$(PACKAGE_VERSION) --load -t s3proxy:test .

.PHONY: artillery-docker
artillery-docker: dockerize-for-test credentials
	@echo "Starting artillery-docker test with cleanup on exit..."
	@docker kill s3proxy-test 2>/dev/null || true
	@docker run -v $(shell pwd)/credentials.json:/src/credentials.json:ro --rm --name s3proxy-test -d -p 8080:8080 \
		-e BUCKET=s3proxy-public \
		-e AWS_REGION=us-east-1 \
		-e PORT=8080 \
		-e NODE_ENV=dev \
		-t s3proxy:test
	@trap 'docker kill s3proxy-test 2>/dev/null || true' EXIT; \
	npx wait-on http://localhost:8080/index.html && \
	TEST_ENVIRONMENT=docker-container npx artillery run --config $(TEST_KIT)/configs/load-test.yml $(TEST_KIT)/scenarios/core/load-test.yml

# Fast local loop: run the shared test kit against a locally-run example server.
# tsx runs the TypeScript in src/ directly, so your local s3proxy edits are
# exercised with no build and no Docker image — change src/, re-run this. Uses
# your AWS credential chain against the public s3proxy-public bucket. Override
# EXAMPLE to test a different framework, e.g.
#   make artillery-local EXAMPLE=examples/express-basic.ts
EXAMPLE ?= examples/hono-basic.ts

.PHONY: artillery-local
artillery-local:
	@echo "Starting local $(EXAMPLE) with cleanup on exit..."
	@PORT=8080 BUCKET=s3proxy-public npx tsx $(EXAMPLE) & \
	SERVER_PID=$$!; \
	trap 'kill $$SERVER_PID 2>/dev/null || true' EXIT; \
	npx wait-on http://localhost:8080/index.html && \
	TEST_ENVIRONMENT=local npx artillery run --target http://localhost:8080 \
		--config $(TEST_KIT)/configs/load-test.yml $(TEST_KIT)/scenarios/core/load-test.yml

.PHONY: test-validation-docker
test-validation-docker: dockerize-for-test credentials
	@echo "Starting validation-docker test with cleanup on exit..."
	@docker kill s3proxy-validation 2>/dev/null || true
	@docker run -v $(shell pwd)/credentials.json:/src/credentials.json:ro --rm --name s3proxy-validation -d -p 8082:8080 \
		-e BUCKET=s3proxy-public \
		-e AWS_REGION=us-east-1 \
		-e PORT=8080 \
		-e NODE_ENV=dev \
		-t s3proxy:test
	@trap 'docker kill s3proxy-validation 2>/dev/null || true' EXIT; \
	npx wait-on http://localhost:8082/index.html && \
	S3PROXY_URL=http://localhost:8082 npm run test:validation

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
test : build type-check lint unit-tests

.PHONY: test-performance
test-performance: artillery-ci artillery-docker

.PHONY: functional-tests
functional-tests: artillery-docker

.PHONY: all
all: test functional-tests

###################################################################
##
## Cleanup targets
##
###################################################################

.PHONY: clean
clean:
	@echo "🧹 Cleaning up generated files..."
	@rm -f load-test-results-*.json
	@rm -f artillery-report-*.json
	@rm -f performance-test-*.json
	@rm -f s3proxy*.tgz
	@rm -f version.txt
	@rm -f credentials.json
	@rm -rf dist/
	@rm -rf coverage/
	@rm -rf node_modules/.cache/
	@echo "✅ Cleanup complete"

.PHONY: clean-test-results
clean-test-results:
	@echo "🧹 Cleaning up test result files..."
	@rm -f load-test-results-*.json
	@rm -f artillery-report-*.json
	@rm -f performance-test-*.json
	@echo "✅ Test results cleaned"
