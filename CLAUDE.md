# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenCode Powered Agent — a web-based AI agent platform. Monorepo with two main packages:

- **backend/** — Agent Core service. Bun runtime, Hono HTTP framework, SQLite via Drizzle ORM, AI SDK (Vercel) for multi-provider LLM integration. Forked/adapted from the opencode project, runs as a headless HTTP server (no CLI/TUI).
- **web/** — React 19 frontend. Vite, TypeScript, React Router, TanStack Query. Communicates with backend via `/api` proxy (Vite dev server proxies to `localhost:4096`).

## Commands

### Backend (`cd backend`)
```bash
bun install                  # install dependencies (uses bun workspaces)
bun run dev                  # start dev server with browser conditions (port 4096)
bun run start                # start production server
bun run db generate          # generate drizzle migrations
bun run db migrate           # run drizzle migrations
```

### Web (`cd web`)
```bash
npm install                  # install dependencies
npm run dev                  # start vite dev server (port 3000, proxies /api to :4096)
npm run build                # tsc + vite build
npm run lint                 # eslint
```

## Architecture

### Backend

Built on Hono with OpenAPI route descriptions (`hono-openapi`). Key modules under `backend/src/`:

- **server/** — Hono app setup, route registration, SSE event streaming, CORS, basic auth
- **session/** — Core domain: sessions, messages, parts. SQLite persistence via Drizzle. Event-driven updates via Bus
- **agent/** — Agent definitions (build, plan, explore, general, compaction, title, summary). Configurable permissions per agent
- **provider/** — Multi-provider LLM abstraction. Supports Anthropic, OpenAI, Bedrock, Google, Groq, Mistral, xAI, etc. via AI SDK
- **tool/** — Agent tools: bash, read, edit, glob, grep, webfetch, websearch, batch, plan, task, todo
- **bus/** — In-process event bus for real-time SSE broadcasting
- **permission/** — Permission system controlling tool access per agent
- **config/** — User configuration loading
- **storage/** — SQLite database layer with Drizzle ORM
- **mcp/** — Model Context Protocol integration
- **skill/** — Skill discovery and execution

Path alias: `@/*` maps to `./src/*` (tsconfig paths).

Workspaces: `util`, `plugin`, `sdk/js`, `script` — internal packages referenced as `@opencode-ai/util`, `@opencode-ai/plugin`, `@opencode-ai/sdk`.

### Web Frontend

React SPA with pages: Sessions, Skills, NewTask, TaskDetail, TaskProcess. Uses EventSource (SSE) for real-time updates from backend `/event` endpoint.

### Communication

Frontend calls backend REST API through Vite proxy (`/api` → `localhost:4096`). Real-time updates via SSE at `/api/event`. Backend uses `x-opencode-directory` header or `directory` query param for project context.

## Environment Variables

- `PORT` — backend port (default: 4096)
- `HOST` — backend bind address (default: 0.0.0.0)
- `OPENCODE_SERVER_PASSWORD` — optional basic auth password
- `OPENCODE_SERVER_USERNAME` — optional basic auth username (default: "opencode")
- `LOG_LEVEL` — logging level (default: INFO)
- `NODE_ENV` — production/development

## gstack

Use the /browse skill from gstack for all web browsing, never use mcp__claude-in-chrome__* tools.

Available gstack skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade.

If gstack skills aren't working, run `cd ~/.claude/skills/gstack && ./setup` to rebuild.

## Workflow Rules

- When a pre-existing plan document exists, execute it directly without re-planning. Follow the plan's tasks in order unless compilation fails.
- After any TypeScript code changes, run type-check (`bunx tsc --noEmit` for backend, `npx tsc --noEmit` for web) before reporting completion.
- Implement ONLY what is explicitly requested. Do not add extra APIs, repository methods, or features beyond the stated scope.
- When receiving new feature requirements or identifying work items, split them into GitHub Issues with clear scope, requirements checklist, and acceptance criteria before starting implementation. Use the git-pm skill for issue structure.

## Key Patterns

- Namespace pattern: modules export a `namespace` (e.g., `Session`, `Agent`, `Server`) containing types, functions, and Zod schemas
- Validated functions: `fn(schema, handler)` pattern for runtime input validation with Zod
- Event-driven: Bus publishes typed events; SSE streams them to clients
- Effect library used for some runtime/DI patterns (`effect` package)
- IDs use ULID-based ascending/descending generators
