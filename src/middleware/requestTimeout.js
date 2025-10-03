import { logger } from '../services/logger.js'
import { TimeoutError } from './errorHandler.js'

/**
 * Request timeout middleware for non-streaming requests
 * Prevents hanging requests by enforcing timeouts
 */
export const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const startTime = Date.now()
    const requestId = req.id || 'unknown'

    // Set a timeout for the request
    const timeout = setTimeout(() => {
      const duration = Date.now() - startTime

      logger.warn('Request timeout reached', {
        requestId,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        timeout: `${timeoutMs}ms`
      })

      // Clean up the response if it hasn't been sent yet
      if (!res.headersSent) {
        res.destroy()
      }

      // Send timeout error if response is still writable
      if (!res.headersSent) {
        res.status(408).json({
          error: {
            message: `Request timeout after ${timeoutMs}ms`,
            type: 'api_error',
            code: 'timeout',
            request_id: requestId
          }
        })
      }

      // Force close the connection if needed
      if (res.connection && !res.connection.destroyed) {
        res.connection.destroy()
      }
    }, timeoutMs)

    // Clear timeout when request completes
    const cleanup = () => {
      clearTimeout(timeout)
      const duration = Date.now() - startTime

      if (duration > timeoutMs * 0.8) { // Log if request took more than 80% of timeout
        logger.warn('Request completed near timeout', {
          requestId,
          method: req.method,
          url: req.url,
          duration: `${duration}ms`,
          timeout: `${timeoutMs}ms`
        })
      }
    }

    // Listen for response finish or close events
    res.on('finish', cleanup)
    res.on('close', cleanup)

    // Store timeout reference for potential manual cleanup
    req.timeoutRef = timeout

    next()
  }
}

/**
 * Manual timeout cleanup for long-running requests
 */
export const clearRequestTimeout = (req) => {
  if (req.timeoutRef) {
    clearTimeout(req.timeoutRef)
    req.timeoutRef = null
  }
}

/**
 * Extend timeout for specific long-running operations
 */
export const extendTimeout = (req, additionalMs = 30000) => {
  if (req.timeoutRef) {
    clearTimeout(req.timeoutRef)

    const newTimeout = setTimeout(() => {
      logger.warn('Extended request timeout reached', {
        requestId: req.id || 'unknown',
        method: req.method,
        url: req.url
      })

      if (!req.res.headersSent) {
        req.res.status(408).json({
          error: {
            message: 'Request timeout (extended)',
            type: 'api_error',
            code: 'timeout'
          }
        })
      }
    }, additionalMs)

    req.timeoutRef = newTimeout
  }
}

export default requestTimeout