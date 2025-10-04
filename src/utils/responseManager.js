import { logger, logDetailedError, logResponseState, logHeaderOperation } from '../services/logger.js'

/**
 * Centralized response manager to prevent multiple res.end() calls
 * and coordinate between different middleware
 */
export class ResponseManager {
  constructor(res, requestId) {
    this.res = res
    this.requestId = requestId
    this.isEnded = false
    this.endCallbacks = []
    this.originalEnd = res.end
    this.headersSent = false

    // Log response manager initialization
    logResponseState(requestId, 'response_manager_initialized', {
      headersSent: this.headersSent,
      responseEnded: this.isEnded,
      writable: res.writable
    })

    // Override res.end to centralize response ending
    this._overrideEnd()

    // Track when headers are sent
    this._trackHeaders()
  }

  /**
   * Override res.end to centralize response ending
   */
  _overrideEnd() {
    const self = this
    this.res.end = function(chunk, encoding) {
      if (self.isEnded) {
        logger.debug('Response already ended, skipping', {
          requestId: self.requestId,
          headersSent: self.areHeadersSent(),
          writable: self.res.writable
        })
        return
      }

      // Log response ending attempt
      logResponseState(self.requestId, 'response_ending_attempt', {
        headersSent: self.areHeadersSent(),
        responseEnded: self.isEnded,
        writable: self.res.writable,
        hasChunk: !!chunk,
        encoding: encoding || 'none'
      })

      // Mark as ended before calling original end
      self.isEnded = true

      // Execute all end callbacks AFTER marking as ended to prevent race conditions
      for (const callback of self.endCallbacks) {
        try {
          logResponseState(self.requestId, 'executing_end_callback', {
            headersSent: self.areHeadersSent(),
            responseEnded: self.isEnded,
            writable: self.res.writable
          })
          callback()
        } catch (error) {
          // Enhanced error logging with detailed context
          logDetailedError(error, {
            requestId: self.requestId,
            method: 'end_callback',
            url: 'response_manager',
            responseState: {
              headersSent: self.areHeadersSent(),
              ended: self.isEnded,
              writable: self.res.writable
            },
            additionalInfo: {
              callbackIndex: self.endCallbacks.indexOf(callback),
              totalCallbacks: self.endCallbacks.length,
              callbackType: 'end_callback'
            }
          })
          
          logger.error('End callback failed', {
            requestId: self.requestId,
            error: error.message,
            headersSent: self.areHeadersSent()
          })
          
          // If headers are already sent, we can't send a new error response.
          // The response is already being written, so we just log the callback failure.
          if (!self.areHeadersSent()) {
            // Re-throw to be caught by the global error handler if response hasn't started
            throw error
          }
        }
      }

      // CRITICAL FIX: For streaming responses, don't pass parameters to end() if headers already sent
      try {
        logHeaderOperation(self.requestId, 'res.end_call', true)
        
        if (self.headersSent) {
          logResponseState(self.requestId, 'calling_original_end_no_params', {
            headersSent: true,
            responseEnded: self.isEnded
          })
          self.originalEnd.call(this)
        } else {
          logResponseState(self.requestId, 'calling_original_end_with_params', {
            headersSent: false,
            responseEnded: self.isEnded,
            hasChunk: !!chunk,
            encoding: encoding || 'none'
          })
          self.originalEnd.call(this, chunk, encoding)
        }
        
        logResponseState(self.requestId, 'response_ended_successfully', {
          headersSent: self.areHeadersSent(),
          responseEnded: self.isEnded,
          writable: self.res.writable
        })
      } catch (error) {
        logDetailedError(error, {
          requestId: self.requestId,
          method: 'res.end',
          url: 'response_manager',
          responseState: {
            headersSent: self.areHeadersSent(),
            ended: self.isEnded,
            writable: self.res.writable
          },
          additionalInfo: {
            headersSent: self.headersSent,
            hasChunk: !!chunk,
            encoding: encoding || 'none',
            endCallType: self.headersSent ? 'no_params' : 'with_params'
          }
        })
        
        logHeaderOperation(self.requestId, 'res.end_call', false, error)
        throw error
      }
    }
  }

  /**
   * Track when headers are sent
   */
  _trackHeaders() {
    const self = this
    const originalWriteHead = this.res.writeHead

    this.res.writeHead = function(...args) {
      // Log header write attempt
      logResponseState(self.requestId, 'write_head_attempt', {
        headersSent: self.headersSent,
        responseEnded: self.isEnded,
        writable: self.res.writable,
        statusCode: args[0],
        headers: args[1]
      })

      try {
        self.headersSent = true
        const result = originalWriteHead.apply(this, args)
        
        logHeaderOperation(self.requestId, 'writeHead', true)
        logResponseState(self.requestId, 'headers_sent_successfully', {
          headersSent: true,
          responseEnded: self.isEnded,
          writable: self.res.writable,
          statusCode: args[0]
        })
        
        return result
      } catch (error) {
        logDetailedError(error, {
          requestId: self.requestId,
          method: 'writeHead',
          url: 'response_manager',
          responseState: {
            headersSent: self.headersSent,
            ended: self.isEnded,
            writable: self.res.writable
          },
          additionalInfo: {
            statusCode: args[0],
            headers: args[1],
            writeHeadArgs: args
          }
        })
        
        logHeaderOperation(self.requestId, 'writeHead', false, error)
        throw error
      }
    }
  }

  /**
   * Register a callback to be called when response ends
   */
  onEnd(callback) {
    this.endCallbacks.push(callback)
  }

  /**
   * Check if response has ended
   */
  hasEnded() {
    return this.isEnded
  }

  /**
   * Check if headers have been sent
   */
  areHeadersSent() {
    return this.headersSent || this.res.headersSent
  }

  /**
   * Get the original end function
   */
  getOriginalEnd() {
    return this.originalEnd
  }
}

/**
 * Create a response manager for a request
 */
export function createResponseManager(res, requestId) {
  return new ResponseManager(res, requestId)
}

export default {
  ResponseManager,
  createResponseManager
}