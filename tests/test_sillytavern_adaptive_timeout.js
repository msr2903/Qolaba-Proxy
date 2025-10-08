/**
 * Simple local test script to simulate SillyTavern-like payloads and measure
 * the adaptive timeout behavior introduced in the QoLaba client.
 * 
 * This script focuses on exercising the new complexity-based timeout helpers
 * without requiring a live upstream call. It instantiates the QolabaApiClient
 * and prints:
 * - computed complexity for given payloads
 * - adaptive timeout values
 * 
 * Usage:
 *   npm test or node tests/test_sillytavern_adaptive_timeout.js
 * 
 * Environment:
 *   Set QOLABA_API_KEY to a valid API key if you want to run actual streaming tests.
 */

// Import the client class
const { default: QolabaApiClient } = require('../src/services/qolaba.js');

// Instantiate with a dummy key in case you want to run actual requests.
// If you want to run real streaming tests, set the environment variable and uncomment.
const apiKey = process.env.QOLABA_API_KEY || 'test-key';
const qolaba = new QolabaApiClient(apiKey);

// Simple payload (1 user message, no system messages)
const simplePayload = {
  model: 'gpt-4.1-mini-2025-04-14',
  messages: [
    { role: 'user', content: 'Hello' }
  ],
  max_tokens: 100,
  temperature: 0.7
};

// SillyTavern-like payload (includes system messages)
const sillyPayload = {
  model: 'gpt-4.1-mini-2025-04-14',
  messages: [
    { role: 'system', content: "Write Assistant's next reply in a fictional chat between Assistant and User." },
    { role: 'system', content: "[Start a new Chat]" },
    { role: 'user', content: 'hi' }
  ],
  max_tokens: 300,
  temperature: 1.0
};

// Helper to log results
function logResults(label, payload) {
  const complexity = qolaba.analyzeRequestComplexity(payload);
  const timeout = qolaba.calculateAdaptiveTimeout(complexity);
  console.log(`=== ${label} payload ===`);
  console.log(`- complexity: ${complexity}`);
  console.log(`- adaptive timeout: ${timeout} ms`);
  console.log(`- payload size: ${Buffer.byteLength(JSON.stringify(payload), 'utf8')} bytes`);
  if (payload.messages && payload.messages.length > 0) {
    const sysCount = payload.messages.filter(m => m.role === 'system').length;
    console.log(`- system messages: ${sysCount}`);
  }
  console.log('');
}

(async () => {
  // Log results for both payloads
  logResults('Simple', simplePayload);
  logResults('SillyTavern-like', sillyPayload);

  // If you want to run actual streaming tests, uncomment below after setting a valid API key
  // try {
  //   const chunks = [];
  //   const streamPromise = qolaba.streamChat(simplePayload, (chunk) => {
  //     chunks.push(chunk);
  //   });
  //   const result = await streamPromise;
  //   console.log('Stream finished with output length:', result.output.length);
  // } catch (e) {
  //   console.error('Streaming test failed:', e.message);
  // }
})();