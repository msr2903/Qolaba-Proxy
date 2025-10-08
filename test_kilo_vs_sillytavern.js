import axios from 'axios'

// Test request that mimics Kilo Code style
const kiloCodeRequest = {
  model: 'gpt-4.1-mini-2025-04-14',
  messages: [
    {
      role: 'user',
      content: 'Hello'
    }
  ],
  stream: true,
  temperature: 0.7,
  max_tokens: 100
}

// Test request that mimics SillyTavern style
const sillyTavernRequest = {
  messages: [
    {
      role: 'system',
      content: "Write Assistant's next reply in a fictional chat between Assistant and User."
    },
    {
      role: 'system', 
      content: '[Start a new Chat]'
    },
    {
      role: 'user',
      content: 'hi'
    }
  ],
  model: 'gpt-4.1-mini-2025-04-14',
  temperature: 1,
  max_tokens: 300,
  stream: true,
  presence_penalty: 0,
  frequency_penalty: 0,
  top_p: 1
}

async function testRequest(requestType, requestData) {
  console.log(`\n=== Testing ${requestType} Request ===`)
  console.log('Request:', JSON.stringify(requestData, null, 2))
  
  try {
    const response = await axios.post('http://localhost:3000/v1/chat/completions', requestData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-test-api-key-here',
        'User-Agent': 'test-client'
      },
      timeout: 30000, // 30 second timeout for testing
      responseType: 'stream'
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', response.headers)
    
    let responseText = ''
    response.data.on('data', (chunk) => {
      responseText += chunk.toString()
      process.stdout.write(chunk.toString())
    })
    
    return new Promise((resolve, reject) => {
      response.data.on('end', () => {
        console.log('\n=== Request completed successfully ===')
        resolve({ success: true, responseText })
      })
      
      response.data.on('error', (error) => {
        console.log('\n=== Request failed ===')
        console.log('Error:', error.message)
        reject(error)
      })
    })
    
  } catch (error) {
    console.log('\n=== Request failed with exception ===')
    console.log('Error:', error.message)
    console.log('Code:', error.code)
    if (error.response) {
      console.log('Response status:', error.response.status)
      console.log('Response data:', error.response.data)
    }
    return { success: false, error: error.message }
  }
}

async function runComparison() {
  console.log('Starting Kilo Code vs SillyTavern comparison test...')
  
  // Test Kilo Code style request
  await testRequest('Kilo Code', kiloCodeRequest)
  
  // Wait a bit between requests
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Test SillyTavern style request
  await testRequest('SillyTavern', sillyTavernRequest)
}

runComparison().catch(console.error)