import { safeStringify } from '../src/utils/serialization.js';

console.log('🧪 Testing circular reference fix...\n');

// Test 1: Simple object
console.log('Test 1: Simple object');
const simpleObj = { a: 1, b: { c: 2 } };
const result1 = safeStringify(simpleObj);
console.log('✅ Simple object:', result1.length, 'characters\n');

// Test 2: Circular reference object
console.log('Test 2: Object with circular reference');
const circularObj = { a: 1, b: { c: 2 } };
circularObj.self = circularObj;
circularObj.b.parent = circularObj;

try {
  const result2 = safeStringify(circularObj);
  console.log('✅ Circular reference handled safely:', result2.length, 'characters');
  console.log('Result contains "[Circular Reference]":', result2.includes('[Circular Reference]'));
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 3: Simulate TLSSocket circular reference
console.log('\nTest 3: Simulating TLSSocket circular reference');
class MockTLSSocket {
  constructor() {
    this.parser = new MockHTTPParser();
  }
}

class MockHTTPParser {
  constructor() {
    this.socket = null; // Will be set to create circular reference
  }
}

const mockSocket = new MockTLSSocket();
mockSocket.parser.socket = mockSocket; // Create circular reference

try {
  const result3 = safeStringify(mockSocket);
  console.log('✅ TLSSocket circular reference handled safely:', result3.length, 'characters');
  console.log('Result contains "[TLSSocket]":', result3.includes('[TLSSocket]'));
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 4: Compare with native JSON.stringify (should fail)
console.log('\nTest 4: Comparing with native JSON.stringify');
try {
  const nativeResult = JSON.stringify(mockSocket);
  console.log('❌ Native JSON.stringify should have failed but didnt');
} catch (error) {
  console.log('✅ Native JSON.stringify failed as expected:', error.message);
}

console.log('\n🎉 All tests completed!');