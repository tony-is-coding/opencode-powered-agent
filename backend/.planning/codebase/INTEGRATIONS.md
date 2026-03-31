# External Integrations

**Analysis Date:** 2026-03-31

## APIs & External Services

**LLM Providers:**
- Anthropic Claude - SDK: `@ai-sdk/anthropic`, Auth: `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`
- OpenAI GPT - SDK: `@ai-sdk/openai`, Auth: `OPENAI_API_KEY`
- Google Gemini - SDK: `@ai-sdk/google`, Auth: `GOOGLE_API_KEY`
- Google Vertex AI - SDK: `@ai-sdk/google-vertex`, Auth: Google Application Default Credentials
- AWS Bedrock - SDK: `@ai-sdk/amazon-bedrock`, Auth: AWS credential chain or `AWS_BEARER_TOKEN_BEDROCK`
- Azure OpenAI - SDK: `@ai-sdk/azure`, Auth: `AZURE_API_KEY`
- Groq - SDK: `@ai-sdk/groq`, Auth: `GROQ_API_KEY`
- Mistral - SDK: `@ai-sdk/mistral`, Auth: `MISTRAL_API_KEY`
- xAI - SDK: `@ai-sdk/xai`, Auth: `XAI_API_KEY`
- Cohere - SDK: `@ai-sdk/cohere`, Auth: `COHERE_API_KEY`
- DeepInfra - SDK: `@ai-sdk/deepinfra`, Auth: `DEEPINFRA_API_KEY`
- Cerebras - SDK: `@ai-sdk/cerebras`, Auth: `CEREBRAS_API_KEY`
- TogetherAI - SDK: `@ai-sdk/togetherai`, Auth: `TOGETHER_API_KEY`
- Perplexity - SDK: `@ai-sdk/perplexity`, Auth: `PERPLEXITY_API_KEY`
- OpenRouter - SDK: `@openrouter/ai-sdk-provider`, Auth: `OPENROUTER_API_KEY`
- Vercel - SDK: `@ai-sdk/vercel`, Auth: `VERCEL_API_KEY`
- GitLab Duo - SDK: `@gitlab/gitlab-ai-provider`, Auth: `GITLAB_TOKEN` or OAuth
- Cloudflare Workers AI - SDK: bundled, Auth: `CLOUDFLARE_API_KEY`
- Cloudflare AI Gateway - SDK: `ai-gateway-provider`, Auth: `CLOUDFLARE_API_TOKEN` or `CF_AIG_TOKEN`
- OpenAI-compatible endpoints - SDK: `@ai-sdk/openai-compatible`, Auth: custom API keys

**Model Metadata:**
- models.dev - External model registry loaded at runtime for provider/model definitions

## Data Storage

**Databases:**
- SQLite (Bun native)
  - Connection: `~/.opencode/data/opencode.db` (configurable via `Database.Path`)
  - Client: Drizzle ORM in `backend/src/storage/db.ts`
  - Schema: `backend/src/storage/schema.sql.ts`
  - Tables: sessions, messages, parts, projects, schedules

**File Storage:**
- Local filesystem only
  - State directory: `~/.opencode/state/`
  - Config directory: `~/.opencode/config/`
  - Data directory: `~/.opencode/data/`

**Caching:**
- In-memory caching via Effect library
- Instance-scoped state management in `backend/src/project/instance.ts`

## Authentication & Identity

**Auth Provider:**
- Custom/Stub implementation
  - File: `backend/src/provider/provider.ts` (Auth stub at lines 9-15)
  - Note: Original Auth module not migrated; MAAS adapter will replace this
  - Current: Returns undefined for all auth lookups

**Provider Authentication:**
- Environment variables for API keys
- AWS credential chain for Bedrock (profiles, access keys, IAM roles, web identity tokens)
- Google Application Default Credentials for Vertex AI
- OAuth support for GitLab (via `@gitlab/gitlab-ai-provider`)
- Basic auth for server: `OPENCODE_SERVER_USERNAME` and `OPENCODE_SERVER_PASSWORD`

## Monitoring & Observability

**Error Tracking:**
- None detected - errors logged locally via `Log` namespace

**Logs:**
- Local logging via `backend/src/util/log.ts`
- Log levels: DEBUG, INFO, WARN, ERROR
- Configurable via `LOG_LEVEL` environment variable
- Service-scoped loggers created with `Log.create({ service: "name" })`

## CI/CD & Deployment

**Hosting:**
- Standalone HTTP server (Bun.serve)
- Listens on `HOST:PORT` (default `0.0.0.0:4096`)
- No built-in deployment integration

**CI Pipeline:**
- None detected in backend codebase

## Environment Configuration

**Required env vars (by provider):**
- Anthropic: `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`
- OpenAI: `OPENAI_API_KEY`
- Google: `GOOGLE_API_KEY`
- AWS Bedrock: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_BEARER_TOKEN_BEDROCK`
- Azure: `AZURE_API_KEY`, `AZURE_RESOURCE_NAME`
- Google Vertex: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_VERTEX_LOCATION`
- GitLab: `GITLAB_TOKEN` or OAuth
- Cloudflare: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_KEY` or `CLOUDFLARE_API_TOKEN`

**Server config:**
- `PORT` - Server port (default: 4096)
- `HOST` - Bind address (default: 0.0.0.0)
- `OPENCODE_SERVER_PASSWORD` - Basic auth password (optional)
- `OPENCODE_SERVER_USERNAME` - Basic auth username (default: "opencode")
- `LOG_LEVEL` - Logging level (default: INFO)
- `NODE_ENV` - Environment (production/development)

**Secrets location:**
- Environment variables (process.env)
- No .env file support detected
- Managed config directory: `/Library/Application Support/opencode` (macOS), `C:\ProgramData\opencode` (Windows), `/etc/opencode` (Linux)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Real-time Communication

**Server-Sent Events (SSE):**
- Endpoint: `GET /event`
- Location: `backend/src/server/server.ts` (lines 523-580)
- Heartbeat: 10-second intervals to prevent stalled proxy streams
- Event types: `server.connected`, `server.heartbeat`, and domain events via Bus

**Event Bus:**
- In-process event bus in `backend/src/bus/index.ts`
- Publishes typed events to SSE subscribers
- Used for real-time session updates, tool execution, errors

## Model Context Protocol (MCP)

**Integration:**
- SDK: `@modelcontextprotocol/sdk` 1.25.2
- Location: `backend/src/mcp/index.ts`
- Transports: Stdio, HTTP (StreamableHTTPClientTransport), SSE
- OAuth support via `McpOAuthProvider` and `McpOAuthCallback`
- Timeout: 30 seconds default (configurable)

**Configuration:**
- Local MCP servers: command + environment variables
- Remote MCP servers: URL + optional OAuth + headers
- Defined in `opencode.json` under `mcp` field

---

*Integration audit: 2026-03-31*
