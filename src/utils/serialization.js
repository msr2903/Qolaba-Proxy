import { logger } from '../services/logger.js'

/**
 * Safely serialize objects with circular reference detection
 */
export function safeStringify(obj, maxSize = 10000) {
  const seen = new WeakSet()
  
  try {
    const jsonString = JSON.stringify(obj, (key, val) => {
      // Handle circular references
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular Reference]'
        }
        seen.add(val)
      }
      
      // Handle specific problematic object types
      if (val && typeof val === 'object') {
        // Handle HTTP objects that cause circular references
        if (val.constructor?.name === 'TLSSocket' || 
            val.constructor?.name === 'Socket' ||
            val.constructor?.name === 'HTTPParser' ||
            val.constructor?.name === 'ServerResponse' ||
            val.constructor?.name === 'IncomingMessage') {
          return `[${val.constructor?.name || 'Object'}]`
        }
        
        // Handle other native objects that might be problematic
        if (val instanceof Buffer) {
          return `[Buffer: ${val.length} bytes]`
        }
        
        if (val instanceof Stream) {
          return '[Stream]'
        }
        
        if (val instanceof EventEmitter) {
          return '[EventEmitter]'
        }
      }
      
      return val
    })
    
    // Truncate if too large
    if (jsonString.length > maxSize) {
      return jsonString.substring(0, maxSize) + '...[truncated]'
    }
    
    return jsonString
  } catch (error) {
    logger.warn('Failed to serialize object safely', { 
      error: error.message,
      objectType: typeof obj 
    })
    return `[Serialization Error: ${error.message}]`
  }
}

/**
 * Safely calculate payload size without circular references
 */
export function safePayloadSize(payload) {
  if (!payload) return 0
  
  try {
    // For simple payloads, use direct stringification
    if (typeof payload === 'string') {
      return payload.length
    }
    
    if (typeof payload === 'object') {
      // Check if it's a simple object without nested objects
      const keys = Object.keys(payload)
      const hasNestedObjects = keys.some(key => {
        const value = payload[key]
        return value && typeof value === 'object'
      })
      
      if (!hasNestedObjects) {
        return JSON.stringify(payload).length
      }
      
      // For complex objects, use safe serialization
      return safeStringify(payload).length
    }
    
    return String(payload).length
  } catch (error) {
    logger.warn('Failed to calculate payload size', { 
      error: error.message,
      payloadType: typeof payload 
    })
    return 0
  }
}

/**
 * Sanitize objects for logging by removing problematic properties
 */
export function sanitizeForLogging(obj, options = {}) {
  const { 
    maxDepth = 3, 
    maxArrayLength = 10, 
    maxStringLength = 200,
    removeCircular = true 
  } = options
  
  const seen = new WeakSet()
  
  function sanitize(value, depth = 0) {
    // Prevent infinite recursion
    if (depth > maxDepth) {
      return '[Max Depth Reached]'
    }
    
    // Handle circular references
    if (removeCircular && typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]'
      }
      seen.add(value)
    }
    
    // Handle null values
    if (value === null) {
      return null
    }
    
    // Handle primitive types
    if (typeof value !== 'object') {
      if (typeof value === 'string' && value.length > maxStringLength) {
        return value.substring(0, maxStringLength) + '...[truncated]'
      }
      return value
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      const truncatedArray = value.slice(0, maxArrayLength)
      const sanitized = truncatedArray.map(item => sanitize(item, depth + 1))
      
      if (value.length > maxArrayLength) {
        sanitized.push(`...[${value.length - maxArrayLength} more items]`)
      }
      
      return sanitized
    }
    
    // Handle objects
    if (typeof value === 'object') {
      const result = {}
      
      // Skip problematic object types
      if (value.constructor?.name === 'TLSSocket' || 
          value.constructor?.name === 'Socket' ||
          value.constructor?.name === 'HTTPParser' ||
          value.constructor?.name === 'ServerResponse' ||
          value.constructor?.name === 'IncomingMessage') {
        return `[${value.constructor?.name || 'Object'}]`
      }
      
      // Handle Buffer
      if (value instanceof Buffer) {
        return `[Buffer: ${value.length} bytes]`
      }
      
      // Handle Stream
      if (value instanceof Stream) {
        return '[Stream]'
      }
      
      // Handle EventEmitter
      if (value instanceof EventEmitter) {
        return '[EventEmitter]'
      }
      
      // Process regular object properties
      for (const [key, val] of Object.entries(value)) {
        try {
          result[key] = sanitize(val, depth + 1)
        } catch (error) {
          result[key] = `[Error: ${error.message}]`
        }
      }
      
      return result
    }
    
    return value
  }
  
  try {
    return sanitize(obj)
  } catch (error) {
    logger.warn('Failed to sanitize object for logging', { 
      error: error.message 
    })
    return `[Sanitization Error: ${error.message}]`
  }
}

/**
 * Check if an object potentially contains circular references
 */
export function hasCircularReferences(obj) {
  const seen = new WeakSet()
  
  function check(value) {
    if (typeof value !== 'object' || value === null) {
      return false
    }
    
    if (seen.has(value)) {
      return true
    }
    
    seen.add(value)
    
    if (Array.isArray(value)) {
      return value.some(item => check(item))
    }
    
    return Object.values(value).some(item => check(item))
  }
  
  try {
    return check(obj)
  } catch (error) {
    return true // Assume circular if we can't check
  }
}

// Import Node.js modules for type checking
import { Stream } from 'stream'
import { EventEmitter } from 'events'

export default {
  safeStringify,
  safePayloadSize,
  sanitizeForLogging,
  hasCircularReferences
}