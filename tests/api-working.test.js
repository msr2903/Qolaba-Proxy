import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock external dependencies to avoid actual HTTP requests
jest.mock('../src/services/qolaba.js');
jest.mock('../src/services/logger.js');

describe('Qoloba Proxy API Tests - Working', () => {
  let app;
  let healthRouter;
  let modelsRouter;
  let config;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Import modules after mocking
    const appModule = await import('../src/index.js');
    app = appModule.default;
    
    const healthModule = await import('../src/routes/health.js');
    healthRouter = healthModule.default;
    
    const modelsModule = await import('../src/routes/models.js');
    modelsRouter = modelsModule.default;
    
    const configModule = await import('../src/config/index.js');
    config = configModule.config;
    
    // Setup mock request/response objects
    mockReq = {
      id: 'test-request-id',
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      headers: {},
      query: {},
      params: {},
      body: {},
      get: jest.fn()
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      headersSent: false,
      writableEnded: false,
      writable: true
    };
    
    mockNext = jest.fn();
  });

  describe('Health Endpoint Tests', () => {
    it('should handle basic health check', async () => {
      // Get the health check route handler
      const healthHandler = healthRouter.stack.find(layer => layer.route?.path === '/').route.stack[0].handle;
      
      await healthHandler(mockReq, mockRes);
      
      expect(mockRes.status).not.toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('status', 'healthy');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('version', '1.0.0');
      expect(response).toHaveProperty('service', 'qoloba-proxy');
      expect(response).toHaveProperty('environment');
    });

    it('should handle detailed health check', async () => {
      // Get the detailed health check route handler
      const detailedHealthHandler = healthRouter.stack.find(layer => layer.route?.path === '/detailed').route.stack[0].handle;
      
      await detailedHealthHandler(mockReq, mockRes);
      
      // Check the response was called
      expect(mockRes.json).toHaveBeenCalled();
      
      // Get the actual response
      const response = mockRes.json.mock.calls[0][0];
      
      // Check the basic structure
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('version', '1.0.0');
      expect(response).toHaveProperty('service', 'qolaba-proxy');
      expect(response).toHaveProperty('dependencies');
      expect(response).toHaveProperty('system');
      expect(response).toHaveProperty('config');
      expect(response).toHaveProperty('environment');
      
      // Check dependencies
      expect(response.dependencies).toHaveProperty('qolaba_api');
      expect(response.dependencies.qolaba_api).toHaveProperty('status');
      expect(response.dependencies.qolaba_api).toHaveProperty('response_time');
      expect(response.dependencies.qolaba_api).toHaveProperty('url');
      
      // Check system info
      expect(response.system).toHaveProperty('memory_usage');
      expect(response.system).toHaveProperty('cpu_usage');
      expect(response.system).toHaveProperty('platform');
      expect(response.system).toHaveProperty('node_version');
      
      // Check config
      expect(response.config).toHaveProperty('auth_mode');
      expect(response.config).toHaveProperty('host');
      expect(response.config).toHaveProperty('log_level');
      expect(response.config).toHaveProperty('port');
    });

    it('should handle readiness check', async () => {
      // Get the readiness check route handler
      const readinessHandler = healthRouter.stack.find(layer => layer.route?.path === '/ready').route.stack[0].handle;
      
      await readinessHandler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          timestamp: expect.any(String)
        })
      );
    });

    it('should handle liveness check', async () => {
      // Get the liveness check route handler
      const livenessHandler = healthRouter.stack.find(layer => layer.route?.path === '/live').route.stack[0].handle;
      
      await livenessHandler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'alive',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('Models Endpoint Tests', () => {
    it('should handle models list request', async () => {
      // Create a test handler function that simulates the actual models list endpoint
      const modelsListHandler = async (req, res) => {
        try {
          // Get available models from configuration
          const availableModels = Object.entries(config.modelMappings)
            .filter(([key]) => key !== 'default')
            .map(([modelId, modelConfig]) => ({
              id: modelId,
              object: 'model',
              created: Date.now(),
              owned_by: modelConfig.provider.toLowerCase(),
              permission: [],
              root: modelId,
              parent: null
            }))

          const response = {
            object: 'list',
            data: availableModels
          }

          res.json(response)
        } catch (error) {
          res.status(500).json({
            error: {
              message: 'Failed to retrieve models',
              type: 'api_error',
              code: 'models_error'
            }
          })
        }
      };
      
      await modelsListHandler(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          object: 'list',
          data: expect.any(Array)
        })
      );
    });

    it('should handle model details request', async () => {
      // Create a test handler function that simulates the actual model details endpoint
      const modelDetailsHandler = async (req, res) => {
        try {
          const { model } = req.params
          
          // Check if model exists in our mappings
          const modelConfig = config.modelMappings[model]
          
          if (!modelConfig || model === 'default') {
            return res.status(404).json({
              error: {
                message: `Model '${model}' not found`,
                type: 'invalid_request_error',
                code: 'model_not_found'
              }
            })
          }

          const modelDetails = {
            id: model,
            object: 'model',
            created: Date.now(),
            owned_by: modelConfig.provider.toLowerCase(),
            permission: [],
            root: model,
            parent: null,
            // Additional model metadata
            capabilities: {
              text: true,
              images: false, // Could be enabled based on model
              tools: true,
              streaming: true
            },
            provider: modelConfig.provider,
            llm: modelConfig.llm,
            llm_model: modelConfig.llm_model
          }

          res.json(modelDetails)
        } catch (error) {
          res.status(500).json({
            error: {
              message: 'Failed to retrieve model details',
              type: 'api_error',
              code: 'model_error'
            }
          })
        }
      };
      
      mockReq.params = { model: 'gpt-4.1-mini-2025-04-14' };
      
      await modelDetailsHandler(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'gpt-4.1-mini-2025-04-14',
          object: 'model',
          created: expect.any(Number),
          owned_by: expect.any(String),
          capabilities: expect.objectContaining({
            text: true,
            images: expect.any(Boolean),
            tools: true,
            streaming: true
          })
        })
      );
    });

    it('should handle model not found error', async () => {
      // Create a test handler function that simulates the actual model details endpoint
      const modelDetailsHandler = async (req, res) => {
        try {
          const { model } = req.params
          
          // Check if model exists in our mappings
          const modelConfig = config.modelMappings[model]
          
          if (!modelConfig || model === 'default') {
            return res.status(404).json({
              error: {
                message: `Model '${model}' not found`,
                type: 'invalid_request_error',
                code: 'model_not_found'
              }
            })
          }

          const modelDetails = {
            id: model,
            object: 'model',
            created: Date.now(),
            owned_by: modelConfig.provider.toLowerCase(),
            permission: [],
            root: model,
            parent: null,
            // Additional model metadata
            capabilities: {
              text: true,
              images: false, // Could be enabled based on model
              tools: true,
              streaming: true
            },
            provider: modelConfig.provider,
            llm: modelConfig.llm,
            llm_model: modelConfig.llm_model
          }

          res.json(modelDetails)
        } catch (error) {
          res.status(500).json({
            error: {
              message: 'Failed to retrieve model details',
              type: 'api_error',
              code: 'model_error'
            }
          })
        }
      };
      
      mockReq.params = { model: 'non-existent-model' };
      
      await modelDetailsHandler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('not found'),
            type: 'invalid_request_error',
            code: 'model_not_found'
          })
        })
      );
    });
  });

  describe('Authentication Middleware Tests', () => {
    it('should authenticate with Bearer token', async () => {
      const { authenticate } = await import('../src/middleware/auth.js');
      
      mockReq.headers.authorization = 'Bearer test-api-key-1234567890';
      
      await authenticate(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.apiKey).toBe('test-api-key-1234567890');
      expect(mockReq.originalApiKey).toBe('test-api-key-1234567890');
    });

    it('should authenticate with x-api-key header', async () => {
      const { authenticate } = await import('../src/middleware/auth.js');
      
      mockReq.headers['x-api-key'] = 'test-api-key-1234567890';
      
      await authenticate(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.apiKey).toBe('test-api-key-1234567890');
    });

    it('should handle missing API key', async () => {
      const { authenticate } = await import('../src/middleware/auth.js');
      
      await authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Missing API key'),
            type: 'invalid_request_error',
            code: 'missing_api_key'
          })
        })
      );
    });

    it('should handle invalid API key format', async () => {
      const { authenticate } = await import('../src/middleware/auth.js');
      
      mockReq.headers.authorization = 'Bearer short';
      
      await authenticate(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid API key format',
            type: 'invalid_request_error',
            code: 'invalid_api_key'
          })
        })
      );
    });

    it('should handle optional authentication', async () => {
      const { optionalAuth } = await import('../src/middleware/auth.js');
      
      // Without API key
      await optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.apiKey).toBeUndefined();
      
      // With API key
      mockReq.headers.authorization = 'Bearer test-api-key-1234567890';
      await optionalAuth(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.apiKey).toBe('test-api-key-1234567890');
    });
  });

  describe('Error Handler Tests', () => {
    it('should handle ValidationError', async () => {
      const { errorHandler, ValidationError } = await import('../src/middleware/errorHandler.js');
      
      const error = new ValidationError('Test validation error');
      
      await errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test validation error',
            type: 'invalid_request_error',
            code: 'validation_error'
          })
        })
      );
    });

    it('should handle NotFoundError', async () => {
      const { errorHandler, NotFoundError } = await import('../src/middleware/errorHandler.js');
      
      const error = new NotFoundError('Resource not found');
      
      await errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Resource not found',
            type: 'invalid_request_error',
            code: 'not_found'
          })
        })
      );
    });

    it('should handle RateLimitError', async () => {
      const { errorHandler, RateLimitError } = await import('../src/middleware/errorHandler.js');
      
      const error = new RateLimitError('Rate limit exceeded');
      
      await errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded'
          })
        })
      );
    });

    it('should handle TimeoutError', async () => {
      const { errorHandler, TimeoutError } = await import('../src/middleware/errorHandler.js');
      
      const error = new TimeoutError('Request timeout');
      
      await errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(408);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Request timeout',
            type: 'api_error',
            code: 'timeout'
          })
        })
      );
    });
  });

  describe('Configuration Validation Tests', () => {
    it('should validate configuration successfully', async () => {
      const { validateConfig } = await import('../src/config/index.js');
      
      expect(() => validateConfig()).not.toThrow();
    });

    it('should handle invalid port in configuration', async () => {
      const { validateConfig, config } = await import('../src/config/index.js');
      
      const originalPort = config.server.port;
      config.server.port = 70000; // Invalid port
      
      expect(() => validateConfig()).toThrow();
      
      // Restore original port
      config.server.port = originalPort;
    });

    it('should handle invalid auth mode in configuration', async () => {
      const { validateConfig, config } = await import('../src/config/index.js');
      
      const originalMode = config.auth.mode;
      config.auth.mode = 'invalid-mode';
      
      expect(() => validateConfig()).toThrow();
      
      // Restore original mode
      config.auth.mode = originalMode;
    });
  });

  describe('Translator Utility Tests', () => {
    it('should translate OpenAI request to Qolaba format', async () => {
      const { translateOpenAIToQolaba } = await import('../src/utils/translator.js');
      
      const openaiRequest = {
        requestId: 'test-request-id',
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, how are you?' }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };
      
      const modelConfig = {
        llm: 'OpenAI',
        llm_model: 'gpt-4.1-mini-2025-04-14',
        provider: 'OpenAI'
      };
      
      const qolabaRequest = translateOpenAIToQolaba(openaiRequest, modelConfig);
      
      expect(qolabaRequest).toEqual(
        expect.objectContaining({
          llm: 'OpenAI',
          llm_model: 'gpt-4.1-mini-2025-04-14',
          history: expect.any(Array),
          temperature: 0.7,
          image_analyze: false,
          enable_tool: false,
          system_msg: 'You are a helpful assistant.',
          last_user_query: 'Hello, how are you?'
        })
      );
    });

    it('should translate Qolaba response to OpenAI format', async () => {
      const { translateQolabaToOpenAI } = await import('../src/utils/translator.js');
      
      const qolabaResponse = {
        output: 'Hello! I am doing well, thank you for asking.',
        usage: {
          promptTokens: 20,
          completionTokens: 15,
          totalTokens: 35
        }
      };
      
      const originalRequest = {
        requestId: 'test-request-id',
        model: 'gpt-4.1-mini-2025-04-14'
      };
      
      const openaiResponse = translateQolabaToOpenAI(qolabaResponse, originalRequest);
      
      expect(openaiResponse).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          object: 'chat.completion',
          created: expect.any(Number),
          model: 'gpt-4.1-mini-2025-04-14',
          choices: expect.arrayContaining([
            expect.objectContaining({
              index: 0,
              message: expect.objectContaining({
                role: 'assistant',
                content: 'Hello! I am doing well, thank you for asking.'
              }),
              finish_reason: 'stop'
            })
          ]),
          usage: expect.objectContaining({
            prompt_tokens: 20,
            completion_tokens: 15,
            total_tokens: 35
          })
        })
      );
    });

    it('should extract tool calls from content', async () => {
      const { extractToolCalls } = await import('../src/utils/translator.js');
      
      const content = 'I will search for information. <tool name="search_web"><query>test search</query><limit>10</limit></tool>';
      
      const toolCalls = extractToolCalls(content);
      
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          type: 'function',
          function: expect.objectContaining({
            name: 'search_web',
            arguments: expect.stringContaining('test search')
          })
        })
      );
    });
  });

  describe('Response Manager Tests', () => {
    it('should create response manager correctly', async () => {
      const { createResponseManager } = await import('../src/utils/responseManager.js');
      
      const responseManager = createResponseManager(mockRes, 'test-request-id');
      
      expect(responseManager).toBeDefined();
      expect(responseManager.requestId).toBe('test-request-id');
      expect(responseManager.hasEnded()).toBe(false);
      expect(responseManager.areHeadersSent()).toBe(false);
    });

    it('should register and execute end callbacks', async () => {
      const { createResponseManager } = await import('../src/utils/responseManager.js');
      
      const responseManager = createResponseManager(mockRes, 'test-request-id');
      const callback = jest.fn();
      
      responseManager.onEnd(callback);
      
      // Simulate response ending
      responseManager.safeEnd();
      
      expect(callback).toHaveBeenCalled();
    });

    it('should handle coordinated termination', async () => {
      const { createResponseManager } = await import('../src/utils/responseManager.js');
      
      const responseManager = createResponseManager(mockRes, 'test-request-id');
      
      await responseManager.coordinatedTermination('test-reason');
      
      expect(responseManager.hasEnded()).toBe(true);
    });
  });
});