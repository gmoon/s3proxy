#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class PerformanceComparator {
  compare(dockerResults, npmResults) {
    const comparison = {
      timestamp: new Date().toISOString(),
      summary: {},
      details: {},
      recommendations: []
    };

    // Compare key metrics
    comparison.summary = {
      responseTime: {
        docker: {
          p50: dockerResults.summary.responseTime.p50,
          p95: dockerResults.summary.responseTime.p95,
          p99: dockerResults.summary.responseTime.p99,
          mean: dockerResults.summary.responseTime.mean
        },
        npm: {
          p50: npmResults.summary.responseTime.p50,
          p95: npmResults.summary.responseTime.p95,
          p99: npmResults.summary.responseTime.p99,
          mean: npmResults.summary.responseTime.mean
        },
        difference: {
          p50: this.calculatePercentageDifference(dockerResults.summary.responseTime.p50, npmResults.summary.responseTime.p50),
          p95: this.calculatePercentageDifference(dockerResults.summary.responseTime.p95, npmResults.summary.responseTime.p95),
          p99: this.calculatePercentageDifference(dockerResults.summary.responseTime.p99, npmResults.summary.responseTime.p99),
          mean: this.calculatePercentageDifference(dockerResults.summary.responseTime.mean, npmResults.summary.responseTime.mean)
        }
      },
      successRate: {
        docker: dockerResults.summary.successRate,
        npm: npmResults.summary.successRate,
        difference: dockerResults.summary.successRate - npmResults.summary.successRate
      },
      totalRequests: {
        docker: dockerResults.summary.totalRequests,
        npm: npmResults.summary.totalRequests
      },
      specialFeatures: {
        rangeRequests: {
          docker: dockerResults.summary.rangeRequestCount,
          npm: npmResults.summary.rangeRequestCount
        },
        specialCharacterRequests: {
          docker: dockerResults.summary.specialCharacterRequestCount,
          npm: npmResults.summary.specialCharacterRequestCount
        },
        healthChecks: {
          docker: dockerResults.summary.healthCheckCount,
          npm: npmResults.summary.healthCheckCount
        }
      }
    };

    // Generate recommendations
    if (Math.abs(comparison.summary.responseTime.difference.p95) > 20) {
      const slower = comparison.summary.responseTime.difference.p95 > 0 ? 'Docker' : 'NPM';
      comparison.recommendations.push(`${slower} shows >20% difference in p95 response times - investigate performance overhead`);
    }
    
    if (Math.abs(comparison.summary.successRate.difference) > 1) {
      const lower = comparison.summary.successRate.difference < 0 ? 'Docker' : 'NPM';
      comparison.recommendations.push(`${lower} has lower success rate - check error handling and configuration`);
    }

    if (comparison.summary.specialFeatures.rangeRequests.docker !== comparison.summary.specialFeatures.rangeRequests.npm) {
      comparison.recommendations.push('Range request counts differ between environments - verify range request handling');
    }

    if (comparison.summary.specialFeatures.specialCharacterRequests.docker !== comparison.summary.specialFeatures.specialCharacterRequests.npm) {
      comparison.recommendations.push('Special character request counts differ - verify URL encoding handling');
    }

    return comparison;
  }

  calculatePercentageDifference(value1, value2) {
    if (value2 === 0) return value1 === 0 ? 0 : 100;
    return ((value1 - value2) / value2) * 100;
  }

  generateReport(comparison) {
    console.log('\n=== S3Proxy Performance Comparison Report ===');
    console.log(`Generated: ${comparison.timestamp}`);
    console.log('\n📊 Response Time Comparison (ms):');
    console.log(`                Docker    NPM      Difference`);
    console.log(`  p50:      ${comparison.summary.responseTime.docker.p50.toFixed(1).padStart(8)} ${comparison.summary.responseTime.npm.p50.toFixed(1).padStart(8)} ${comparison.summary.responseTime.difference.p50.toFixed(1)}%`);
    console.log(`  p95:      ${comparison.summary.responseTime.docker.p95.toFixed(1).padStart(8)} ${comparison.summary.responseTime.npm.p95.toFixed(1).padStart(8)} ${comparison.summary.responseTime.difference.p95.toFixed(1)}%`);
    console.log(`  p99:      ${comparison.summary.responseTime.docker.p99.toFixed(1).padStart(8)} ${comparison.summary.responseTime.npm.p99.toFixed(1).padStart(8)} ${comparison.summary.responseTime.difference.p99.toFixed(1)}%`);
    console.log(`  Mean:     ${comparison.summary.responseTime.docker.mean.toFixed(1).padStart(8)} ${comparison.summary.responseTime.npm.mean.toFixed(1).padStart(8)} ${comparison.summary.responseTime.difference.mean.toFixed(1)}%`);
    
    console.log('\n✅ Success Rate:');
    console.log(`  Docker:   ${comparison.summary.successRate.docker.toFixed(2)}%`);
    console.log(`  NPM:      ${comparison.summary.successRate.npm.toFixed(2)}%`);
    console.log(`  Diff:     ${comparison.summary.successRate.difference.toFixed(2)}%`);
    
    console.log('\n🔧 Feature Testing:');
    console.log(`  Range Requests:        Docker: ${comparison.summary.specialFeatures.rangeRequests.docker}, NPM: ${comparison.summary.specialFeatures.rangeRequests.npm}`);
    console.log(`  Special Char Requests: Docker: ${comparison.summary.specialFeatures.specialCharacterRequests.docker}, NPM: ${comparison.summary.specialFeatures.specialCharacterRequests.npm}`);
    console.log(`  Health Checks:         Docker: ${comparison.summary.specialFeatures.healthChecks.docker}, NPM: ${comparison.summary.specialFeatures.healthChecks.npm}`);
    
    if (comparison.recommendations.length > 0) {
      console.log('\n⚠️  Recommendations:');
      comparison.recommendations.forEach(rec => console.log(`  • ${rec}`));
    } else {
      console.log('\n✅ No significant performance differences detected');
    }
    
    console.log('\n');
  }

  loadResults(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error loading results from ${filePath}:`, error.message);
      process.exit(1);
    }
  }

  findLatestResults(pattern) {
    const files = fs.readdirSync('.')
      .filter(file => file.match(pattern))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      console.error(`No files found matching pattern: ${pattern}`);
      process.exit(1);
    }
    
    return files[0];
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'compare') {
    const comparator = new PerformanceComparator();
    
    let dockerFile, npmFile;
    
    // Parse arguments
    for (let i = 1; i < args.length; i += 2) {
      if (args[i] === '--docker-results') {
        dockerFile = args[i + 1];
      } else if (args[i] === '--npm-results') {
        npmFile = args[i + 1];
      }
    }
    
    // Auto-find latest results if not specified
    if (!dockerFile) {
      dockerFile = comparator.findLatestResults(/test-results-docker-container-\d+\.json/);
      console.log(`Using latest Docker results: ${dockerFile}`);
    }
    
    if (!npmFile) {
      npmFile = comparator.findLatestResults(/test-results-npm-package-\d+\.json/);
      console.log(`Using latest NPM results: ${npmFile}`);
    }
    
    const dockerResults = comparator.loadResults(dockerFile);
    const npmResults = comparator.loadResults(npmFile);
    
    const comparison = comparator.compare(dockerResults, npmResults);
    comparator.generateReport(comparison);
    
    // Save comparison results
    const comparisonFile = `performance-comparison-${Date.now()}.json`;
    fs.writeFileSync(comparisonFile, JSON.stringify(comparison, null, 2));
    console.log(`Detailed comparison saved to: ${comparisonFile}`);
    
  } else {
    console.log('Usage:');
    console.log('  node results-parser.js compare [--docker-results file] [--npm-results file]');
    console.log('');
    console.log('If result files are not specified, the latest files will be used automatically.');
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceComparator;
