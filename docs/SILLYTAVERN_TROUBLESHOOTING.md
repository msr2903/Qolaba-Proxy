# SillyTavern Integration Troubleshooting Guide

## Issue Summary

The "socket hang up" error reported by SillyTavern is actually caused by the upstream Qolaba API timing out, not by the proxy server itself. The proxy server is working correctly and handling the timeout gracefully.

## Root Cause Analysis

### What's Actually Happening

1. **SillyTavern sends request** → Proxy server receives it correctly
2. **Proxy server forwards request** → Qolaba API at `https://qolaba-server-b2b.up.railway.app/api/v1/studio`
3. **Qolaba API doesn't respond** → Times out after 120 seconds
4. **Proxy server handles timeout** → Sends proper error response to SillyTavern
5. **SillyTavern interprets as socket hang up** → Due to the long wait time

### Evidence from Logs

```
error: Qolaba API response error timeout of 120000ms exceeded
warn: Base timeout reached
info: Sent timeout error as streaming chunk
```

## Solutions

### 1. Immediate Workaround

Use a different model that might have better availability:

```json
{
  "model": "gpt-4o-mini",
  "messages": [...],
  "stream": true
}
```

### 2. Check Qolaba API Status

Verify if the Qolaba API is accessible:

```bash
curl -H "Authorization: Bearer your-test-api-key-here" \
     https://qolaba-server-b2b.up.railway.app/api/v1/studio/get-status
```

### 3. Configure Alternative Endpoint

If you have access to a different Qolaba API endpoint, update the `.env` file:

```env
QOLABA_BASE_URL=https://your-alternative-qolaba-api.com/api/v1/studio
```

### 4. Adjust Timeout Settings

Increase the timeout in `.env` (note: this may not help if the API is down):

```env
REQUEST_TIMEOUT=600000  # 10 minutes instead of 5
```

## SillyTavern Configuration

### Working Configuration

```json
{
  "endpoint": "http://localhost:3000/v1/chat/completions",
  "apiKey": "your-test-api-key-here",
  "model": "gpt-4.1-mini-2025-04-14",
  "stream": true,
  "temperature": 1,
  "max_tokens": 300
}
```

### Alternative Models to Try

- `gpt-4o-mini` (usually more responsive)
- `gpt-4.1-2025-04-14`
- `claude-3-5-sonnet-20241022`
- `gemini-1.5-flash`

## Debugging Steps

### 1. Test Proxy Server Directly

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-test-api-key-here" \
     -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello"}], "stream": true}'
```

### 2. Check Server Logs

Look for these key messages in the proxy server logs:

- `Qolaba API timeout detected` - Indicates upstream API issue
- `Sent timeout error as streaming chunk` - Proxy handled timeout correctly
- `Base timeout reached` - Unified timeout manager working

### 3. Monitor Network Connectivity

```bash
# Test connectivity to Qolaba API
ping qolaba-server-b2b.up.railway.app

# Test with telnet (if available)
telnet qolaba-server-b2b.up.railway.app 443
```

## Proxy Server Status Indicators

### Healthy Operation

- ✅ Server responds to `/health` endpoint
- ✅ Logs show request processing
- ✅ Timeout errors are handled gracefully
- ✅ Proper SSE formatting in responses

### Upstream API Issues

- ❌ `Qolaba API timeout detected` errors
- ❌ `timeout of 120000ms exceeded` messages
- ❌ Hanging request warnings
- ❌ No response from upstream API

## Long-term Solutions

### 1. Implement Fallback Mechanism

The proxy could be enhanced to:
- Try multiple Qolaba API endpoints
- Fall back to cached responses for common queries
- Implement retry logic with exponential backoff

### 2. Add Health Checks

Implement periodic health checks to the Qolaba API:
- Mark the service as unhealthy if API is down
- Return appropriate error messages to clients
- Automatically recover when API comes back online

### 3. Load Balancing

If multiple Qolaba API endpoints are available:
- Distribute requests across endpoints
- Automatically route around failed endpoints
- Implement circuit breaker pattern

## Contact Information

If the Qolaba API continues to be unavailable:

1. Check Qolaba service status page (if available)
2. Contact Qolaba support
3. Consider using alternative AI providers through the proxy

## Summary

The "socket hang up" error in SillyTavern is a symptom of the upstream Qolaba API being unresponsive or slow. The proxy server is working correctly and handling the timeout appropriately. The solution involves either:

1. Waiting for the Qolaba API to become available
2. Using alternative models that might be more responsive
3. Configuring an alternative Qolaba API endpoint
4. Implementing fallback mechanisms in the proxy

The proxy server itself is functioning correctly and provides proper error handling for these scenarios.