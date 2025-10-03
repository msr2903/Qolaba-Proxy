import { logger } from '../services/logger.js'
import { translateQolabaToOpenAI, extractToolCalls } from './translator.js'
import { config } from '../config/index.js'
import { createResponseState, withStreamingErrorBoundary, SafeSSEWriter } from './responseState.js'

// Handle streaming response
export async function handleStreamingResponse(res, qolabaClient, qolabaPayload, requestId) {
  // Create response state tracker
  const responseState = createResponseState(res, requestId)

  // Add abort controller for request cancellation
  const abortController = new AbortController()
  const timeoutRef = setTimeout(() => {
    abortController.abort()
  }, 55000) // 55 second timeout for streaming

  // Handle client disconnect
  const handleClientDisconnect = () => {
    logger.info('Client disconnected during streaming', { requestId })
    abortController.abort()
    responseState.destroy()
  }

  // Listen for client disconnect
  res.on('close', handleClientDisconnect)
  res.on('finish', () => clearTimeout(timeoutRef))
  
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

  }, responseState, async (error, responseState) => {
    // Custom error handler for streaming
    logger.error('Streaming error handler called', {
      requestId,
      error: error.message
    })

    // Try to send error chunk if response is still writable
    if (responseState.res.canWrite()) {
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