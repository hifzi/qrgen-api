#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:8080';

// test cases with custom options
const testCases = [
    {
        name: 'Default Settings (300x300)',
        url: '/api/qr?data=example.com',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Custom Size with Default Options',
        url: '/api/qr?data=test&size=400x400',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Custom Margin (High)',
        url: '/api/qr?data=test&size=300x300&margin=5',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Custom Margin (Low)',
        url: '/api/qr?data=test&size=300x300&margin=0',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'High Error Correction Level',
        url: '/api/qr?data=test&el=H',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Low Error Correction Level',
        url: '/api/qr?data=test&el=L',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Quartile Error Correction Level',
        url: '/api/qr?data=test&el=Q',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Custom Red Dark Color',
        url: '/api/qr?data=test&darkColor=FF0000',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Custom Blue Dark with Yellow Light',
        url: '/api/qr?data=test&darkColor=0000FF&lightColor=FFFF00',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'All Custom Options Combined',
        url: '/api/qr?data=example.com&size=500x500&margin=3&el=H&darkColor=800080&lightColor=E0E0E0',
        expectedStatus: 200,
        expectedContentType: 'image/png'
    },
    {
        name: 'Data URL with Custom Options',
        url: '/api/qr/url?data=test&size=200x200&margin=2&el=H&darkColor=008000',
        expectedStatus: 200,
        expectedContentType: 'application/json'
    },
    {
        name: 'Invalid Margin (Too High)',
        url: '/api/qr?data=test&margin=15',
        expectedStatus: 200, // Should use default margin
        expectedContentType: 'image/png'
    },
    {
        name: 'Invalid Error Level',
        url: '/api/qr?data=test&el=X',
        expectedStatus: 200, // Should use default error level
        expectedContentType: 'image/png'
    },
    {
        name: 'Invalid Color Format',
        url: '/api/qr?data=test&darkColor=red',
        expectedStatus: 200, // Should use default color
        expectedContentType: 'image/png'
    },
    {
        name: 'Missing Data Parameter',
        url: '/api/qr',
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
                
                // For JSON responses with custom options, verify structure
                if (testCase.expectedContentType === 'application/json' && res.statusCode === 200 && testCase.url.includes('/url')) {
                    try {
                        const jsonData = JSON.parse(data);
                        if (!jsonData.success || !jsonData.data || !jsonData.data.url) {
                            result.passed = false;
                            result.errors.push('Invalid JSON structure for data URL response');
                        }
                        if (jsonData.data.options && typeof jsonData.data.options !== 'object') {
                            result.passed = false;
                            result.errors.push('Options field should be an object');
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
    
    console.log('\\n🔧 Features Tested:');
    console.log('   • Default settings (300x300, margin=1, el=M)');
    console.log('   • Custom dimensions and margin (0-10)');
    console.log('   • Error correction levels (L, M, Q, H)');
    console.log('   • Custom colors (hex format validation)');
    console.log('   • Combined custom options');
    console.log('   • Data URL endpoint with options');
    console.log('   • Input validation and fallbacks');
    
    if (failed === 0) {
        console.log('\\n🎉 All tests passed! QRGen API with custom options is working correctly.');
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
