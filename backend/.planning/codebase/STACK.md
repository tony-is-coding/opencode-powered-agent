# Technology Stack

**Analysis Date:** 2026-03-31

## Languages

**Primary:**
- TypeScript 5.8.2 - All source code in `backend/src/**/*.ts`

**Secondary:**
- SQL - Database migrations in `backend/migration/**/*.sql`

## Runtime

**Environment:**
- Bun 1.3.x - JavaScript runtime (specified in `package.json` via `@types/bun`)

**Package Manager:**
- Bun - Workspaces enabled for monorepo structure
- Lockfile: `bun.lock` (generated)

## Frameworks

**Core:**
- Hono 4.10.7 - HTTP framework for REST API server in `backend/src/server/server.ts`
- hono-openapi 1.1.2 - OpenAPI route documentation and validation

**AI/LLM:**
- Vercel AI SDK 5.0.124 - Multi-provider LLM abstraction in `backend/src/provider/provider.ts`
- Multiple provider SDKs (see Key Dependencies)

**Database:**
- Drizzle ORM 1.0.0-beta.16 - SQLite ORM in `backend/src/storage/db.ts`
- drizzle-kit 1.0.0-beta.16 - Migration generation and management

**Runtime/DI:**
- Effect 4.0.0-beta.31 - Runtime and dependency injection patterns

**Validation:**
- Zod 4.1.8 - Runtime schema validation throughout codebase

## Key Dependencies

**Critical:**
- @modelcontextprotocol/sdk 1.25.2 - Model Context Protocol integration in `backend/src/mcp/index.ts`
- ai 5.0.124 - Core AI SDK for LLM interactions
- @ai-sdk/provider 2.0.1 - Provider abstraction layer

**LLM Providers (Bundled):**
- @ai-sdk/anthropic 2.0.65 - Claude models
- @ai-sdk/openai 2.0.89 - GPT models
- @ai-sdk/google 2.0.54 - Gemini models
- @ai-sdk/amazon-bedrock 3.0.82 - AWS Bedrock models
- @ai-sdk/azure 2.0.91 - Azure OpenAI
- @ai-sdk/google-vertex 3.0.106 - Google Vertex AI
- @ai-sdk/groq 2.0.34 - Groq models
- @ai-sdk/mistral 2.0.27 - Mistral models
- @ai-sdk/xai 2.0.51 - xAI models
- @ai-sdk/openai-compatible 1.0.32 - Generic OpenAI-compatible endpoints
- @openrouter/ai-sdk-provider 1.5.4 - OpenRouter aggregator
- @gitlab/gitlab-ai-provider 3.6.0 - GitLab Duo integration
- Additional: Cohere, DeepInfra, Cerebras, TogetherAI, Perplexity, Vercel, Gateway

**Infrastructure:**
- @aws-sdk/credential-providers 3.993.0 - AWS credential chain for Bedrock
- google-auth-library 10.5.0 - Google authentication for Vertex AI
- @hono/zod-validator 0.4.2 - Zod validation middleware
- @hono/standard-validator 0.1.5 - Standard validation middleware

**Utilities:**
- remeda 2.26.0 - Functional utilities (mergeDeep, mapValues, etc.)
- fuzzysort 3.1.0 - Fuzzy string matching for model suggestions
- ulid 3.0.1 - ULID ID generation for database records
- decimal.js 10.5.0 - Precise decimal arithmetic
- semver 7.6.3 - Semantic versioning
- glob 13.0.5 - File globbing
- chokidar 4.0.3 - File system watching
- @parcel/watcher 2.5.1 - Cross-platform file watching
- tree-sitter-bash 0.25.0 - Bash syntax parsing
- web-tree-sitter 0.25.10 - Tree-sitter WASM bindings
- turndown 7.2.0 - HTML to Markdown conversion
- jsonc-parser 3.3.1 - JSONC parsing
- gray-matter 4.0.3 - YAML frontmatter parsing
- partial-json 0.1.7 - Partial JSON parsing
- strip-ansi 7.1.2 - ANSI escape code removal
- mime-types 3.0.2 - MIME type detection
- which 6.0.1 - Executable path resolution
- xdg-basedir 5.1.0 - XDG Base Directory paths
- @zip.js/zip.js 2.7.62 - ZIP file handling
- @pierre/diffs 1.1.0-beta.18 - Diff utilities

**Internal Workspaces:**
- @opencode-ai/util - Shared utilities
- @opencode-ai/plugin - Plugin system
- @opencode-ai/sdk - SDK exports

## Configuration

**Environment:**
- Environment variables via `Env` namespace in `backend/src/env/index.ts`
- Per-instance environment isolation (shallow copy of `process.env`)
- Provider API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AWS_ACCESS_KEY_ID`, etc.
- Server config: `PORT` (default 4096), `HOST` (default 0.0.0.0)
- Auth: `OPENCODE_SERVER_PASSWORD`, `OPENCODE_SERVER_USERNAME`
- Logging: `LOG_LEVEL` (default INFO), `NODE_ENV`

**Build:**
- `tsconfig.json` - TypeScript configuration with path aliases (`@/*` → `./src/*`)
- `bunfig.toml` - Bun configuration with test preload
- Drizzle migrations in `backend/migration/` directory

## Platform Requirements

**Development:**
- Bun 1.3.x runtime
- Node.js types for compatibility
- TypeScript 5.8.2 compiler
- SQLite support (built into Bun)

**Production:**
- Bun runtime
- SQLite database file (created at `~/.opencode/data/opencode.db` or custom path)
- Environment variables for provider credentials
- Optional: Basic auth credentials for server security

---

*Stack analysis: 2026-03-31*
