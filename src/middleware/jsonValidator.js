import { logger } from '../services/logger.js'
import { ValidationError } from './errorHandler.js'

/**
 * JSON validation middleware to handle malformed JSON requests
 * Uses Express's built-in error handling for JSON parsing
 */
export const jsonValidator = (req, res, next) => {
  // Only validate POST, PUT, PATCH requests
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next()
  }

  // Check if content-type is JSON
  const contentType = req.get('Content-Type') || req.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    return next()
  }

  // Simple validation - let Express handle the JSON parsing
  // We'll catch errors in the error handler middleware
  next()
}

/**
 * Enhanced error handler for JSON parsing errors
 */
export const handleJsonParsingError = (error, req, res, next) => {
  if (error.type === 'entity.parse.failed' || 
      error.message.includes('JSON') ||
      error.message.includes('Unexpected token') ||
      error.code === 'EJSONPARSE' ||
      error.message.includes('Unexpected token') ||
      error.message.includes('is not valid JSON')) {
    
    logger.error('JSON parsing error', {
      requestId: req.id,
      error: error.message,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode: 400
    })

    return res.status(400).json({
      error: {
        message: 'Invalid JSON format in request body',
        type: 'invalid_request_error',
        code: 'invalid_json',
        details: error.message.includes('is not valid JSON') ? 
          'Please check for missing quotes, commas, or other JSON syntax errors' :
          'Please ensure your request body contains valid JSON'
      }
    })
  }

  // Pass other errors to next handler
  next(error)
}

export default {
  jsonValidator,
  handleJsonParsingError
}