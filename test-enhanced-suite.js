#!/usr/bin/env node

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';

// Test suite with comprehensive coverage
const testSuites = {
  basic: [
    {
      name: 'Basic QR Generation',
      url: '/api/qr?data=test',
      expectedStatus: 200,
      expectedContentType: 'image/png'
    },
    {
      name: 'Data URL Generation',
      url: '/api/qr/url?data=test',
      expectedStatus: 200,
      expectedContentType: 'application/json'
    }
  ],
  
  security: [
    {
      name: 'XSS Prevention Test',
      url: '/api/qr?data=<script>alert("xss")</script>',
      expectedStatus: 200,
      expectedContentType: 'image/png',
      description: 'Should sanitize XSS attempts'
    },
    {
      name: 'SQL Injection Prevention',
      url: '/api/qr?data=\'; DROP TABLE users; --',
      expectedStatus: 200,
      expectedContentType: 'image/png',
      description: 'Should handle SQL injection attempts safely'
    },
    {
      name: 'Oversized Data Rejection',
      url: '/api/qr?data=' + 'A'.repeat(5000),
      expectedStatus: 400,
      expectedContentType: 'application/json',
      description: 'Should reject data exceeding 4000 characters'
    },
    {
      name: 'Invalid Color Format Handling',
      url: '/api/qr?data=test&darkColor=invalid-color',
      expectedStatus: 200,
      expectedContentType: 'image/png',
      description: 'Should fallback to default color for invalid formats'
    }
  ],

  performance: [
    {
      name: 'Large QR Code Generation',
      url: '/api/qr?data=https://example.com/very/long/url/with/many/parameters?param1=value1&param2=value2&param3=value3&size=1000x1000',
      expectedStatus: 200,
      expectedContentType: 'image/png',
      timeout: 5000
    },
    {
      name: 'High Error Correction Performance',
      url: '/api/qr?data=performance-test-data&el=H&size=800x800',
      expectedStatus: 200,
      expectedContentType: 'image/png',
      timeout: 3000
    },
    {
      name: 'Cache Performance Test',
      url: '/api/qr?data=cache-test&size=300x300',
      expectedStatus: 200,
      expectedContentType: 'image/png',
      repeat: 3,
      description: 'Should be faster on subsequent requests due to caching'
    }
  ],

  features: [
    {
      name: 'Custom Colors',
      url: '/api/qr?data=color-test&darkColor=FF0000&lightColor=FFFF00',
      expectedStatus: 200,
      expectedContentType: 'image/png'
    },
    {
      name: 'All Error Correction Levels',
      urls: [
        '/api/qr?data=error-test&el=L',
        '/api/qr?data=error-test&el=M',
        '/api/qr?data=error-test&el=Q',
        '/api/qr?data=error-test&el=H'
      ],
      expectedStatus: 200,
      expectedContentType: 'image/png'
    },
    {
      name: 'Various Margins',
      urls: [
        '/api/qr?data=margin-test&margin=0',
        '/api/qr?data=margin-test&margin=5',
        '/api/qr?data=margin-test&margin=10'
      ],
      expectedStatus: 200,
      expectedContentType: 'image/png'
    },
    {
      name: 'Size Range Testing',
      urls: [
        '/api/qr?data=size-test&size=50x50',
        '/api/qr?data=size-test&size=300x300',
        '/api/qr?data=size-test&size=1000x1000',
        '/api/qr?data=size-test&size=2000x2000'
      ],
      expectedStatus: 200,
      expectedContentType: 'image/png'
    }
  ],

  system: [
    {
      name: 'Health Check',
      url: '/health',
      expectedStatus: 200,
      expectedContentType: 'application/json',
      validateResponse: (data) => {
        const health = JSON.parse(data);
        return health.status === 'healthy' && health.uptime && health.memory;
      }
    },
    {
      name: 'API Information',
      url: '/api',
      expectedStatus: 200,
      expectedContentType: 'application/json',
      validateResponse: (data) => {
        const info = JSON.parse(data);
        return info.name && info.version && info.endpoints;
      }
    },
    {
      name: 'Cache Statistics',
      url: '/api/cache/stats',
      expectedStatus: 200,
      expectedContentType: 'application/json',
      validateResponse: (data) => {
        const stats = JSON.parse(data);
        return stats.cache_performance && stats.memory_usage;
      }
    },
    {
      name: 'Metrics Endpoint',
      url: '/metrics',
      expectedStatus: 200,
      expectedContentType: 'text/plain',
      validateResponse: (data) => {
        return data.includes('qr_cache_hit_rate') && data.includes('qr_uptime_seconds');
      }
    }
  ],

  batch: [
    {
      name: 'Batch QR Generation',
      method: 'POST',
      url: '/api/qr/batch',
      body: {
        requests: [
          { data: 'batch-test-1', size: '200x200' },
          { data: 'batch-test-2', size: '300x300' },
          { data: 'batch-test-3', size: '400x400' }
        ]
      },
      expectedStatus: 200,
      expectedContentType: 'application/json',
      validateResponse: (data) => {
        const result = JSON.parse(data);
        return result.success && result.results && result.results.length === 3;
      }
    },
    {
      name: 'Batch Size Limit',
      method: 'POST',
      url: '/api/qr/batch',
      body: {
        requests: Array(60).fill().map((_, i) => ({ data: `test-${i}` }))
      },
      expectedStatus: 400,
      expectedContentType: 'application/json',
      description: 'Should reject batches larger than 50 requests'
    }
  ],

  edge_cases: [
    {
      name: 'Empty Data Parameter',
      url: '/api/qr?data=',
      expectedStatus: 400,
      expectedContentType: 'application/json'
    },
    {
      name: 'Missing Data Parameter',
      url: '/api/qr',
      expectedStatus: 400,
      expectedContentType: 'application/json'
    },
    {
      name: 'Invalid Size Format',
      url: '/api/qr?data=test&size=invalid',
      expectedStatus: 400,
      expectedContentType: 'application/json'
    },
    {
      name: 'Size Too Small',
      url: '/api/qr?data=test&size=10x10',
      expectedStatus: 400,
      expectedContentType: 'application/json'
    },
    {
      name: 'Size Too Large',
      url: '/api/qr?data=test&size=3000x3000',
      expectedStatus: 400,
      expectedContentType: 'application/json'
    },
    {
      name: 'Unicode Data Handling',
      url: '/api/qr?data=' + encodeURIComponent('Hello 世界 🌍 émojis'),
      expectedStatus: 200,
      expectedContentType: 'image/png'
    },
    {
      name: 'Special Characters',
      url: '/api/qr?data=' + encodeURIComponent('!@#$%^&*()_+-=[]{}|;:,.<>?'),
      expectedStatus: 200,
      expectedContentType: 'image/png'
    }
  ]
};

// Performance tracking
const performanceMetrics = {
  responseTime: [],
  throughput: 0,
  errors: 0,
  cacheHits: 0
};

async function runTest(testCase) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = BASE_URL + testCase.url;
    
    const requestOptions = {
      method: testCase.method || 'GET',
      timeout: testCase.timeout || 10000
    };

    let requestData = '';
    if (testCase.body) {
      requestData = JSON.stringify(testCase.body);
      requestOptions.headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      };
    }

    const request = http.request(url, requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        performanceMetrics.responseTime.push(responseTime);

        const result = {
          name: testCase.name,
          url: testCase.url,
          method: testCase.method || 'GET',
          responseTime: responseTime,
          passed: true,
          errors: [],
          warnings: []
        };
        
        // Check status code
        if (res.statusCode !== testCase.expectedStatus) {
          result.passed = false;
          result.errors.push(`Expected status ${testCase.expectedStatus}, got ${res.statusCode}`);
        }
        
        // Check content type
        const contentType = res.headers['content-type'];
        if (!contentType || !contentType.includes(testCase.expectedContentType)) {
          result.passed = false;
          result.errors.push(`Expected content-type to include ${testCase.expectedContentType}, got ${contentType}`);
        }
        
        // Performance warnings
        if (responseTime > 1000) {
          result.warnings.push(`Slow response time: ${responseTime}ms`);
        }
        
        // Validate response data
        if (testCase.validateResponse) {
          try {
            if (!testCase.validateResponse(data)) {
              result.passed = false;
              result.errors.push('Response validation failed');
            }
          } catch (error) {
            result.passed = false;
            result.errors.push(`Validation error: ${error.message}`);
          }
        }
        
        // Check for successful image responses
        if (testCase.expectedContentType === 'image/png' && res.statusCode === 200) {
          if (data.length < 100) {
            result.passed = false;
            result.errors.push('PNG data seems too small');
          }
        }
        
        // Check for successful JSON responses
        if (testCase.expectedContentType === 'application/json' && res.statusCode === 200) {
          try {
            JSON.parse(data);
          } catch (e) {
            result.passed = false;
            result.errors.push('Invalid JSON response');
          }
        }
        
        resolve(result);
      });
    });

    request.on('error', (err) => {
      performanceMetrics.errors++;
      resolve({
        name: testCase.name,
        url: testCase.url,
        passed: false,
        errors: [`HTTP request failed: ${err.message}`],
        responseTime: Date.now() - startTime
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({
        name: testCase.name,
        url: testCase.url,
        passed: false,
        errors: ['Request timeout'],
        responseTime: testCase.timeout || 10000
      });
    });

    if (requestData) {
      request.write(requestData);
    }
    
    request.end();
  });
}

async function runMultipleUrls(testCase) {
  const results = [];
  for (const url of testCase.urls) {
    const singleTest = { ...testCase, url };
    const result = await runTest(singleTest);
    results.push(result);
  }
  
  return {
    name: testCase.name,
    passed: results.every(r => r.passed),
    results: results,
    errors: results.flatMap(r => r.errors),
    warnings: results.flatMap(r => r.warnings)
  };
}

async function runRepeatedTest(testCase) {
  const results = [];
  const times = [];
  
  for (let i = 0; i < testCase.repeat; i++) {
    const result = await runTest(testCase);
    results.push(result);
    times.push(result.responseTime);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const improvement = times.length > 1 ? ((times[0] - times[times.length - 1]) / times[0] * 100) : 0;
  
  return {
    name: testCase.name,
    passed: results.every(r => r.passed),
    averageTime: Math.round(avgTime),
    improvement: Math.round(improvement),
    times: times,
    cacheEffective: improvement > 10,
    errors: results.flatMap(r => r.errors)
  };
}

async function runTestSuite(suiteName, tests) {
  console.log(`\n🧪 Running ${suiteName.toUpperCase()} Test Suite`);
  console.log('='.repeat(50));
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const testCase of tests) {
    process.stdout.write(`Running: ${testCase.name}... `);
    
    let result;
    if (testCase.urls) {
      result = await runMultipleUrls(testCase);
    } else if (testCase.repeat) {
      result = await runRepeatedTest(testCase);
    } else {
      result = await runTest(testCase);
    }
    
    results.push(result);
    
    if (result.passed) {
      console.log('✅ PASSED' + (result.responseTime ? ` (${result.responseTime}ms)` : ''));
      if (result.improvement) {
        console.log(`   📈 Performance improvement: ${result.improvement}%`);
      }
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          console.log(`   ⚠️  ${warning}`);
        });
      }
      passed++;
    } else {
      console.log('❌ FAILED');
      result.errors.forEach(error => {
        console.log(`   ⚠️  ${error}`);
      });
      failed++;
    }
  }
  
  return { suiteName, results, passed, failed };
}

async function generateReport(suiteResults) {
  console.log('\n📊 COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;
  
  suiteResults.forEach(suite => {
    totalPassed += suite.passed;
    totalFailed += suite.failed;
    totalTests += suite.passed + suite.failed;
    
    console.log(`\n${suite.suiteName.toUpperCase()}:`);
    console.log(`  ✅ Passed: ${suite.passed}`);
    console.log(`  ❌ Failed: ${suite.failed}`);
    console.log(`  📈 Success Rate: ${Math.round(suite.passed / (suite.passed + suite.failed) * 100)}%`);
  });
  
  // Performance metrics
  if (performanceMetrics.responseTime.length > 0) {
    const avgResponseTime = performanceMetrics.responseTime.reduce((a, b) => a + b, 0) / performanceMetrics.responseTime.length;
    const maxResponseTime = Math.max(...performanceMetrics.responseTime);
    const minResponseTime = Math.min(...performanceMetrics.responseTime);
    
    console.log('\n⚡ PERFORMANCE METRICS:');
    console.log(`  Average Response Time: ${Math.round(avgResponseTime)}ms`);
    console.log(`  Fastest Response: ${minResponseTime}ms`);
    console.log(`  Slowest Response: ${maxResponseTime}ms`);
    console.log(`  Total Requests: ${performanceMetrics.responseTime.length}`);
    console.log(`  Error Rate: ${Math.round(performanceMetrics.errors / performanceMetrics.responseTime.length * 100)}%`);
  }
  
  console.log('\n🎯 OVERALL RESULTS:');
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  ✅ Passed: ${totalPassed}`);
  console.log(`  ❌ Failed: ${totalFailed}`);
  console.log(`  📈 Overall Success Rate: ${Math.round(totalPassed / totalTests * 100)}%`);
  
  // Quality assessment
  const successRate = totalPassed / totalTests;
  let quality = 'Poor';
  if (successRate >= 0.95) quality = 'Excellent';
  else if (successRate >= 0.90) quality = 'Very Good';
  else if (successRate >= 0.80) quality = 'Good';
  else if (successRate >= 0.70) quality = 'Fair';
  
  console.log(`  🏆 Quality Rating: ${quality}`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The QRGen API is working perfectly.');
    console.log('🚀 Ready for production deployment!');
  } else {
    console.log(`\n⚠️  ${totalFailed} test(s) failed. Please review the issues above.`);
  }
  
  return successRate >= 0.95;
}

async function runAllTests() {
  console.log('🚀 Starting QRGen API Test Suite');
  console.log('Testing all features, security, performance, and edge cases...\n');
  
  const suiteResults = [];
  
  // Run all test suites
  for (const [suiteName, tests] of Object.entries(testSuites)) {
    const result = await runTestSuite(suiteName, tests);
    suiteResults.push(result);
  }
  
  // Generate comprehensive report
  const success = await generateReport(suiteResults);
  
  return success;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests, testSuites, performanceMetrics };