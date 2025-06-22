import fs from 'fs';

class S3ProxyTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: process.env.TEST_ENVIRONMENT || 'unknown',
      target: null,
      metrics: {
        responseTime: [],
        statusCodes: {},
        healthChecks: [],
        rangeRequests: [],
        specialCharacterRequests: [],
        errorRequests: []
      },
      summary: {}
    };
  }

  // Artillery processor hooks - simplified for load testing only
  beforeRequest(requestParams, context, ee, next) {
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['x-test-run-id'] = context.vars.testRunId || 'unknown';
    requestParams.headers['x-test-environment'] = context.vars.testEnvironment || 'unknown';
    
    if (!this.results.target) {
      this.results.target = requestParams.url;
    }
    
    return next();
  }

  afterResponse(requestParams, response, context, ee, next) {
    const responseTime = response.timings?.end || 0;
    const statusCode = response.statusCode;
    const url = requestParams.url;
    
    // Track basic metrics for load testing
    this.results.metrics.responseTime.push(responseTime);
    this.results.metrics.statusCodes[statusCode] = (this.results.metrics.statusCodes[statusCode] || 0) + 1;
    
    // Track request types
    if (url.includes('/health')) {
      this.results.metrics.healthChecks.push({ responseTime, statusCode, url, timestamp: Date.now() });
    } else if (requestParams.headers?.range) {
      this.results.metrics.rangeRequests.push({ responseTime, statusCode, url, rangeHeader: requestParams.headers.range, timestamp: Date.now() });
    } else if (url.includes('specialCharacters')) {
      this.results.metrics.specialCharacterRequests.push({ responseTime, statusCode, url, timestamp: Date.now() });
    } else if (statusCode >= 400) {
      this.results.metrics.errorRequests.push({ responseTime, statusCode, url, timestamp: Date.now() });
    }
    
    return next();
  }

  calculateSummary() {
    const responseTimes = this.results.metrics.responseTime;
    if (responseTimes.length === 0) return;

    responseTimes.sort((a, b) => a - b);
    
    this.results.summary = {
      totalRequests: responseTimes.length,
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        mean: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
        p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99: responseTimes[Math.floor(responseTimes.length * 0.99)]
      },
      statusCodeDistribution: this.results.metrics.statusCodes,
      healthCheckCount: this.results.metrics.healthChecks.length,
      rangeRequestCount: this.results.metrics.rangeRequests.length,
      specialCharacterRequestCount: this.results.metrics.specialCharacterRequests.length,
      errorRequestCount: this.results.metrics.errorRequests.length,
      successRate: ((this.results.metrics.statusCodes[200] || 0) + (this.results.metrics.statusCodes[206] || 0)) / responseTimes.length * 100
    };
  }

  exportResults() {
    this.calculateSummary();
    
    const resultsFile = `load-test-results-${this.results.environment}-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    
    console.log(`\n=== S3Proxy Load Test Results (${this.results.environment}) ===`);
    console.log(`Total Requests: ${this.results.summary.totalRequests}`);
    console.log(`Success Rate: ${this.results.summary.successRate.toFixed(2)}%`);
    console.log(`Response Time (p95): ${this.results.summary.responseTime.p95}ms`);
    console.log(`Range Requests: ${this.results.summary.rangeRequestCount}`);
    console.log(`Special Character Requests: ${this.results.summary.specialCharacterRequestCount}`);
    console.log(`Health Checks: ${this.results.summary.healthCheckCount}`);
    console.log(`Error Requests: ${this.results.summary.errorRequestCount}`);
    console.log(`Load test results exported to: ${resultsFile}`);
    
    return resultsFile;
  }
}

// Global test runner instance
let testRunner;

export const beforeRequest = (requestParams, context, ee, next) => {
  if (!testRunner) {
    testRunner = new S3ProxyTestRunner();
  }
  return testRunner.beforeRequest(requestParams, context, ee, next);
};

export const afterResponse = (requestParams, response, context, ee, next) => {
  return testRunner.afterResponse(requestParams, response, context, ee, next);
};

export const afterScenario = (context, ee, next) => {
  return next();
};

// Export results when process exits
process.on('exit', () => {
  if (testRunner) {
    testRunner.exportResults();
  }
});

process.on('SIGINT', () => {
  if (testRunner) {
    testRunner.exportResults();
  }
  process.exit(0);
});

// Add the missing functions that the artillery-plugin-metrics-by-endpoint plugin expects
export const metricsByEndpoint_beforeRequest = beforeRequest;
export const metricsByEndpoint_afterResponse = afterResponse;
