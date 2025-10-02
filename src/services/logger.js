import winston from 'winston'
import { config } from '../config/index.js'

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`
    }
    
    return log
  })
)

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json' ? logFormat : winston.format.simple(),
  defaultMeta: { 
    service: 'qoloba-proxy',
    version: '1.0.0',
    environment: config.server.nodeEnv
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transports (only in production)
    ...(config.server.nodeEnv === 'production' ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ] : [])
  ]
})

// Request-specific logger
export const requestLogger = (req, res, next) => {
  const start = Date.now()
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  })
  
  // Override res.end to log response
  const originalEnd = res.end
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id
    })
    
    originalEnd.call(this, chunk, encoding)
  }
  
  next()
}

// Error-specific logger
export const logError = (error, context = {}) => {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    ...context
  })
}

// Performance logger
export const logPerformance = (operation, duration, metadata = {}) => {
  logger.info('Performance metric', {
    operation,
    duration: `${duration}ms`,
    ...metadata
  })
}

// Qolaba API logger
export const logQolabaRequest = (endpoint, method, payload, responseTime, statusCode) => {
  logger.info('Qolaba API request', {
    endpoint,
    method,
    responseTime: `${responseTime}ms`,
    statusCode,
    payloadSize: JSON.stringify(payload).length
  })
}

// Usage tracker logger
export const logUsage = (model, inputTokens, outputTokens, cost, userId) => {
  logger.info('Usage metrics', {
    model,
    inputTokens,
    outputTokens,
    cost,
    userId,
    timestamp: new Date().toISOString()
  })
}

export default logger