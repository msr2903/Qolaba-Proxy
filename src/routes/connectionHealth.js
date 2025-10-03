import express from 'express'
import { QolabaApiClient } from '../services/qolaba.js'
import { logger } from '../services/logger.js'
import { config } from '../config/index.js'

const router = express.Router()

// GET /v1/health/connections - Connection health monitoring
router.get('/connections', async (req, res) => {
  try {
    const startTime = Date.now()

    // Create a test client to check connection health
    const testClient = new QolabaApiClient('test-key')

    // Get connection health status
    const connectionHealth = testClient.getConnectionHealth()

    // Try to get status from Qolaba API
    let qolabaStatus = null
    let qolabaResponseTime = null

    try {
      const qolabaStart = Date.now()
      qolabaStatus = await testClient.getStatus()
      qolabaResponseTime = Date.now() - qolabaStart
    } catch (error) {
      logger.warn('Qolaba API health check failed', {
        error: error.message,
        responseTime: Date.now() - startTime
      })
      qolabaStatus = { status: 'error', error: error.message }
    }

    const totalResponseTime = Date.now() - startTime

    const healthResponse = {
      status: connectionHealth.isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      responseTime: `${totalResponseTime}ms`,
      connections: {
        successRate: `${connectionHealth.successRate}%`,
        totalRequests: connectionHealth.totalRequests,
        failedRequests: connectionHealth.failedRequests,
        consecutiveFailures: connectionHealth.consecutiveFailures,
        lastError: connectionHealth.lastError,
        lastErrorTime: connectionHealth.lastErrorTime
      },
      qolaba: {
        baseUrl: config.qolaba.baseUrl,
        status: qolabaStatus,
        responseTime: qolabaResponseTime ? `${qolabaResponseTime}ms` : 'failed'
      },
      system: {
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    }

    // Set appropriate status code
    const statusCode = connectionHealth.isHealthy ? 200 : 503

    res.status(statusCode).json(healthResponse)

  } catch (error) {
    logger.error('Connection health check failed', {
      error: error.message,
      stack: error.stack
    })

    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message
    })
  }
})

// GET /v1/health/reset - Reset connection health tracking
router.post('/reset', (req, res) => {
  try {
    const testClient = new QolabaApiClient('test-key')
    testClient.resetConnectionHealth()

    logger.info('Connection health tracking reset')

    res.json({
      status: 'success',
      message: 'Connection health tracking reset',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Failed to reset connection health', {
      error: error.message
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to reset connection health',
      error: error.message
    })
  }
})

export default router