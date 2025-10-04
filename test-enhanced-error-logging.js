import { logDetailedError, logResponseState, logHeaderOperation } from './src/services/logger.js'
import { createResponseManager } from './src/utils/responseManager.js'

// Test function to validate the enhanced error logging system
async function testEnhancedErrorLogging() {
  console.log('🧪 Testing Enhanced Error Logging System...\n')
  
  // Test 1: Basic detailed error logging
  console.log('📝 Test 1: Basic detailed error logging')
  try {
    throw new Error('Test error for detailed logging')
  } catch (error) {
    logDetailedError(error, {
      requestId: 'test-request-001',
      method: 'POST',
      url: '/v1/chat/completions',
      ip: '127.0.0.1',
      responseState: {
        headersSent: false,
        ended: false,
        writable: true
      },
      additionalInfo: {
        testType: 'basic_error_logging',
        component: 'test_script'
      }
    })
  }
  
  // Test 2: Response state logging
  console.log('📊 Test 2: Response state logging')
  logResponseState('test-request-002', 'test_state_change', {
    headersSent: true,
    responseEnded: false,
    writable: true
  })
  
  // Test 3: Header operation logging
  console.log('🔧 Test 3: Header operation logging')
  try {
    throw new Error('Cannot set headers after they are sent')
  } catch (error) {
    logHeaderOperation('test-request-003', 'writeHead', false, error)
  }
  
  // Test 4: Response Manager error simulation
  console.log('🎯 Test 4: Response Manager error simulation')
  try {
    // Create a mock response object
    const mockRes = {
      headersSent: false,
      writableEnded: false,
      writable: true,
      end: function() {
        throw new Error('Response already ended')
      },
      writeHead: function() {
        throw new Error('Headers already sent')
      }
    }
    
    const responseManager = createResponseManager(mockRes, 'test-request-004')
    
    // Try to trigger an error by calling end twice
    mockRes.end()
    mockRes.end() // This should trigger the error logging
  } catch (error) {
    logDetailedError(error, {
      requestId: 'test-request-004',
      method: 'POST',
      url: '/v1/chat/completions',
      responseState: {
        headersSent: true,
        ended: true,
        writable: false
      },
      additionalInfo: {
        testType: 'response_manager_error',
        component: 'test_script'
      }
    })
  }
  
  // Test 5: Complex error with stack trace analysis
  console.log('🔍 Test 5: Complex error with stack trace analysis')
  function deepFunction1() {
    deepFunction2()
  }
  
  function deepFunction2() {
    deepFunction3()
  }
  
  function deepFunction3() {
    throw new Error('Deep function call error')
  }
  
  try {
    deepFunction1()
  } catch (error) {
    logDetailedError(error, {
      requestId: 'test-request-005',
      method: 'GET',
      url: '/api/test',
      ip: '192.168.1.100',
      responseState: {
        headersSent: false,
        ended: false,
        writable: true
      },
      additionalInfo: {
        testType: 'deep_stack_trace',
        component: 'test_script',
        callDepth: 3
      }
    })
  }
  
  // Test 6: Timeout error simulation
  console.log('⏰ Test 6: Timeout error simulation')
  const timeoutError = new Error('Request timeout')
  timeoutError.code = 'ETIMEDOUT'
  timeoutError.statusCode = 408
  
  logDetailedError(timeoutError, {
    requestId: 'test-request-006',
    method: 'POST',
    url: '/v1/chat/completions',
    responseState: {
      headersSent: true,
      ended: false,
      writable: true
    },
    additionalInfo: {
      testType: 'timeout_error',
      component: 'test_script',
      timeoutDuration: '30000ms'
    }
  })
  
  // Test 7: Headers already sent error (the main issue we're debugging)
  console.log('🚫 Test 7: Headers already sent error (main issue)')
  const headersError = new Error('Cannot set headers after they are sent to the client')
  headersError.code = 'ERR_HTTP_HEADERS_SENT'
  
  logDetailedError(headersError, {
    requestId: 'test-request-007',
    method: 'POST',
    url: '/v1/chat/completions',
    ip: '10.0.0.1',
    responseState: {
      headersSent: true,
      ended: false,
      writable: true
    },
    additionalInfo: {
      testType: 'headers_already_sent',
      component: 'test_script',
      operation: 'writeHead',
      previousOperation: 'streaming_response'
    }
  })
  
  console.log('\n✅ Enhanced Error Logging Tests Completed!')
  console.log('📁 Check the following files for detailed logs:')
  console.log('   - errors.log (enhanced detailed error logs)')
  console.log('   - logs/error.log (standard error logs)')
  console.log('   - logs/combined.log (combined logs)')
}

// Run the test
testEnhancedErrorLogging().catch(console.error)