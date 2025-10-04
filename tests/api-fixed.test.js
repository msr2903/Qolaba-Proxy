import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock external dependencies to avoid actual HTTP requests
jest.mock('../src/services/qolaba.js');
jest.mock('../src/services/logger.js');

describe('Qoloba Proxy API Tests - Fixed', () => {
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
    it('should handle detailed health check', async () => {
      // Get the detailed health check route handler
      const detailedHealthHandler = healthRouter.stack.find(layer => layer.route?.path === '/detailed').route.stack[0].handle;
      
      await detailedHealthHandler(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: '1.0.0',
          service: 'qoloba-proxy',
          dependencies: expect.objectContaining({
            qolaba_api: expect.objectContaining({
              status: expect.any(String),
              response_time: expect.any(String),
              url: expect.any(String)
            })
          }),
          system: expect.objectContaining({
            memory_usage: expect.any(Object),
            cpu_usage: expect.any(Object),
            platform: expect.any(String),
            node_version: expect.any(String)
          }),
          config: expect.any(Object),
          environment: expect.any(String)
        })
      );
    });
  });

  describe('Models Endpoint Tests', () => {
    it('should handle models list request', async () => {
      // Get the models list route handler
      const modelsListHandler = modelsRouter.stack.find(layer => layer.route?.path === '/').route.stack[0].handle;
      
      // Execute the handler directly
      await modelsListHandler(mockReq, mockRes, mockNext);
      
      // Check if the handler called next() (indicating middleware processing)
      expect(mockNext).toHaveBeenCalled();
      
      // Verify the response was sent
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          object: 'list',
          data: expect.any(Array)
        })
      );
    });

    it('should handle model details request', async () => {
      // Get the model details route handler
      const modelDetailsHandler = modelsRouter.stack.find(layer => layer.route?.path === '/:model').route.stack[0].handle;
      
      mockReq.params = { model: 'gpt-4.1-mini-2025-04-14' };
      
      // Execute the handler directly
      await modelDetailsHandler(mockReq, mockRes, mockNext);
      
      // Check if the handler called next() (indicating middleware processing)
      expect(mockNext).toHaveBeenCalled();
      
      // Verify the response was sent
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
      const modelDetailsHandler = modelsRouter.stack.find(layer => layer.route?.path === '/:model').route.stack[0].handle;
      
      mockReq.params = { model: 'non-existent-model' };
      
      // Execute the handler directly
      await modelDetailsHandler(mockReq, mockRes, mockNext);
      
      // Check if the handler called next() (indicating middleware processing)
      expect(mockNext).toHaveBeenCalled();
      
      // Verify the error response was sent
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
});