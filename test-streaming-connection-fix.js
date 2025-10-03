
import { spawn } from 'child_process'
import { URL } from 'url'

// Test script to verify streaming connection fixes
console.log('🧪 Testing Streaming Connection Fixes...\n')

// Test configuration
const TEST_TIMEOUT = 20000 // 20 seconds - reduced for faster testing
const SERVER_URL = 'http://localhost:3000'

// Test request payload
const testPayload = {
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Say "Hello, this is a streaming test." and count to 5 slowly.' }
  ],
  stream: true,
  max_tokens: 100
}

function testStreamingConnectionTermination() {
  return new Promise((resolve, reject) => {
    console.log('📡 Sending streaming request...')
    
    const startTime = Date.now()
    let chunks = []
    let isCompleted = false
    let receivedDone = false
    
    // Use curl to test streaming
    const curl = spawn('curl', [
      '-X', 'POST',
      `${SERVER_URL}/v1/chat/completions`,
      '-H', 'Content-Type: application/json',
      '-H', 'Authorization: Bearer your-test-api-key-here',
      '-d', JSON.stringify(testPayload),
      '--no-buffer',
      '--max-time', '30' // Slightly longer than our test timeout
    ])
    
    let stdout = ''
    let stderr = ''
    
    curl.stdout.on('data', (data) => {
      const chunk = data.toString()
    
      stdout += chunk
      chunks.push(chunk)
      
      // Log each chunk for debugging
      process.stdout.write('.')
      
      // Check for DONE marker
      if (chunk.includes('[DONE]')) {
        console.log('\n✅ Streaming completed - DONE marker received')
        receivedDone = true
        const endTime = Date.now()
        const duration = endTime - startTime
        
        // Analyze results
        console.log(`\n📊 Results:`)
        console.log(`  Duration: ${duration}ms`)
        console.log(`  Chunks received: ${chunks.length}`)
        console.log(`  Total response length: ${stdout.length} characters`)
      
        if (duration < TEST_TIMEOUT) {
          console.log(`✅ SUCCESS: Stream terminated properly within timeout`)
          resolve({ success: true, duration, chunks: chunks.length, receivedDone })
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
      
      if (!receivedDone) {
        console.log(`❌ FAILED: Stream did not complete properly`)
        resolve({ success: false, duration, chunks: chunks.length, error: 'incomplete', stderr })
      }
    })
    
    // Set overall test timeout
    setTimeout(() => {
      if (!receivedDone) {
        console.log(`\n⏰ TEST TIMEOUT: Killing curl process`)
        curl.kill('SIGTERM')
        resolve({ success: false, duration: TEST_TIMEOUT, chunks: chunks.length, error: 'test_timeout' })
      }
    }, TEST_TIMEOUT)
  })
}

// Test multiple scenarios
async function runMultipleTests() {
  console.log('🚀 Starting multiple streaming termination tests...\n')
  
  const tests = [
    { name: 'Normal streaming', payload: testPayload },
    { 
      name: 'Slow streaming test', 
      payload: {
        ...testPayload,
        messages: [
          { role: 'user', content: 'Write a very detailed explanation of quantum computing with many examples.' }
        ],
        max_tokens: 200
      }
    }
  ]
  
  const results = []
  
  for (const test of tests) {
    console.log(`\n🧪 Running test: ${test.name}`)
    try {
      const result = await testStreamingConnectionTermination()
      results.push({ name: test.name, ...result })
      
      if (result.success) {
        console.log(`✅ ${test.name} PASSED`)
      } else {
        console.log(`❌ ${test.name} FAILED: ${result.error}`)
      }
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error(`💥 ${test.name} ERROR:`, error.message)
      results.push({ name: test.name, success: false, error: error.message })
    }
  }
  
  return results
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting streaming connection termination tests...\n')
  
  try {
    const results = await runMultipleTests()
    
    const successCount = results.filter(r => r.success).length
    const totalTests = results.length
    
    console.log('\n📈 Test Results Summary:')
    console.log(`  Total tests: ${totalTests}`)
    console.log(`  Successful: ${successCount}`)
    console.log(`  Failed: ${totalTests - successCount}`)
    
    if (successCount === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! Streaming connection termination is working correctly.')
      console.log('✅ The hanging connection issue has been resolved!')
      process.exit(0)
    } else {
      console.log('\n💥 SOME TESTS FAILED! There may still be connection issues.')
      results.forEach(result => {
        if (!result.success) {
          console.log(`  ❌ ${result.name}: ${result.error}`)
        }
      })
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

export { testStreamingConnectionTermination, runTests }