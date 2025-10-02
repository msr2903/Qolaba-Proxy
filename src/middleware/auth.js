import { config } from '../config/index.js'
import { logger } from '../services/logger.js'

export const authenticate = (req, res, next) => {
  try {
    let apiKey = null

    // Try to get API key from Authorization header (Bearer token)
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7)
    }

    // Try to get API key from x-api-key header (Anthropic style)
    if (!apiKey && req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key']
    }

    // Try to get API key from query parameter (for testing)
    if (!apiKey && req.query.api_key) {
      apiKey = req.query.api_key
    }

    if (!apiKey) {
      return res.status(401).json({
        error: {
          message: 'Missing API key. Please provide an API key in the Authorization header (Bearer <token>) or x-api-key header.',
          type: 'invalid_request_error',
          code: 'missing_api_key'
        }
      })
    }

    // Handle API key based on configuration
    let finalApiKey = apiKey

    if (config.auth.mode === 'override') {
      finalApiKey = config.auth.overrideKey
      logger.info('Using override API key', { requestId: req.id })
    } else if (config.auth.mode === 'passthrough') {
      logger.debug('Using client API key', { requestId: req.id })
    }

    // Validate API key format (basic validation)
    if (finalApiKey.length < 10) {
      return res.status(401).json({
        error: {
          message: 'Invalid API key format',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      })
    }

    // Store the validated API key in the request for later use
    req.apiKey = finalApiKey
    req.originalApiKey = apiKey

    logger.debug('API key authenticated successfully', { 
      requestId: req.id,
      authMode: config.auth.mode
    })

    next()
  } catch (error) {
    logger.error('Authentication error:', error, { requestId: req.id })
    
    return res.status(500).json({
      error: {
        message: 'Internal server error during authentication',
        type: 'api_error',
        code: 'internal_error'
      }
    })
  }
}

export const optionalAuth = (req, res, next) => {
  try {
    let apiKey = null

    // Try to get API key from various sources (same as authenticate)
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7)
    }

    if (!apiKey && req.headers['x-api-key']) {
      apiKey = req.headers['x-api-key']
    }

    if (!apiKey && req.query.api_key) {
      apiKey = req.query.api_key
    }

    if (apiKey) {
      // Handle API key based on configuration
      let finalApiKey = apiKey

      if (config.auth.mode === 'override') {
        finalApiKey = config.auth.overrideKey
      }

      req.apiKey = finalApiKey
      req.originalApiKey = apiKey
    }

    next()
  } catch (error) {
    logger.error('Optional authentication error:', error, { requestId: req.id })
    next()
  }
}

export default { authenticate, optionalAuth }