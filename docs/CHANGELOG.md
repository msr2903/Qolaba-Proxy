# Changelog

All notable changes to the Qoloba OpenAI-Compatible Proxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Qolaba OpenAI-Compatible Proxy
- OpenAI API compatibility for chat completions and models endpoints
- Streaming support with Server-Sent Events (SSE)
- Model mapping system for OpenAI to Qolaba model conversion
- API key passthrough authentication
- Tool calling support with XML format
- Comprehensive logging system with structured JSON output
- Rate limiting and request validation
- Health check endpoints
- Docker support with multi-stage builds
- Usage tracking and pricing information endpoints

### Features
- **Core Proxy Functionality**
  - `/v1/chat/completions` endpoint with streaming support
  - `/v1/models` endpoint for model listing
  - `/health` endpoints for monitoring
  - `/v1/models/usage` for usage statistics
  - `/v1/models/pricing` for pricing information

- **Model Support**
  - OpenAI models: gpt-4.1-mini, gpt-4.1, gpt-4o-mini
  - Claude models: claude-3-5-sonnet, claude-opus
  - Gemini models: gemini-1.5-pro, gemini-1.5-flash
  - Configurable model mapping with fallback to default

- **Authentication**
  - API key passthrough mode
  - Override mode with configured API key
  - Support for Bearer token and x-api-key headers
  - Query parameter API key support for testing

- **Streaming**
  - Real-time streaming responses
  - OpenAI-compatible SSE format
  - Graceful error handling in streaming mode
  - Tool call detection in streaming responses

- **Tool Support**
  - XML-based tool calling
  - Parameter parsing and validation
  - Integration with Kilo Code tool system
  - Tool execution endpoint

- **Monitoring & Logging**
  - Structured JSON logging with Winston
  - Request/response tracking
  - Performance metrics
  - Error tracking and reporting
  - Configurable log levels

- **Security & Performance**
  - Rate limiting with configurable limits
  - Input validation and sanitization
  - CORS configuration
  - Request timeout handling
  - Connection pooling

### Configuration
- Environment-based configuration system
- Docker environment support
- Comprehensive .env.example file
- Configuration validation
- Default value fallbacks

### Documentation
- Comprehensive README.md
- API documentation
- Installation and setup guides
- Troubleshooting section
- Docker deployment instructions

## [1.0.0] - 2024-10-02

### Added
- Initial implementation of Qolaba OpenAI-Compatible Proxy
- Core proxy functionality with OpenAI API compatibility
- Streaming support for real-time responses
- Model mapping system between OpenAI and Qolaba models
- API key authentication with passthrough support
- Tool calling support with XML format
- Comprehensive logging and monitoring
- Docker containerization support
- Health check endpoints
- Rate limiting and security features
- Complete documentation and examples

### Technical Details
- Built with Node.js 18+ and ES modules
- Express.js web framework
- Winston logging with structured output
- Axios HTTP client for Qolaba API integration
- Jest testing framework
- ESLint for code quality
- Multi-stage Docker builds for production optimization

### Supported Features
- Chat completions with streaming and non-streaming modes
- Model listing and information
- Usage tracking and pricing information
- Tool calling with XML format
- Health monitoring and diagnostics
- Rate limiting and request validation
- Comprehensive error handling

### Known Limitations
- Requires valid Qolaba API key
- Limited to Qolaba-supported models
- Tool calling format restricted to XML
- Streaming responses depend on Qolaba API stability

### Migration Guide
No migration needed for initial release.

## Development Workflow

### Version Management
- Use semantic versioning (major.minor.patch)
- Update CHANGELOG.md for every release
- Tag releases in Git
- Update package.json version

### Release Process
1. Update version in package.json
2. Update CHANGELOG.md with release notes
3. Commit changes with version tag
4. Create Git tag: `git tag v1.0.0`
5. Push to repository: `git push origin v1.0.0`
6. Build and publish Docker image

### Testing
- Unit tests for all core functionality
- Integration tests for API endpoints
- Performance tests for streaming
- Security tests for authentication and validation

### Code Quality
- ESLint configuration for consistent code style
- Prettier for code formatting
- Pre-commit hooks for quality checks
- Documentation requirements for all public APIs

---

**Note:** This changelog follows the Keep a Changelog format and will be updated with every new release.