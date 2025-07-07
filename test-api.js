#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';

// Test cases
const testCases = [
    {
        name: 'Basic URL Test',
        url: '/api/qr?data=example.com&size=300x300',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Text Data Test',
        url: '/api/qr?data=Hello%20World&size=300x300',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Minimum Size Test',
        url: '/api/qr?data=test&size=50x50',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Maximum Size Test',
        url: '/api/qr?data=test&size=2000x2000',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Default Size Test',
        url: '/api/qr?data=test',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Data URL Endpoint Test',
        url: '/api/qr/url?data=test&size=200x200',
        expectedStatus: 200,
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
    }
];

async function runTest(testCase) {
    return new Promise((resolve) => {
        const url = BASE_URL + testCase.url;
        
        http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const result = {
                    name: testCase.name,
                    url: testCase.url,
                    passed: true,
                    errors: []
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
                
                // For successful image responses, check if data is present
                if (testCase.expectedContentType === 'image/png' && res.statusCode === 200) {
                    if (data.length < 100) {
                        result.passed = false;
                        result.errors.push('PNG data seems too small');
                    }
                }
                
                // For JSON responses, try to parse
                if (testCase.expectedContentType === 'application/json' && res.statusCode !== 200) {
                    try {
                        const jsonData = JSON.parse(data);
                        if (!jsonData.error) {
                            result.passed = false;
                            result.errors.push('Expected error field in JSON response');
                        }
                    } catch (e) {
                        result.passed = false;
                        result.errors.push('Invalid JSON response');
                    }
                }
                
                resolve(result);
            });
        }).on('error', (err) => {
            resolve({
                name: testCase.name,
                url: testCase.url,
                passed: false,
                errors: [`HTTP request failed: ${err.message}`]
            });
        });
    });
}

async function runAllTests() {
    console.log('🧪 Starting QRGen API Tests\\n');
    
    const results = [];
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        process.stdout.write(`Running: ${testCase.name}... `);
        
        const result = await runTest(testCase);
        results.push(result);
        
        if (result.passed) {
            console.log('✅ PASSED');
            passed++;
        } else {
            console.log('❌ FAILED');
            result.errors.forEach(error => {
                console.log(`   ⚠️  ${error}`);
            });
            failed++;
        }
    }
    
    console.log('\\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total: ${testCases.length}`);
    
    if (failed === 0) {
        console.log('\\n🎉 All tests passed! QRGen API is working correctly.');
    } else {
        console.log(`\\n⚠️  ${failed} test(s) failed. Please check the issues above.`);
    }
    
    return failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { runAllTests, testCases };
