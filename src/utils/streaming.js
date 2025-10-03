import { logger } from '../services/logger.js'
import { translateQolabaToOpenAI, extractToolCalls } from './translator.js'
import { config } from '../config/index.js'
import { createResponseState, withStreamingErrorBoundary, SafeSSEWriter } from './responseState.js'

// Handle streaming response
export async function handleStreamingResponse(res, req, qolabaClient, qolabaPayload, requestId) {
  // Create response state tracker
  const responseState = createResponseState(res, requestId)

  // Clear the request timeout for streaming requests to prevent conflicts
  if (req.timeoutRef) {
    clearTimeout(req.timeoutRef)
    req.timeoutRef = null
    logger.debug('Cleared request timeout for streaming', { requestId })
  }

  // Track streaming completion to prevent double termination
  let isStreamCompleted = false
  let isResponseEnded = false

  // Add abort controller for request cancellation
  const abortController = new AbortController()
  const timeoutRef = setTimeout(() => {
    abortController.abort()
    // CRITICAL FIX: Force response termination on timeout to prevent hanging
    logger.warn('Streaming timeout reached, forcing response termination', { requestId })
    forceResponseTermination(responseState, timeoutRef, abortController, requestId)
  }, 30000) // Reduced to 30 seconds for more aggressive cleanup
  
  // Enhanced disconnect detection
  let isClientDisconnected = false
  
  // Helper function to safely end response and force cleanup
  const forceResponseTermination = (responseState, timeoutRef, abortController, requestId) => {
    if (isResponseEnded) {
      logger.debug('Response already ended, skipping termination', { requestId })
      return
    }

    isResponseEnded = true
    
    // Clear timeout first
    if (timeoutRef) {
      clearTimeout(timeoutRef)
    }
    
    // Abort any ongoing operations
    if (abortController) {
      abortController.abort()
    }
    
    // Force end the response if it hasn't been ended
    if (responseState.res.canWrite()) {
      try {
        logger.debug('Force ending streaming response', { requestId })
        responseState.safeEnd()
      } catch (error) {
        logger.warn('Failed to force end response', {
          requestId,
          error: error.message
        })
      }
    }
    
    // Force destroy the response state and underlying connection
    responseState.destroy()
    
    // Force close the underlying socket if it exists
    if (res.socket && !res.socket.destroyed) {
      try {
        res.socket.destroy()
        logger.debug('Forced socket closure', { requestId })
      } catch (socketError) {
        logger.warn('Failed to destroy socket', {
          requestId,
          error: socketError.message
        })
      }
    }
  }
  
  // Handle response errors
  const handleResponseError = (error) => {
    logger.error('Response error during streaming', {
      requestId,
      error: error.message,
      code: error.code
    })
    
    if (!isClientDisconnected) {
      abortController.abort()
      forceResponseTermination(responseState, timeoutRef, abortController, requestId)
    }
  }

  // Handle request abort (client cancelled)
  req.on('aborted', () => {
    logger.info('Request aborted by client', { requestId })
    handleClientDisconnect()
  })
  
  // Listen for response errors
  res.on('error', handleResponseError)

  // Handle client disconnect
  const handleClientDisconnect = () => {
    logger.info('Client disconnected during streaming', { requestId })
    isClientDisconnected = true
    abortController.abort()
    forceResponseTermination(responseState, timeoutRef, abortController, requestId)
  }

  // Listen for client disconnect
  res.on('close', handleClientDisconnect)
  res.on('finish', () => {
    clearTimeout(timeoutRef)
    // Clear any remaining request timeout
    if (req.timeoutRef) {
      clearTimeout(req.timeoutRef)
      req.timeoutRef = null
    }
  })
  
  return withStreamingErrorBoundary(async (responseState) => {
    // Set SSE headers safely
    const headersSet = responseState.safeWriteHeaders(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    if (!headersSet) {
      throw new Error('Failed to set streaming headers')
    }

    let fullResponse = ''
    let isFirstChunk = true
    const sseWriter = new SafeSSEWriter(responseState)

    // Start streaming with proper error handling
    await qolabaClient.streamChat(qolabaPayload, (chunk) => {
      if (chunk.output) {
        fullResponse += chunk.output

        // Create OpenAI-compatible streaming chunk
        const openaiChunk = {
          id: generateChunkId(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: qolabaPayload.model || config.models.default,
          choices: [
            {
              index: 0,
              delta: {
                content: chunk.output
              },
              finish_reason: null
            }
          ]
        }

        // Send SSE formatted data safely
        const success = sseWriter.writeEvent(openaiChunk)
        if (!success) {
          logger.warn('Failed to write streaming chunk', {
            requestId,
            model: qolabaPayload.model
          })
          return
        }

        // Log first chunk and progress
        if (isFirstChunk) {
          logger.info('Streaming started', {
            requestId,
            model: qolabaPayload.model
          })
          isFirstChunk = false
        }
      }
    })

    // Send final chunk safely
    const finalChunk = {
      id: generateChunkId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: qolabaPayload.model || config.models.default,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ]
    }

    sseWriter.writeEvent(finalChunk)
    sseWriter.writeDone()

    logger.info('Streaming completed successfully', {
      requestId,
      responseLength: fullResponse.length,
      model: qolabaPayload.model
    })

    // CRITICAL FIX: Properly end the response to prevent hanging
    if (!isResponseEnded && responseState.res.canWrite()) {
      isResponseEnded = true
      logger.debug('Ending streaming response', { requestId })
      responseState.safeEnd()
      
      // CRITICAL FIX: Force connection cleanup immediately after ending
      setTimeout(() => {
        if (res.socket && !res.socket.destroyed) {
          try {
            res.socket.destroy()
            logger.debug('Forced connection cleanup after successful streaming', { requestId })
          } catch (error) {
            logger.warn('Failed to cleanup connection after streaming', {
              requestId,
              error: error.message
            })
          }
        }
      }, 100) // Small delay to ensure response is sent
    } else {
      logger.warn('Response already ended or destroyed, skipping end()', { requestId })
    }

  }, responseState, async (error, responseState) => {
    // Custom error handler for streaming
    logger.error('Streaming error handler called', {
      requestId,
      error: error.message
    })

    // CRITICAL FIX: Only try to send error response if response hasn't been ended
    if (!isResponseEnded && responseState.res.canWrite()) {
      const errorChunk = {
        id: generateChunkId(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: qolabaPayload.model || config.models.default,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'error'
          }
        ],
        error: {
          message: 'Streaming error occurred',
          type: 'api_error'
        }
      }

      const sseWriter = new SafeSSEWriter(responseState)
      sseWriter.writeEvent(errorChunk)
      sseWriter.writeDone()
      
      // CRITICAL FIX: Mark as ended and properly terminate
      isResponseEnded = true
      if (responseState.res.canWrite()) {
        logger.debug('Ending streaming response after error', { requestId })
        responseState.safeEnd()
      }
      
      // Force cleanup after error
      setTimeout(() => {
        forceResponseTermination(responseState, timeoutRef, abortController, requestId)
      }, 50)
    } else {
      logger.debug('Skipping error response - response already ended', { requestId })
      // Just force cleanup without sending error response
      forceResponseTermination(responseState, timeoutRef, abortController, requestId)
    }
  })
}

// Handle non-streaming response
export async function handleNonStreamingResponse(res, qolabaClient, qolabaPayload, requestId) {
  try {
    logger.info('Non-streaming request started', {
      requestId,
      model: qolabaPayload.model
    })

    const response = await qolabaClient.chat(qolabaPayload)

    // Translate to OpenAI format
    const openaiResponse = {
      id: generateChunkId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: qolabaPayload.model || config.models.default,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response.output || ''
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: response.usage?.promptTokens || 0,
        completion_tokens: response.usage?.completionTokens || 0,
        total_tokens: response.usage?.totalTokens || 0
      }
    }

    logger.info('Non-streaming request completed', {
      requestId,
      responseLength: response.output?.length || 0,
      model: qolabaPayload.model,
      usage: response.usage
    })

    res.json(openaiResponse)

  } catch (error) {
    logger.error('Non-streaming request failed', {
      requestId,
      error: error.message
    })

    res.status(500).json({
      error: {
        message: error.message,
        type: 'api_error',
        code: 'chat_completion_error'
      }
    })
  }
}

// Generate chunk ID for streaming responses
function generateChunkId() {
  return 'chatcmpl-' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

// Extract and handle tool calls from streaming response
export function extractToolCallsFromStream(content) {
  const toolCalls = extractToolCalls(content)
  
  if (toolCalls.length > 0) {
    logger.debug('Tool calls detected in response', {
      toolCallCount: toolCalls.length,
      toolNames: toolCalls.map(call => call.function.name)
    })
  }
  
  return toolCalls
}

// Create tool call chunk for streaming
export function createToolCallChunk(toolCall, requestId) {
  return {
    id: generateChunkId(),
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [toolCall]
        },
        finish_reason: null
      }
    ]
  }
}

export default {
  handleStreamingResponse,
  handleNonStreamingResponse,
  extractToolCallsFromStream,
  createToolCallChunk
}