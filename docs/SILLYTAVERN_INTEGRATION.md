# SillyTavern Integration Guide

## Overview

This guide provides detailed instructions for integrating SillyTavern with the Qoloba Proxy server, including configuration steps, troubleshooting tips, and best practices.

## Prerequisites

- Qoloba Proxy server running and accessible
- SillyTavern desktop application or web version
- Valid Qolaba API key (or use test key for development)

## Quick Setup

### 1. Start Qoloba Proxy

```bash
# Navigate to proxy directory
cd D:\AI\qoloba-proxy2

# Start the server
npm start
```

The proxy will start on `http://localhost:3000` by default.

### 2. Configure SillyTavern

1. Open SillyTavern
2. Go to **Settings** > **API Configuration**
3. Select **OpenAI** as the API provider
4. Configure the following settings:

#### Basic Configuration
- **API URL**: `http://localhost:3000`
- **API Key**: `your-test-api-key-here` (test key)
- **Model**: `gpt-4.1-mini-2025-04-14`

#### Advanced Configuration
- **Streaming**: Enabled (recommended)
- **Max Tokens**: 4096
- **Temperature**: 0.7
- **Timeout**: 120000 (120 seconds)

### 3. Test the Connection

1. Go to the chat interface
2. Type a simple message like "Hello, test connection"
3. Verify you receive a response without errors

## Available Models

The proxy supports the following models for SillyTavern:

### OpenAI Models
- `gpt-4.1-mini-2025-04-14` (recommended for testing)
- `gpt-4.1-2025-04-14`
- `gpt-4o-mini`
- `gpt-4o`

### ClaudeAI Models
- `claude-3-7-sonnet-latest`
- `claude-opus-4-20250514`
- `claude-sonnet-4-20250514`

### GeminiAI Models
- `gemini-2.5-pro`
- `gemini-2.5-flash`

### OpenRouterAI Models
- `x-ai/grok-3-beta`
- `perplexity/sonar-pro`
- `deepseek/deepseek-chat`

## Configuration Examples

### Basic Production Setup

```json
{
  "api_url": "http://localhost:3000",
  "api_key": "your-production-api-key",
  "model": "gpt-4.1-mini-2025-04-14",
  "streaming": true,
  "max_tokens": 4096,
  "temperature": 0.7,
  "timeout": 120000
}
```

### Advanced Setup with Custom Model

```json
{
  "api_url": "http://localhost:3000",
  "api_key": "your-production-api-key",
  "model": "claude-3-7-sonnet-latest",
  "streaming": true,
  "max_tokens": 8192,
  "temperature": 0.5,
  "timeout": 180000,
  "presence_penalty": 0.1,
  "frequency_penalty": 0.1
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "Socket Hang Up" Error

**Problem**: Connection drops during streaming responses

**Solution**: 
- Ensure proxy server is running the latest version with timeout fixes
- Increase timeout value in SillyTavern to 120000ms
- Check proxy server logs for detailed error information

#### 2. "Model Not Found" Error

**Problem**: Selected model is not available

**Solution**:
- Use the models endpoint to check availability: `curl http://localhost:3000/v1/models`
- Try with `gpt-4.1-mini-2025-04-14` first
- Check proxy logs for model mapping issues

#### 3. "Connection Refused" Error

**Problem**: Cannot connect to proxy server

**Solution**:
- Verify proxy server is running on correct port (default: 3000)
- Check firewall settings
- Ensure no other application is using port 3000

#### 4. Slow Response Times

**Problem**: Responses take too long to arrive

**Solution**:
- Check network connectivity to Qolaba API
- Consider using a closer model endpoint
- Monitor proxy server performance metrics

### Debug Mode

Enable verbose logging in the proxy server:

```bash
# Set environment variables
set LOG_LEVEL=debug
set ENABLE_VERBOSE_LOGGING=true

# Start server
npm start
```

This will provide detailed logs for troubleshooting connection issues.

## Performance Optimization

### Recommended Settings for Best Performance

1. **Timeout Settings**:
   - SillyTavern timeout: 120000ms (2 minutes)
   - Proxy timeout: 120000ms (configured automatically)

2. **Connection Settings**:
   - Enable connection reuse in SillyTavern
   - Use streaming for better user experience
   - Keep max tokens reasonable (4096-8192)

3. **Model Selection**:
   - Use `gpt-4.1-mini-2025-04-14` for faster responses
   - Use advanced models only when needed
   - Consider response time vs. quality trade-offs

### Monitoring

Monitor proxy server health:

```bash
# Check server health
curl http://localhost:3000/health

# Check detailed metrics
curl http://localhost:3000/health/detailed

# Monitor active requests
curl http://localhost:3000/concurrency
```

## Security Considerations

### API Key Management

1. **Development**: Use the provided test key
2. **Production**: Use your own Qolaba API key
3. **Security**: Never expose API keys in client-side code

### Network Security

1. **Firewall**: Configure firewall to allow SillyTavern → Proxy communication
2. **HTTPS**: Use HTTPS in production environments
3. **Access Control**: Limit proxy access to trusted clients

## Advanced Features

### Custom Headers

The proxy supports custom headers for advanced configurations:

```javascript
// In SillyTavern custom headers
{
  "X-Custom-Model": "gpt-4.1-mini-2025-04-14",
  "X-Timeout": "120000",
  "X-Priority": "high"
}
```

### Tool Calling

The proxy supports OpenAI-compatible tool calling:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "example_function",
        "description": "Example function description",
        "parameters": {
          "type": "object",
          "properties": {
            "param1": {"type": "string"}
          }
        }
      }
    }
  ]
}
```

### Streaming Format

The proxy provides OpenAI-compatible streaming responses:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4.1-mini-2025-04-14","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: [DONE]
```

## FAQ

### Q: Can I use SillyTavern with the proxy remotely?
A: Yes, but ensure the proxy is accessible from your network and configure proper security measures.

### Q: What's the best model for SillyTavern?
A: `gpt-4.1-mini-2025-04-14` offers the best balance of speed and quality for most use cases.

### Q: How do I improve response speed?
A: Use smaller models, reduce max tokens, and ensure good network connectivity.

### Q: Can I use multiple models simultaneously?
A: Yes, you can switch between models in SillyTavern settings without restarting the proxy.

### Q: What if I encounter errors not covered here?
A: Check the proxy server logs, enable debug mode, and refer to the main troubleshooting guide.

## Support

For additional support:

1. Check proxy server logs for detailed error information
2. Enable debug mode for verbose logging
3. Refer to the main troubleshooting guide at `docs/TROUBLESHOOTING.md`
4. Test with curl to isolate the issue
5. Report issues with detailed logs and configuration

## Version Compatibility

- **SillyTavern**: v1.0+ (all recent versions)
- **Proxy**: v1.0.0+ (with timeout fixes)
- **Node.js**: v18.0.0+
- **Qolaba API**: Current version

## Changelog

### v1.0.0
- Initial SillyTavern support
- Timeout coordination fixes
- Enhanced SSE formatting
- Improved error handling
- Connection stability improvements