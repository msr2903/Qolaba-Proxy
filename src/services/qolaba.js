
import axios from 'axios'
import { config } from '../config/index.js'
import { logger, logQolabaRequest } from './logger.js'
import { safeStringify } from '../utils/serialization.js'

export class QolabaApiClient {
  constructor(apiKey) {
    this.client = axios.create({
      baseURL: config.qolaba.baseUrl,
      timeout: config.qolaba.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    })

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Qolaba API request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: this.sanitizeHeaders(config.headers)
        })
        return config
      },
      (error) => {
        logger.error('Qolaba API request error', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Qolaba API response', {
          status: response.status,
          statusText: response.statusText,
          dataSize: safeStringify(response.data).length
        })
        return response
      },
      (error) => {
        logger.error('Qolaba API response error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message
        })
        return Promise.reject(error)
      }
    )
  }

  sanitizeHeaders(headers) {
    const sanitized = { ...headers }
    if (sanitized.Authorization) {
      sanitized.Authorization = 'Bearer [REDACTED]'
    }
    return sanitized
  }

  async streamChat(payload, onChunk) {
    const startTime = Date.now()
    
    try {
      const response = await this.client.post('/streamChat', payload, {
        responseType: 'stream',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        timeout: 60000 // 60 second timeout for streaming
      })

      let buffer = ''
      let totalOutput = ''
      let isStreamEnded = false
      
      return new Promise((resolve, reject) => {
        // Handle stream data with proper error handling
        const handleData = (chunk) => {
          try {
            if (isStreamEnded) {
              logger.warn('Received data after stream ended')
              return
            }
            
            buffer += chunk.toString()
            
            // Process complete SSE messages
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (line.trim() === '') continue
              
              try {
                // Parse JSON response from Qolaba
                const data = JSON.parse(line.trim())
                
                if (data.output !== null && data.output !== undefined) {
                  totalOutput += data.output
                  
                  try {
                    onChunk({
                      output: data.output,
                      done: false
                    })
                  } catch (chunkError) {
                    logger.error('Error in chunk callback', {
                      error: chunkError.message,
                      chunk: data.output?.substring(0, 100)
                    })
                    // Don't reject the promise, just continue
                  }
                }
                
                // Check if stream is complete
                if (data.output === null) {
                  isStreamEnded = true
                  const responseTime = Date.now() - startTime
                  logQolabaRequest('/streamChat', 'POST', payload, responseTime, 200)
                  
                  resolve({
                    output: totalOutput,
                    usage: {
                      promptTokens: data.promptTokens || 0,
                      completionTokens: data.completionTokens || 0,
                      totalTokens: (data.promptTokens || 0) + (data.completionTokens || 0)
                    }
                  })
                  return
                }
              } catch (parseError) {
                logger.warn('Failed to parse streaming response', {
                  line: line.substring(0, 100),
                  error: parseError.message
                })
              }
            }
          } catch (dataError) {
            logger.error('Error processing stream data', {
              error: dataError.message
            })
            // Don't reject immediately, let the stream continue
          }
        }

        // Handle stream errors
        const handleError = (error) => {
          if (isStreamEnded) return
          
          isStreamEnded = true
          const responseTime = Date.now() - startTime
          logQolabaRequest('/streamChat', 'POST', payload, responseTime, 'ERROR')
          
          logger.error('Stream error occurred', {
            error: error.message,
            code: error.code,
            responseTime: `${responseTime}ms`
          })
          
          reject(new Error(`Streaming error: ${error.message}`))
        }

        // Handle stream end
        const handleEnd = () => {
          if (isStreamEnded) return
          
          isStreamEnded = true
          const responseTime = Date.now() - startTime
          
          // If we didn't get a proper completion signal, resolve with what we have
          if (totalOutput.length > 0) {
            logQolabaRequest('/streamChat', 'POST', payload, responseTime, 200)
            resolve({
              output: totalOutput,
              usage: {
                promptTokens: 0,
                completionTokens: totalOutput.length / 4, // Rough estimate
                totalTokens: totalOutput.length / 4
              }
            })
          } else {
            logQolabaRequest('/streamChat', 'POST', payload, responseTime, 'ERROR')
            reject(new Error('Stream ended without completing'))
          }
        }

        // Set up event listeners with proper error handling
        response.data.on('data', handleData)
        response.data.on('error', handleError)
        response.data.on('end', handleEnd)
        
        // Handle stream timeout
        const timeout = setTimeout(() => {
          if (!isStreamEnded) {
            isStreamEnded = true
            response.data.destroy() // Clean up the stream
            reject(new Error('Streaming timeout'))
          }
        }, 55000) // Slightly less than the axios timeout

        // Clean up timeout when promise resolves/rejects
        Promise.resolve().finally(() => {
          clearTimeout(timeout)
        })
      })
    } catch (error) {
      const responseTime = Date.now() - startTime
      logQolabaRequest('/streamChat', 'POST', payload, responseTime, error.response?.status || 'ERROR')
      
      // Add more specific error handling
      if (error.code === 'ECONNABORTED') {
        throw new Error('Streaming request timeout')
      } else if (error.code === 'ECONNRESET') {
        throw new Error('Connection reset during streaming')
      } else {
        throw error
      }
    }
  }

  async chat(payload) {
    const startTime = Date.now()
    
    try {
      const response = await this.client.post('/chat', payload)
      const responseTime = Date.now() - startTime
      
      logQolabaRequest('/chat', 'POST', payload, responseTime, response.status)
      
      return {
        output: response.data.output,
        usage: {
          promptTokens: response.data.promptTokens || 0,
          completionTokens: response.data.completionTokens || 0,
          totalTokens: (response.data.promptTokens || 0) + (response.data.completionTokens || 0)
        }
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      logQolabaRequest('/chat', 'POST', payload, responseTime, error.response?.status || 'ERROR')
      throw error
    }
  }
  
  // Get status endpoint for health checks
  async getStatus() {
    try {
      const response = await this.client.get('/get-status')
      return response.data
    } catch (error) {
      logger.error('Failed to get status:', error)
      throw error
    }
  }

  async getModels() {
    try {
      // Since Qolaba doesn't have a models endpoint, return available models from config
      const availableModels = [
        {
          id: 'gpt-4.1-mini-2025-04-14',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'gpt-4.1-2025-04-14',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'gpt-4o-mini',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'claude-3-5-sonnet-20241022',
          object: 'model',
          created: Date.now(),
          owned_by: 'anthropic'
        },
        {
          id: 'gemini-1.5-pro',
          object: 'model',
          created: Date.now(),
          owned_by: 'google'
        },
        {
          id: 'gemini-1.5-flash',
          object: 'model',
          created: Date.now(),
          owned_by: 'google'
        }
      ]
      
      return {
        object: 'list',
        data: availableModels
      }
    } catch (error) {
      logger.error('Failed to get models:', error)
      throw error
    }
  }

  async getUsageInfo() {
    try {
      // This would need to be implemented based on Qolaba's actual usage API
      // For now, return a mock response
      return {
        credits_available: 1000,
        credits_used: 100,
        requests_today: 25,
        requests_this_month: 500
      }
    } catch (error) {
      logger.error('Failed to get usage info:', error)
      throw error
    }
  }
}

export default QolabaApiClient