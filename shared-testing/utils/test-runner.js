const fs = require('fs');
const path = require('path');

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

  // Artillery processor hooks
  beforeRequest(requestParams, context, ee, next) {
    // Add custom headers and tracking
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['x-test-run-id'] = context.vars.testRunId || 'unknown';
    requestParams.headers['x-test-environment'] = context.vars.testEnvironment || 'unknown';
    
    // Store target for results
    if (!this.results.target) {
      this.results.target = requestParams.url;
    }
    
    return next();
  }

  afterResponse(requestParams, response, context, ee, next) {
    const responseTime = response.timings?.end || 0;
    const statusCode = response.statusCode;
    const url = requestParams.url;
    
    // Track overall metrics
    this.results.metrics.responseTime.push(responseTime);
    this.results.metrics.statusCodes[statusCode] = (this.results.metrics.statusCodes[statusCode] || 0) + 1;
    
    // Track specific request types
    if (url.includes('/health')) {
      this.trackHealthCheckMetrics(responseTime, statusCode, url);
    } else if (requestParams.headers?.range) {
      this.trackRangeRequestMetrics(responseTime, statusCode, url, requestParams.headers.range);
    } else if (url.includes('specialCharacters')) {
      this.trackSpecialCharacterMetrics(responseTime, statusCode, url);
    } else if (statusCode >= 400) {
      this.trackErrorMetrics(responseTime, statusCode, url);
    }
    
    return next();
  }

  trackHealthCheckMetrics(responseTime, statusCode, url) {
    this.results.metrics.healthChecks.push({
      responseTime,
      statusCode,
      url,
      timestamp: Date.now()
    });
  }

  trackRangeRequestMetrics(responseTime, statusCode, url, rangeHeader) {
    this.results.metrics.rangeRequests.push({
      responseTime,
      statusCode,
      url,
      rangeHeader,
      timestamp: Date.now()
    });
  }

  trackSpecialCharacterMetrics(responseTime, statusCode, url) {
    this.results.metrics.specialCharacterRequests.push({
      responseTime,
      statusCode,
      url,
      timestamp: Date.now()
    });
  }

  trackErrorMetrics(responseTime, statusCode, url) {
    this.results.metrics.errorRequests.push({
      responseTime,
      statusCode,
      url,
      timestamp: Date.now()
    });
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

  // Export results for comparison
  exportResults() {
    this.calculateSummary();
    
    const resultsFile = `test-results-${this.results.environment}-${Date.now()}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    
    console.log(`\n=== S3Proxy Test Results (${this.results.environment}) ===`);
    console.log(`Total Requests: ${this.results.summary.totalRequests}`);
    console.log(`Success Rate: ${this.results.summary.successRate.toFixed(2)}%`);
    console.log(`Response Time (p95): ${this.results.summary.responseTime.p95}ms`);
    console.log(`Range Requests: ${this.results.summary.rangeRequestCount}`);
    console.log(`Special Character Requests: ${this.results.summary.specialCharacterRequestCount}`);
    console.log(`Health Checks: ${this.results.summary.healthCheckCount}`);
    console.log(`Error Requests: ${this.results.summary.errorRequestCount}`);
    console.log(`Results exported to: ${resultsFile}`);
    
    return resultsFile;
  }
}

// Global test runner instance
let testRunner;

module.exports = {
  beforeRequest: (requestParams, context, ee, next) => {
    if (!testRunner) {
      testRunner = new S3ProxyTestRunner();
    }
    return testRunner.beforeRequest(requestParams, context, ee, next);
  },
  
  afterResponse: (requestParams, response, context, ee, next) => {
    return testRunner.afterResponse(requestParams, response, context, ee, next);
  },
  
  // Export results at the end of test
  afterScenario: (context, ee, next) => {
    return next();
  }
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
