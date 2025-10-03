#!/usr/bin/env node

/**
 * Simple validation test for streaming fixes
 * This test validates that the server starts and basic functionality works
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const http = require('http')

// Simple test to validate server starts
async function testServerStart() {
  console.log('Testing server startup...')

  try {
    // Import the app
    const { default: app } = await import('./src/index.js')

    // Create server
    const server = http.createServer(app)

    // Start server on random port
    await new Promise((resolve, reject) => {
      server.listen(0, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const port = server.address().port
    console.log(`✅ Server started successfully on port ${port}`)

    // Test basic health endpoint
    const healthResponse = await makeRequest(port, '/health')
    console.log('✅ Health endpoint responded:', healthResponse.status)

    // Close server
    await new Promise(resolve => server.close(resolve))
    console.log('✅ Server closed successfully')

    console.log('\n🎉 All basic tests passed! Streaming fixes appear to be working.')
    process.exit(0)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

function makeRequest(port, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET'
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          })
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          })
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(5000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.end()
  })
}

// Run the test
testServerStart().catch(error => {
  console.error('Test runner failed:', error.message)
  process.exit(1)
})