
import { spawn } from 'child_process'
import { URL } from 'url'

// Test script to verify streaming termination fixes
console.log('🧪 Testing Streaming Termination Fixes...\n')

// Test configuration
const TEST_TIMEOUT = 30000 // 30 seconds
const SERVER_URL = 'http://localhost:3000'

// Test request payload
const testPayload = {
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Say "Hello, this is a streaming test."' }
  ],
  stream: true,
  max_tokens: 50
}

function testStreamingTermination() {
  return new Promise((resolve, reject) => {
    console.log('📡 Sending streaming request...')
    
    const startTime = Date.now()
    let chunks = []
    let isCompleted = false
    
    // Use curl to test streaming
    const curl = spawn('curl', [
      '-X', 'POST',
      `${SERVER_URL}/v1/chat/completions`,
      '-H', 'Content-Type: application/json',
      '-H', 'Authorization: Bearer your-test-api-key-here',
      '-d', JSON.stringify(testPayload),
      '--no-buffer',
      '--max-time', '60'
    ])
    
    let stdout = ''
    let stderr = ''
    
    curl.stdout.on('data', (data) => {
      const chunk = data.toString()
      stdout += chunk
      chunks.push(chunk)
      
      // Log each chunk for debugging
      process.stdout.write('.')
      
      // Check for

      // Check for DONE marker
      if (chunk

      // Check for DONE marker
      if (chunk.includes('[

DONE')) {
        console.log('\\n

✅ Streaming completed - DONE marker received')
        isCompleted = true
        const endTime = Date.now()
        const duration = endTime - startTime
        
        // Analyze results
        console.log(`\\n📊 Results:`)
        console.log(`  Duration: ${duration}ms`)
        console.log(`  Chunks received: ${chunks.length}`)
        console.log(`  Total response length: ${stdout.length} characters`)
      
        
        if (duration < TEST_TIMEOUT) {
          console.log(`✅ SUCCESS: Stream terminated properly within timeout`)
          resolve({ success: true, duration, chunks: chunks.length })
        } else {
          console.log(`❌ FAILED: Stream took too long to terminate`)
          resolve({ success: false, duration, chunks: chunks.length, error: 'timeout' })
        }
      }
    })
    
    curl.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    curl.on('close', (code) => {
      const endTime = Date.now()
      const duration = endTime - startTime
      
      console.log(`\n🏁 Process ended with code: ${code}`)
      console.log(`⏱️ Total duration: ${duration}ms`)
      
      if (!isCompleted) {
        console.log(`❌ FAILED: Stream did not complete properly`)
        resolve({ success: false, duration, chunks: chunks.length, error: 'incomplete' })
      }
    })
    
    // Set overall test timeout
    setTimeout(() => {
      if (!isCompleted) {
        console.log(`\n⏰ TEST TIMEOUT: Killing curl process`)
        curl.kill('SIGTERM')
        resolve({ success: false, duration: TEST_TIMEOUT, chunks: chunks.length, error: 'test_timeout' })
      }
    }, TEST_TIMEOUT)
  })
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting streaming termination tests...\n')
  
  try {
    const result = await testStreamingTermination()
    
    if (result.success) {
      console.log('\n🎉 ALL TESTS PASSED! Streaming termination is working correctly.')
      process.exit(0)
    } else {
      console.log('\n💥 TEST FAILED! Streaming termination is still broken.')
      console.log(`Error: ${result.error}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('\n💥 TEST ERROR:', error.message)
    process.exit(1)
  }
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
}

export { testStreamingTermination }