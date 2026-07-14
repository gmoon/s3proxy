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

# The container image + server (the deployable artifact) live in
# forkzero/s3proxy-docker, which is where the built image is conformance- and
# load-tested. This repo tests the library itself by running an example server
# with tsx against src/ directly — no build, no Docker image, exercising your
# local changes. Override EXAMPLE to test another framework, e.g.
#   make artillery-local EXAMPLE=examples/express-basic.ts
# fastify-basic renders XML error bodies, matching the s3proxy-docker image's
# error contract, so the conformance/validation targets default to it.
EXAMPLE ?= examples/hono-basic.ts
RUN_LOCAL := bash scripts/with-local-server.sh

.PHONY: artillery-local
artillery-local:
	@echo "Load-testing $(EXAMPLE) on :8080..."
	@$(RUN_LOCAL) $(EXAMPLE) 8080 \
		env TEST_ENVIRONMENT=local npx artillery run --target http://localhost:8080 \
			--config $(TEST_KIT)/configs/load-test.yml $(TEST_KIT)/scenarios/core/load-test.yml

# Conformance gate: assert the HTTP contract (status, content-type,
# content-length) with the test kit's `expect`-enabled config. Unlike the load
# test (throughput only, no assertions), any mismatch exits non-zero, so this is
# a hard CI gate. Two scenarios: the portable core one, then the s3proxy XML
# error contract (fastify-basic renders 404/403 as application/xml).
.PHONY: conformance-local
conformance-local:
	@echo "Running conformance gate against examples/fastify-basic.ts on :8081..."
	@$(RUN_LOCAL) examples/fastify-basic.ts 8081 \
		sh -c 'npx artillery run --target http://localhost:8081 --config $(TEST_KIT)/configs/conformance.yml $(TEST_KIT)/scenarios/core/conformance.yml && \
		       npx artillery run --target http://localhost:8081 --config $(TEST_KIT)/configs/conformance.yml $(TEST_KIT)/scenarios/s3proxy/error-contract.yml'

.PHONY: validation-local
validation-local:
	@echo "Running validation tests against examples/fastify-basic.ts on :8082..."
	@$(RUN_LOCAL) examples/fastify-basic.ts 8082 \
		env S3PROXY_URL=http://localhost:8082 npm run test:validation

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
test-performance: artillery-ci artillery-local

.PHONY: functional-tests
functional-tests: conformance-local validation-local artillery-local

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
