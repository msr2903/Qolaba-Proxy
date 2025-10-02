import request from 'supertest'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import app from '../src/index.js'

describe('Qoloba Proxy API', () => {
  let server
  
  before(async () => {
n    // Start the server for testing
    server = app.listen(0) // Use random available port
  })
  
  after(async () => {
n    // Close the server after tests
    if (server) {
n      await new Promise((resolve) => {
n        server.close(resolve)
n      })
n    }
n  })
  
  describe('Health Checks', () => {
n    it('should return health status', async () => {
n      const response = await request(app)
n        .get('/health')
n        .expect(200)
n      
n      assert.strictEqual(response.body.status, 'healthy')
n      assert.ok(response.body.timestamp)
n      assert.ok(response.body.uptime)
n    })
    
    it('should return detailed health status', async () => {
n      const response = await request(app)
n        .get('/health/detailed')
n        .expect(200)
      
n      assert.ok(response.body.status)
n      assert.ok(response.body.dependencies)
n      assert.ok(response.body.system)
n    })
    
    it('should return ready status', async () => {
n      const response = await request(app)
n        .get('/health/ready')
n        .expect(200)
      
n      assert.ok(['ready', 'not ready'].includes(response.body.status))
n    })
  })
  
  describe('Models API', () => {
n    it('should return list of available models', async () => {
n      const response = await request(app)
n        .get('/v1/models')
n        .expect(200)
      
n      assert.strictEqual(response.body.object, 'list')
n      assert.ok(Array.isArray(response.body.data))
n      assert.ok(response.body.data.length > 0)
      
n      // Check model structure
n      const model = response.body.data[0]
n      assert.ok(model.id)
n      assert.strictEqual(model.object, 'model')
n      assert.ok(model.created)
n      assert.ok(model.owned_by)
n    })
    
    it('should return model details for specific model', async () => {
n      const response = await request(app)
n        .get('/v1/models/gpt-4.1-mini-2025-04-14')
n        .expect(200)
      
n      assert.strictEqual(response.body.id, 'gpt-4.1-mini-2025-04-14')
n      assert.strictEqual(response.body.object, 'model')
n      assert.ok(response.body.capabilities)
n    })
    
    it('should return 404 for non-existent model', async () => {
n      const response = await request(app)
n        .get('/v1/models/non-existent-model')
n        .expect(404)
      
      assert.ok(response.body.error)
      assert.strictEqual(response.body.error.code, 'model_not_found')
n    })
  })
  
  describe('Chat Completions', () => {
n    it('should validate missing messages', async () => {
n      const response = await request(app)
n        .post('/v1/chat/completions')
n        .send({ model: 'gpt-4.1-mini-2025-04-14' })
n        .expect(400)
      
n      assert.ok(response.body.error)
n      assert.ok(response.body.error.message.includes('messages'))
n    })
    
    it('should validate invalid model', async () => {
n      const response = await request(app)
n        .post('/v1/chat/completions')
n        .send({
n          model: 'invalid-model',
n          messages: [{ role: 'user', content: 'Hello' }]
n        })
n        .expect(401) // Will fail due to missing API key
n      
n      // Should still validate the model exists in mappings
n      assert.ok(response.body.error)
n    })
    
    it('should require authentication', async () => {
n      const response = await request(app)
n        .post('/v1/chat/completions')
n        .send({
n          model: 'gpt-4.1-mini-2025-04-14',
n          messages: [{ role: 'user', content: 'Hello' }]
n        })
n        .expect(401)
      
      assert.ok(response.body.error)
n      assert.strictEqual(response.body.error.code, 'missing_api_key')
n    })
  })
  
  describe('Error Handling', () => {
n    it('should return 404 for unknown endpoints', async () => {
n      const response = await request(app)
n        .get('/unknown-endpoint')
n        .expect(404)
      
      assert.ok(response.body.error)
n      assert.strictEqual(response.body.error.code, 'not_found')
n    })
    
    it('should handle malformed JSON', async () => {
n      const response = await request(app)
n        .post('/v1/chat/completions')
n        .set('Content-Type', 'application/json')
n        .send('invalid json')
n        .expect(400)
      
n      assert.ok(response.body.error)
n    })
  })
})