import { logger } from '../services/logger.js'

/**
 * Retry helper for handling transient failures with exponential backoff
 */
export class RetryHelper {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3
    this.initialDelay = options.initialDelay || 1000
    this.maxDelay = options.maxDelay || 10000
    this.backoffFactor = options.backoffFactor || 2
    this.retryableErrors = options.retryableErrors || [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN'
    ]
    this.retryableStatusCodes = options.retryableStatusCodes || [502, 503, 504]
  }

  /**
   * Execute a function with retry logic
   */
  async execute(fn, context = {}) {
    let lastError
    let attempt = 0

    while (attempt <= this.maxRetries) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt)
          logger.info('Retrying request', {
            ...context,
            attempt: attempt + 1,
            maxRetries: this.maxRetries + 1,
            delay: `${delay}ms`,
            lastError: lastError?.message
          })
          
          await this.sleep(delay)
        }

        const result = await fn()
        
        if (attempt > 0) {
          logger.info('Request succeeded after retry', {
            ...context,
            attempt: attempt + 1,
            totalAttempts: attempt + 1
          })
        }
        
        return result
      } catch (error) {
        lastError = error
        
        if (!this.shouldRetry(error, attempt)) {
          logger.error('Request failed and will not be retried', {
            ...context,
            attempt: attempt + 1,
            error: error.message,
            errorCode: error.code,
            statusCode: error.response?.status
          })
          throw error
        }

        logger.warn('Request failed, will retry', {
          ...context,
          attempt: attempt + 1,
          error: error.message,
          errorCode: error.code,
          statusCode: error.response?.status
        })
        
        attempt++
      }
    }

    // This should not be reached, but just in case
    logger.error('Max retries exceeded', {
      ...context,
      maxRetries: this.maxRetries,
      lastError: lastError?.message
    })
    
    throw lastError
  }

  /**
   * Calculate delay with exponential backoff
   */
  calculateDelay(attempt) {
    const delay = Math.min(
      this.initialDelay * Math.pow(this.backoffFactor, attempt),
      this.maxDelay
    )
    
    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random()
    return Math.floor(delay + jitter)
  }

  /**
   * Determine if error should be retried
   */
  shouldRetry(error, attempt) {
    // Don't retry if we've exceeded max attempts
    if (attempt >= this.maxRetries) {
      return false
    }

    // Retry on specific error codes
    if (this.retryableErrors.includes(error.code)) {
      return true
    }

    // Retry on specific HTTP status codes
    if (error.response && this.retryableStatusCodes.includes(error.response.status)) {
      return true
    }

    // Retry on timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return true
    }

    // Don't retry on client errors (4xx) except for specific cases
    if (error.response && error.response.status >= 400 && error.response.status < 500) {
      return false
    }

    // Don't retry on authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      return false
    }

    // Default: retry on network-related errors
    return error.code && error.code.startsWith('E')
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5
    this.resetTimeout = options.resetTimeout || 60000 // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000 // 10 seconds
    
    this.state = 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0
    this.lastFailureTime = null
    this.successCount = 0
  }

  /**
   * Execute function through circuit breaker
   */
  async execute(fn, context = {}) {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN'
        logger.info('Circuit breaker transitioning to HALF_OPEN', { context })
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= 3) {
        this.reset()
        logger.info('Circuit breaker reset to CLOSED')
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1)
    }
  }

  onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
      logger.warn('Circuit breaker opened', {
        failureCount: this.failureCount,
        threshold: this.failureThreshold
      })
    }
  }

  shouldAttemptReset() {
    return this.lastFailureTime && 
           (Date.now() - this.lastFailureTime) >= this.resetTimeout
  }

  reset() {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = null
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    }
  }
}

// Default instances
export const defaultRetryHelper = new RetryHelper()
export const defaultCircuitBreaker = new CircuitBreaker()

export default {
  RetryHelper,
  CircuitBreaker,
  defaultRetryHelper,
  defaultCircuitBreaker
}