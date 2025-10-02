import { logger } from '../services/logger.js'
import { translateQolabaToOpenAI, extractToolCalls } from './translator.js'
import { config } from '../config/index.js'

// Handle streaming response
export async function handleStreamingResponse(res, qolabaClient, qolabaPayload, requestId) {
  try {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    let fullResponse = ''
    let isFirstChunk = true

    // Start streaming
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

        // Send SSE formatted data
        res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`)

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

    // Send final chunk
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

    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()

    logger.info('Streaming completed successfully', {
      requestId,
      responseLength: fullResponse.length,
      model: qolabaPayload.model
    })

  } catch (error) {
    logger.error('Streaming failed', {
      requestId,
      error: error.message
    })

    // Send error chunk if possible
    try {
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
          message: error.message,
          type: 'api_error'
        }
      }

      res.write(`data: ${JSON.stringify(errorChunk)}\\n\\n`)
    } catch (writeError) {
      // If we can't even write the error, just close the connection
    }

    res.end()
    throw error
  }
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