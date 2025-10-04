# AI Knowledge Base - Qoloba Proxy Development

This document serves as a comprehensive knowledge base for AI assistants working on the Qoloba OpenAI-Compatible Proxy project. It contains important information about project structure, development workflows, common issues, and solutions to avoid relearning the same concepts repeatedly.

## Project Overview

The Qoloba Proxy is a Node.js application that provides OpenAI-compatible API endpoints while routing requests to the Qolaba API. This enables seamless integration with AI tools like Kilo Code, Roo Code, Cline, and any OpenAI-compatible applications.

## Key Architecture Components

### Core Structure
```
qoloba-proxy/
├── src/
│   ├── index.js                    # Main Express server entry point
│   ├── config/index.js             # Configuration management with model mappings
│   ├── middleware/                 # Express middleware (auth, logging, rate limiting)
│   ├── routes/                     # API route handlers (chat, models, health)
│   ├── services/                   # Business logic (Qolaba API client, logger)
│   └── utils/                      # Utility functions (translator, streaming)
├── tests/                          # Test files (unit, integration, performance)
├── docs/                           # Additional documentation
├── docker-compose.yml              # Docker configuration
├── Dockerfile                      # Docker build file
├── package.json                    # Node.js dependencies and scripts
├── .env.example                    # Environment variables template
├── README.md                       # Main documentation
├── CHANGELOG.md                    # Version history
└── ai.md                          # This knowledge base
```

### Critical Components

1. **Model Mapping System** (`src/config/index.js`)
   - Maps OpenAI model names to Qolaba models
   - Configurable default model fallback
   - Provider-specific model configurations

2. **API Client** (`src/services/qolaba.js`)
   - Handles Qolaba API communication
   - Supports streaming and non-streaming requests
   - Includes error handling and retry logic

3. **Request Translation** (`src/utils/translator.js`)
   - Converts OpenAI format to Qolaba format
   - Handles message translation and tool calling
   - Manages streaming vs non-streaming formats

4. **Authentication** (`src/middleware/auth.js`)
   - API key passthrough and override modes
   - Multiple header support (Bearer, x-api-key)
   - Query parameter fallback for testing

## Development Commands and Scripts

### Setup and Installation
```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development server with file watching
npm run dev

# Start production server
npm start
```

### Testing Commands
```bash
# Run all tests
npm test

# Run tests with file watching
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/unit/qolaba-client.test.js
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Docker Commands
```bash
# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run

# Build and run with Docker Compose
docker-compose up -d --build

# View logs
docker-compose logs -f qoloba-proxy

# Enter container for debugging
docker-compose exec qoloba-proxy /bin/bash
```

## Essential File Prompts for Updates

When updating files, use these structured prompts to ensure consistency:

### Configuration Updates (`src/config/index.js`)
```
Update the Qolaba proxy configuration to [specific change]. Ensure:
1. Model mappings are properly updated in the modelMappings object
2. Environment variables are correctly defined with proper defaults
3. Configuration validation is updated if needed
4. All changes maintain backward compatibility
5. Update the .env.example file accordingly
```

### API Route Updates (`src/routes/*.js`)
```
Update the [endpoint] route to [specific functionality]. Ensure:
1. Proper error handling with appropriate HTTP status codes
2. Request validation using validation middleware
3. Authentication middleware where required
4. Rate limiting considerations
5. OpenAI API compatibility is maintained
6. Comprehensive logging for debugging
7. Update corresponding tests
```

### Service Layer Updates (`src/services/*.js`)
```
Update the [service name] service to [specific change]. Ensure:
1. Proper error handling and logging
2. Configuration validation
3. Input sanitization
4. Output formatting consistency
5. Performance considerations
6. Update unit tests
```

### Middleware Updates (`src/middleware/*.js`)
```
Update the [middleware name] middleware to [specific functionality]. Ensure:
1. Error handling doesn't break the request chain
2. Request ID tracking is maintained
3. Logging is consistent with other middleware
4. Performance impact is minimal
5. Backward compatibility is maintained
```

## Common Issues and Solutions

### API Key Issues
**Problem**: "Invalid API key" errors
**Solution**: 
1. Check API_KEY_MODE configuration (passthrough vs override)
2. Verify API key format and validity
3. Check .env file configuration
4. Ensure proper header parsing in auth middleware

### Streaming Issues
**Problem**: Streaming responses not working
**Solution**:
1. Verify SSE headers are properly set
2. Check for proper response.end() calls
3. Ensure error handling doesn't leave connections open
4. Test with curl to verify SSE format

### Model Mapping Issues
**Problem**: "Model not found" errors
**Solution**:
1. Check modelMappings in config/index.js
2. Verify Qolaba model availability
3. Update mappings with correct provider/model combinations
4. Test with /v1/models endpoint

### Docker Issues
**Problem**: Container fails to start
**Solution**:
1. Check .env file mounting
2. Verify port binding conflicts
3. Check Dockerfile entry point
4. Review docker-compose.yml configuration
5. Check logs with `docker-compose logs -f`

### Performance Issues
**Problem**: Slow response times
**Solution**:
1. Check Qolaba API connectivity
2. Verify request timeout settings
3. Monitor rate limiting impacts
4. Check for memory leaks
5. Review logging overhead in production

## Testing Strategies

### Unit Testing
- Test individual functions and methods
- Mock external dependencies (Qolaba API)
- Test error conditions and edge cases
- Verify configuration validation

### Integration Testing
- Test complete request/response flows
- Test streaming vs non-streaming modes
- Test authentication and authorization
- Test rate limiting and error handling

### Performance Testing
- Test concurrent request handling
- Measure response times
- Test streaming performance
- Monitor memory usage

### API Testing
```bash
# Test basic chat completion
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model": "gpt-4.1-mini-2025-04-14", "messages": [{"role": "user", "content": "Hello"}], "stream": false}'

# Test streaming
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model": "gpt-4.1-mini-2025-04-14", "messages": [{"role": "user", "content": "Hello"}], "stream": true}'

# Test models endpoint
curl http://localhost:3000/v1/models -H "Authorization: Bearer $API_KEY"

# Test health check
curl http://localhost:3000/health
```

## Debugging Techniques

### Enable Debug Logging
```bash
# Set environment variables
LOG_LEVEL=debug
ENABLE_VERBOSE_LOGGING=true
npm start
```

### Request Tracking
- Each request has a unique ID (X-Request-ID header)
- Use request ID to trace logs through the system
- Check middleware logs for request flow

### Common Debugging Scenarios
1. **Authentication Issues**: Check auth middleware logs
2. **Translation Issues**: Check translator logs and payload comparisons
3. **Qolaba API Issues**: Check qolaba service logs and network connectivity
4. **Streaming Issues**: Check response headers and connection state

## Development Best Practices

### Code Organization
- Keep business logic in services
- Use middleware for cross-cutting concerns
- Maintain separation of concerns
- Use consistent error handling patterns

### Configuration Management
- Environment-based configuration
- Default values for all settings
- Configuration validation on startup
- Separate development and production configs

### Error Handling
- Use structured error responses
- Log errors with context and request IDs
- Graceful degradation when possible
- Consistent error format across endpoints

### Security Considerations
- Never log full API keys
- Validate all inputs
- Implement rate limiting
- Use HTTPS in production
- Sanitize error messages in production

## Performance Optimization

### Caching Strategies
- Cache model information
- Cache configuration data
- Consider response caching for static data

### Connection Management
- Use connection pooling for HTTP clients
- Set appropriate timeouts
- Handle connection errors gracefully
- Monitor concurrent connections

### Memory Management
- Monitor memory usage in streaming scenarios
- Clean up resources properly
- Avoid memory leaks in long-running processes

## Deployment Considerations

### Environment Setup
- Production environment variables
- Proper logging configuration
- Health check configuration
- Monitoring and alerting

### Docker Deployment
- Multi-stage builds for optimization
- Non-root user for security
- Proper health checks
- Volume mounting for logs

### Monitoring
- Request/response metrics
- Error rate monitoring
- Performance tracking
- Resource usage monitoring

## Future Enhancement Ideas

1. **Additional Model Support**: Add more model providers and mappings
2. **Advanced Tool Calling**: Enhanced tool discovery and execution
3. **Caching Layer**: Redis or in-memory caching for responses
4. **Analytics Dashboard**: Real-time usage and performance metrics
5. **Multi-tenant Support**: Separate configurations per user/organization
6. **Webhook Support**: Async processing with webhooks
7. **Rate Limiting per User**: User-specific rate limits
8. **Request Queuing**: Handle high loads with job queues
9. **Load Balancing**: Multiple proxy instances with load balancing
10. **Enhanced Monitoring**: Prometheus metrics and Grafana dashboards

## Quick Reference Commands

### Start Development
```bash
npm install
cp .env.example .env
npm run dev
```

### Run Tests
```bash
npm test
npm run test:coverage
```

### Docker Operations
```bash
docker-compose up -d --build
docker-compose logs -f
docker-compose down
```

### API Testing
```bash
# Health check
curl http://localhost:3000/health

# Models list
curl http://localhost:3000/v1/models -H "Authorization: Bearer $API_KEY"

# Chat completion
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model": "gpt-4.1-mini-2025-04-14", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

**Note**: This document should be updated regularly with new learnings, solutions to common problems, and evolving best practices. It serves as institutional memory for the project.