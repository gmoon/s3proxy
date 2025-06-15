# S3Proxy Shared Testing Infrastructure

This directory contains shared load testing configurations and scenarios that can be used by both the npm package and Docker container deployments of s3proxy.

## Structure

```
shared-testing/
├── configs/           # Artillery configuration files
├── scenarios/         # Test scenarios (what to test)
├── utils/            # Shared utilities and processors
├── test-data/        # Test data setup scripts
└── README.md         # This file
```

## Usage

### For npm package testing (s3proxy repo):
```bash
npm run test:load:npm
```

### For Docker container testing (s3proxy-docker repo):
```bash
# Download shared testing configs
curl -L https://github.com/gmoon/s3proxy/archive/main.tar.gz | \
  tar -xz --strip=2 s3proxy-main/shared-testing

# Run tests
artillery run --config shared-testing/configs/docker-container.yml \
              shared-testing/scenarios/basic-load.yml
```

## Test Scenarios

- **basic-load.yml**: Standard load test with mixed workload
- **sustained-load.yml**: Long-running performance test
- **spike-load.yml**: Traffic spike simulation
- **range-requests.yml**: Range request specific tests

## Configurations

- **npm-package.yml**: For testing npm package directly
- **docker-container.yml**: For testing Docker container
- **performance-comparison.yml**: For comparative performance testing

## Test Data Requirements

The following files must exist in your S3 test bucket:
- `index.html` (338 bytes) - Basic HTML file
- `large.bin` (10MB) - Large binary file for streaming tests
- `test1m.tmp` (1MB) - Medium-sized file
- `zerobytefile` (0 bytes) - Empty file
- `unauthorized.html` - File with restricted access (should return 403)
- Special characters file: `specialCharacters!-_.*'()&$@=;:+  ,?\{^}%`]">[~<#|.` - File with special characters in filename for URL encoding tests

Run `./test-data/setup-s3-data.sh` to create these files.

## Environment Variables

- `TEST_ENVIRONMENT`: Identifies the test environment (npm-package, docker-container, etc.)
- `BUCKET`: S3 bucket name for testing
- `AWS_REGION`: AWS region
- `TARGET_URL`: Override target URL for tests

## Results

Test results are exported as JSON files with the pattern:
`test-results-{environment}-{timestamp}.json`

Use `node utils/results-parser.js compare` to compare results between environments.
