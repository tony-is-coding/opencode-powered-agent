# Project: OpenCode Powered Agent

**Version:** v1.0
**Status:** Active
**Created:** 2026-03-26

## Vision

基于 opencode agent core 构建一个可配置的 Web Agent 平台。把一个 CLI agent 引擎变成可通过浏览器操作的可配置平台。用户不需要懂命令行，打开网页就能：配置 skill、选择 agent 模式、发起任务、实时看到 agent 的思考和工具调用过程、管理文档和历史会话。

## What Makes This Cool

给 opencode 加了一个"控制面板"——前端可视化是主要差异化。

## Constraints

1. **不修改 opencode core** — session/, provider/, tool/, agent/, permission/ 等核心模块不动
2. **薄管理层** — 直接在 server.ts 中添加管理路由，复用 core 的所有模块
3. **多 Agent 并行暂不考虑** — 当前聚焦单 agent 单 session 模型
4. **自动化调度** = 外部触发 `prompt_async`

## Tech Stack

- **Backend:** Bun runtime, Hono HTTP framework, SQLite via Drizzle ORM, AI SDK (Vercel)
- **Frontend:** React 19, Vite, TypeScript, React Router, TanStack Query
- **Communication:** REST API + SSE for real-time updates

## Architecture

```
frontend/          ← React SPA
    ↓ REST/SSE
backend/src/
    server/        ← Hono routes (管理 API)
    session/       ← Core: sessions, messages, parts
    agent/         ← Core: agent definitions
    provider/      ← Core: LLM abstraction
    tool/          ← Core: agent tools
    bus/           ← Core: event bus for SSE
    permission/    ← Core: tool permissions
    skill/         ← Core: skill discovery
```

## Principles

- 复用 opencode 已有的能力，不重复造轮子
- 前端优先 — 可视化是主要价值
- 薄 API 层 — 组合 core 模块，不引入新架构
