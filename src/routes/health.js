import express from 'express'
import { logger } from '../services/logger.js'
import { config } from '../config/index.js'

const router = express.Router()

// GET /health - Basic health check
router.get('/', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'qoloba-proxy',
      environment: config.server.nodeEnv
    }

    res.json(healthCheck)
  } catch (error) {
    logger.error('Health check failed', {
      requestId: req.id,
      error: error.message
    })

    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// GET /health/detailed - Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now()
    
    // Check Qolaba API connectivity
    let qolabaStatus = 'unhealthy'
    let qolabaResponseTime = 0
    
    try {
      const testClient = new (await import('../services/qolaba.js')).QolabaApiClient(config.qolaba.testApiKey)
      const start = Date.now()
      await testClient.getModels()
      qolabaResponseTime = Date.now() - start
      qolabaStatus = 'healthy'
    } catch (error) {
      logger.warn('Qolaba API health check failed', {
        requestId: req.id,
        error: error.message
      })
    }

    const detailedHealth = {
      status: qolabaStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'qolaba-proxy',
      environment: config.server.nodeEnv,
      dependencies: {
        qolaba_api: {
          status: qolabaStatus,
          response_time: `${qolabaResponseTime}ms`,
          url: config.qolaba.baseUrl
        }
      },
      system: {
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        platform: process.platform,
        node_version: process.version
      },
      config: {
        port: config.server.port,
        host: config.server.host,
        log_level: config.logging.level,
        auth_mode: config.auth.mode
      }
    }

    res.json(detailedHealth)

  } catch (error) {
    logger.error('Detailed health check failed', {
      requestId: req.id,
      error: error.message
    })

    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// GET /health/ready - Readiness check
router.get('/ready', async (req, res) => {
  try {
    // Check if the service is ready to accept traffic
    const isReady = await checkReadiness()

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      })
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    logger.error('Readiness check failed', {
      requestId: req.id,
      error: error.message
    })

    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// GET /health/live - Liveness check
router.get('/live', (req, res) => {
  // Simple liveness check - if the process is running, it's live
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  })
})

// Check if the service is ready to accept traffic
async function checkReadiness() {
  try {
    // Check if configuration is valid
    try {
      const { validateConfig } = await import('../config/index.js')
      validateConfig()
    } catch (configError) {
      logger.error('Configuration validation failed', { error: configError.message })
      return false
    }

    // Check Qolaba API connectivity
    try {
      const testClient = new (await import('../services/qolaba.js')).QolabaApiClient(config.qolaba.testApiKey)
      await testClient.getModels()
      return true
    } catch (apiError) {
      logger.warn('Qolaba API not ready', { error: apiError.message })
      return false
    }
  } catch (error) {
    logger.error('Readiness check error', { error: error.message })
    return false
  }
}

export default router