# SillyTavern Socket Hang Up Fix Implementation

## Problem Summary

SillyTavern is experiencing "socket hang up" errors when connecting to the `/v1/chat/completions` endpoint with streaming requests. The error occurs due to multiple competing timeout systems, SSE formatting issues, and improper connection management.

## Root Causes Identified

1. **Competing Timeout Systems**: Multiple timeout layers causing race conditions
2. **SSE Format Incompatibility**: Server-Sent Events format not fully compatible with SillyTavern
3. **Connection Management Issues**: Poor socket cleanup and keep-alive handling
4. **Response State Complexity**: Complex ResponseManager state leading to premature termination

## Comprehensive Fix Plan

### Fix 1: Timeout Coordination and Alignment

**File**: `src/services/qolaba.js`
**Issue**: Hardcoded 90s axios timeout conflicts with 120s unified timeout manager

**Changes Needed**:
```javascript
// In streamChat method, line 103:
// OLD: timeout: 90000 // CRITICAL FIX: Extended to 90 seconds to handle provider latency
// NEW: timeout: 120000 // Aligned with unified timeout manager

// Also update the activity checks to match:
// OLD: if (timeSinceLastChunk > 75000) // 75 seconds of inactivity
// NEW: if (timeSinceLastChunk > 110000) // 110 seconds of inactivity (less than 120s timeout)

// OLD: if (totalElapsed > 80000) // 80 seconds absolute maximum
// NEW: if (totalElapsed > 115000) // 115 seconds absolute maximum (less than 120s timeout)
```

### Fix 2: Enhanced SSE Formatting for SillyTavern

**File**: `src/utils/streaming.js`
**Issue**: SSE format may not be fully compatible with SillyTavern expectations

**Changes Needed**:
```javascript
// In SafeSSEWriter class, enhance writeEvent method:
writeEvent(data, eventType = null) {
  if (!this.responseManager.res.canWrite()) {
    return false
  }

  try {
    let sseData = `data: ${JSON.stringify(data)}\n\n`
    
    // ENHANCEMENT: Add proper event types for SillyTavern compatibility
    if (eventType) {
      sseData = `event: ${eventType}\n${sseData}`
    }
    
    // ENHANCEMENT: Add ID and retry timing for better SSE compliance
    if (data.id) {
      sseData = `id: ${data.id}\n${sseData}`
    }
    
    // ENHANCEMENT: Ensure proper SSE format with newlines
    if (!sseData.endsWith('\n\n')) {
      sseData += '\n\n'
    }

    return this.responseManager.safeWrite(sseData)
  } catch (error) {
    logger.error('Failed to write SSE event', {
      requestId: this.responseManager.requestId,
      error: error.message
    })
    return false
  }
}
```

### Fix 3: Improved Connection Headers

**File**: `src/utils/streaming.js`
**Issue**: Connection headers may not be sufficient for SillyTavern's connection pooling

**Changes Needed**:
```javascript
// In handleStreamingResponse function, line 535:
// OLD headers:
const headersSet = responseState.safeWriteHeaders(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Cache-Control'
})

// NEW enhanced headers:
const headersSet = responseState.safeWriteHeaders(200, {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'X-Accel-Buffering': 'no', // Prevent nginx buffering
  'X-Content-Type-Options': 'nosniff'
})
```

### Fix 4: Socket Cleanup Coordination

**File**: `src/utils/streaming.js`
**Issue**: Multiple systems trying to cleanup sockets simultaneously

**Changes Needed**:
```javascript
// Add new method for coordinated socket cleanup:
const coordinatedSocketCleanup = async (response, reason) => {
  try {
    // Prevent multiple cleanup attempts
    if (response._socketCleanupInProgress) {
      logger.debug('Socket cleanup already in progress', {
        requestId: responseManager.requestId,
        reason
      })
      return
    }
    
    response._socketCleanupInProgress = true
    
    if (response.data && typeof response.data.destroy === 'function') {
      response.data.destroy()
      logger.debug('Stream destroyed successfully', {
        requestId: responseManager.requestId,
        reason
      })
    }
    
    if (response.request && typeof response.request.destroy === 'function') {
      response.request.destroy()
    }
    
    // Add small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100))
    
  } catch (destroyError) {
    logger.warn('Failed to destroy stream during coordinated cleanup', {
      requestId: responseManager.requestId,
      error: destroyError.message,
      reason
    })
  } finally {
    response._socketCleanupInProgress = false
  }
}
```

### Fix 5: Enhanced Error Handling for Socket Issues

**File**: `src/utils/responseManager.js`
**Issue**: Better error recovery for socket hang up scenarios

**Changes Needed**:
```javascript
// Add new method in ResponseManager class:
handleSocketHangUp(error) {
  if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
    logger.warn('Socket hang up detected, attempting graceful recovery', {
      requestId: this.requestId,
      errorCode: error.code,
      errorMessage: error.message
    })
    
    // Mark as ended to prevent further writes
    this.isEnded = true
    this.isDestroyed = true
    
    // Cancel all timeouts
    this.res.cancelAllTimeouts('socket_hang_up')
    
    // Try to send error response if headers haven't been sent
    if (!this.headersSent && this.res.canWriteHeaders()) {
      try {
        this.res.writeHead(503, {
          'Content-Type': 'application/json',
          'Connection': 'close'
        })
        this.res.end(JSON.stringify({
          error: {
            message: 'Service temporarily unavailable - connection reset',
            type: 'api_error',
            code: 'connection_reset'
          }
        }))
      } catch (writeError) {
        logger.debug('Could not send error response for socket hang up', {
          requestId: this.requestId,
          error: writeError.message
        })
      }
    }
    
    return true
  }
  
  return false
}
```

### Fix 6: Unified Timeout Configuration

**File**: `src/config/index.js`
**Issue**: Need better timeout configuration for different scenarios

**Changes Needed**:
```javascript
// Add new timeout configuration section:
timeouts: {
  // Standard request timeouts
  standard: {
    default: 30000,      // 30 seconds for regular requests
    max: 60000          // 1 minute absolute maximum
  },
  
  // Streaming request timeouts  
  streaming: {
    default: 120000,    // 2 minutes for streaming
    max: 300000,        // 5 minutes absolute maximum
    inactivity: 60000   // 1 minute inactivity timeout
  },
  
  // Advanced model timeouts
  advanced: {
    default: 300000,    // 5 minutes for advanced models
    max: 600000,        // 10 minutes absolute maximum
    inactivity: 120000  // 2 minutes inactivity timeout
  }
}
```

### Fix 7: Improved Request Timeout Middleware

**File**: `src/middleware/requestTimeout.js`
**Issue**: Request timeout middleware conflicts with unified timeout manager

**Changes Needed**:
```javascript
// Modify detectStreamingRequest function to better identify SillyTavern requests:
function detectStreamingRequest(req) {
  // Check URL path
  if (req.path === '/v1/chat/completions' && req.method === 'POST') {
    return true
  }
  
  // Check if request body has stream: true
  if (req.body && req.body.stream === true) {
    return true
  }
  
  // Check for streaming-related headers
  const streamingHeaders = [
    'text/event-stream',
    'application/x-ndjson'
  ]
  
  const acceptHeader = req.get('Accept') || req.get('accept')
  if (acceptHeader && streamingHeaders.some(header => acceptHeader.includes(header))) {
    return true
  }
  
  // ENHANCEMENT: Check for SillyTavern specific headers
  const userAgent = req.get('User-Agent') || req.get('user-agent') || ''
  if (userAgent.includes('SillyTavern') || userAgent.includes('Electron')) {
    // SillyTavern typically uses streaming
    return true
  }
  
  return false
}
```

## Implementation Priority

1. **Critical**: Fix 1 - Timeout coordination (prevents immediate socket hang ups)
2. **High**: Fix 2 - SSE formatting (ensures SillyTavern compatibility)
3. **High**: Fix 3 - Connection headers (improves connection stability)
4. **Medium**: Fix 4 - Socket cleanup coordination (prevents race conditions)
5. **Medium**: Fix 5 - Enhanced error handling (better recovery)
6. **Low**: Fix 6 - Unified timeout configuration (long-term maintainability)
7. **Low**: Fix 7 - Improved request detection (better SillyTavern detection)

## Testing Plan

After implementing fixes:

1. **Basic Connectivity Test**:
   ```bash
   curl -v http://localhost:3000/health
   ```

2. **Models List Test**:
   ```bash
   curl -v http://localhost:3000/v1/models -H "Authorization: Bearer your-test-api-key-here"
   ```

3. **Non-Streaming Test**:
   ```bash
   curl -v -X POST http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-test-api-key-here" \
     -d '{"model": "gpt-4.1-mini-2025-04-14", "messages": [{"role": "user", "content": "Hello"}]}'
   ```

4. **Streaming Test (Critical)**:
   ```bash
   curl -v -X POST http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-test-api-key-here" \
     -d '{"model": "gpt-4.1-mini-2025-04-14", "messages": [{"role": "user", "content": "Hello"}], "stream": true}'
   ```

5. **SillyTavern Integration Test**:
   - Configure SillyTavern to connect to `http://localhost:3000`
   - Test with various models
   - Test both streaming and non-streaming
   - Verify no "socket hang up" errors

## Expected Outcomes

After implementing these fixes:

1. **No more socket hang up errors** in SillyTavern
2. **Stable streaming connections** that don't timeout prematurely
3. **Proper SSE formatting** that SillyTavern can parse correctly
4. **Graceful error handling** when issues do occur
5. **Better connection reuse** for improved performance

## Monitoring and Logging

Enhanced logging will help identify any remaining issues:

- Request start/end timing
- Timeout coordination events
- Socket cleanup operations
- SSE formatting events
- Error recovery attempts

## Rollback Plan

If issues arise:

1. **Immediate rollback**: Restore original `src/services/qolaba.js` timeout values
2. **Partial rollback**: Disable specific fixes that cause issues
3. **Gradual rollout**: Enable fixes one by one to isolate problems

## Documentation Updates

After fixes are implemented and tested:

1. Update `docs/TROUBLESHOOTING.md` with SillyTavern-specific guidance
2. Add SillyTavern configuration examples to `README.md`
3. Create dedicated SillyTavern integration guide
4. Update timeout configuration documentation