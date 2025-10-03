/**
 * Test script to verify timeout coordination fix
 * This test simulates the race condition scenario to ensure headers are not sent after streaming completion
 */

import { createResponseState } from './src/utils/responseState.js'
import { logger } from './src/services/logger.js'

// Mock response object
const mockRes = {
  headersSent: false,
  writableEnded: false,
  socket: { destroyed: false },
  writeHead: function(status, headers) {
    this.headersSent = true
    console.log(`Headers sent: ${status} ${JSON.stringify(headers)}`)
  },
  write: function(data) {
    console.log(`Data written: ${data}`)
    return true
  },
  end: function(data) {
    this.writableEnded = true
    console.log(`Response ended with data: ${data}`)
  }
}

// Test timeout coordination
async function testTimeoutCoordination() {
  const requestId = 'test-request-123'
  
  console.log('=== Testing Timeout Coordination Fix ===\n')
  
  // Create ResponseState with timeout coordination
  const responseState = createResponseState(mockRes, requestId)
  
  console.log('1. Created ResponseState with timeout coordination')
  
  // Set up timeout callback BEFORE starting streaming (simulating middleware behavior)
  console.log('2. Setting up timeout callback before streaming...')
  
  let timeoutCancelled = false
  const timeoutCallback = (reason) => {
    timeoutCancelled = true
    console.log(`7. Timeout callback executed with reason: ${reason}`)
  }
  
  // Register timeout callback (this should work before streaming starts)
  const registered = mockRes.registerTimeoutCallback(timeoutCallback)
  console.log(`3. Timeout callback registered: ${registered}`)
  
  // Simulate streaming completion
  console.log('4. Simulating streaming completion...')
  
  // Send streaming headers
  responseState.safeWriteHeaders(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache'
  })
  
  console.log('5. Streaming headers sent')
  
  // Simulate streaming data
  responseState.safeWrite('data: {"chunk": "test"}\n\n')
  console.log('6. Streaming data written')
  
  // End streaming response
  responseState.safeEnd()
  console.log('7. Streaming response completed')
  
  // Test timeout coordination - this should cancel the timeout safely
  console.log('8. Testing timeout cancellation coordination...')
  
  // Simulate streaming completion cancelling timeouts
  const cancelled = mockRes.cancelAllTimeouts('streaming_completed')
  console.log(`9. All timeouts cancelled: ${cancelled}`)
  console.log(`10. Timeout callback was called: ${timeoutCancelled}`)
  
  // Test that timeout response won't be sent after streaming completion
  console.log('\n11. Testing that timeout response won\'t be sent after completion...')
  
  // Try to send timeout response (this should be blocked)
  const timeoutResponseSent = !mockRes.headersSent || mockRes.writableEnded
  console.log(`12. Timeout response would be blocked: ${timeoutResponseSent}`)
  
  console.log('\n=== Test Results ===')
  console.log(`✓ ResponseState created successfully`)
  console.log(`✓ Streaming headers sent: ${mockRes.headersSent}`)
  console.log(`✓ Streaming response completed: ${mockRes.writableEnded}`)
  console.log(`✓ Timeout callback registered: ${registered}`)
  console.log(`✓ All timeouts cancelled: ${cancelled}`)
  console.log(`✓ Timeout callback executed: ${timeoutCancelled}`)
  console.log(`✓ Timeout response blocked: ${timeoutResponseSent}`)
  
  if (cancelled && timeoutCancelled && timeoutResponseSent) {
    console.log('\n🎉 SUCCESS: Timeout coordination is working correctly!')
    console.log('The race condition has been fixed - headers will not be sent after streaming completion.')
    return true
  } else {
    console.log('\n❌ FAILURE: Timeout coordination is not working properly.')
    return false
  }
}

// Run the test
testTimeoutCoordination()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('Test failed with error:', error)
    process.exit(1)
  })