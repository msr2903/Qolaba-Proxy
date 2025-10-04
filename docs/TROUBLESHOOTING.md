# Qoloba Proxy Troubleshooting Guide

## Common Issues and Solutions

### 1. Streaming Request Timeouts

**Problem**: Requests timing out after 30-90 seconds with "Streaming request timeout" errors.

**Symptoms**:
- `error: Qolaba API response error timeout of 90000ms exceeded`
- `warn: Base timeout reached`
- `error: Streaming request timeout`

**Root Cause**: Timeout configuration mismatch between client and server.

**Solution**:
```bash
# PowerShell
cd D:\AI\qoloba-proxy2; $env:REQUEST_TIMEOUT="120000"; $env:NODE_ENV="development"; npm start

# Command Prompt
cd /d D:\AI\qoloba-proxy2 && set REQUEST_TIMEOUT=120000 && set NODE_ENV=development && npm start
```

**Configuration Changes**:
- Set `REQUEST_TIMEOUT=120000` (2 minutes) to accommodate upstream API latency
- Ensure `NODE_ENV=development` for proper logging

### 2. Model Not Found Errors

**Problem**: Kilo Code reports "Model not found" when selecting models from the `/v1/models` endpoint.

**Symptoms**:
- `warn: Model not found in mappings, using default`
- Models listed in `/v1/models` but not mapped in configuration

**Root Cause**: Model listing and model mapping are out of sync.

**Solution**:
The configuration has been updated to include all models returned by the `/v1/models` endpoint:

**Fixed Models**:
- OpenRouterAI models: `x-ai/grok-3-beta`, `perplexity/sonar-pro`, etc.
- OpenAI models: `o3-mini`, `o1`, `o3`, `o4-mini-2025-04-16`
- All models now have proper mappings to Qolaba API equivalents

**Enhanced Logging**:
- Model mapping issues now log available models for debugging
- Total model count logged for verification

### 3. "Cannot Set Headers After Sent" Errors

**Problem**: Race conditions in streaming response handling.

**Symptoms**:
- `error: Cannot set headers after they are sent to the client`
- `warn: End callback failed after headers sent, suppressing`

**Root Cause**: Multiple systems trying to terminate the same response simultaneously.

**Solution**:
- Implemented coordinated termination system in `ResponseManager`
- Added proper state tracking to prevent duplicate operations
- Enhanced error handling for streaming responses

### 4. Port Already in Use

**Problem**: Server fails to start with "EADDRINUSE: address already in use".

**Solution**:
```bash
# Kill existing Node.js processes
taskkill /F /IM node.exe

# Then restart with correct configuration
```

## Environment Variables

### Required for Production
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `REQUEST_TIMEOUT`: Request timeout in milliseconds (recommended: 120000)

### Optional
- `QOLABA_BASE_URL`: Qolaba API endpoint
- `DEFAULT_MODEL`: Default model to use
- `LOG_LEVEL`: Logging level (info/debug/error)

## Model Mappings

The proxy supports the following model categories:

### OpenAI Models
- `gpt-4.1-mini-2025-04-14` → `gpt-4.1-mini-2025-04-14`
- `gpt-4.1-2025-04-14` → `gpt-4.1-2025-04-14`
- `gpt-4o-mini` → `gpt-4o-mini`
- `o3-mini` → `gpt-4.1-mini-2025-04-14` (mapped)
- `o1` → `gpt-4.1-2025-04-14` (mapped)

### ClaudeAI Models
- `claude-3-7-sonnet-latest` → `claude-3-7-sonnet-latest`
- `claude-opus-4-20250514` → `claude-opus-4-20250514`

### GeminiAI Models
- `gemini-2.5-pro` → `gemini-2.5-pro`
- `gemini-2.5-flash` → `gemini-2.5-flash`

### OpenRouterAI Models
- `grok-3-beta` → `x-ai/grok-3-beta`
- `x-ai/grok-3-beta` → `x-ai/grok-3-beta`
- `perplexity/sonar-pro` → `perplexity/sonar-pro`
- `deepseek/deepseek-chat` → `deepseek/deepseek-chat`

## Debugging

### Enable Verbose Logging
```bash
# PowerShell
$env:LOG_LEVEL="debug"; $env:ENABLE_VERBOSE_LOGGING="true"; npm start

# Command Prompt
set LOG_LEVEL=debug && set ENABLE_VERBOSE_LOGGING=true && npm start
```

### Check Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Real-time logs: Console output

### Test Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Models list
curl http://localhost:3000/v1/models

# Chat completion (streaming)
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1-mini-2025-04-14","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```

## Performance Tuning

### Timeout Settings
- `REQUEST_TIMEOUT`: 120000ms (2 minutes) - Recommended for production
- `CONNECTION_TIMEOUT`: 30000ms (30 seconds) - Connection establishment
- `SOCKET_TIMEOUT`: 60000ms (1 minute) - Socket inactivity

### Concurrency
- `CONCURRENT_REQUESTS_LIMIT`: 100 - Maximum concurrent requests
- `MAX_SOCKETS`: 100 - Maximum socket connections

## Monitoring

### Health Monitoring
- Endpoint: `/health`
- Metrics: Response times, error rates, active connections
- Auto-reset: Health data resets on server restart

### Performance Metrics
- Average response time tracking
- High response time alerts (>30 seconds)
- Request success/failure rates

## Security

### API Key Handling
- Supports passthrough mode (forwards client API keys)
- Supports override mode (uses server-side API key)
- API keys are redacted in logs

### CORS Configuration
- Default: Allow all origins (`*`)
- Configurable via `CORS_ORIGIN` environment variable

## Support

If issues persist after applying these solutions:

1. Check the logs for specific error messages
2. Verify environment variables are set correctly
3. Ensure the Qolaba API is accessible from your network
4. Test with a simple model first (e.g., `gpt-4.1-mini-2025-04-14`)

For additional support, provide:
- Full error logs
- Environment configuration
- Request payload that caused the issue
- Server version and Node.js version