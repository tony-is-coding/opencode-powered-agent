# OpenCode Powered Agent

基于 [OpenCode](https://github.com/nicepkg/opencode) 的 Web AI Agent 平台。提供多 LLM Provider 支持、工具调用、实时流式响应，通过 Web 界面与 AI Agent 协作完成开发任务。

## 架构

```
┌─────────────────────────────────────────────────┐
│                   Web (React 19)                │
│  Sessions · Chat · Skills · Tasks · SSE 实时更新  │
│                  localhost:3000                  │
└──────────────────────┬──────────────────────────┘
                       │ Vite Proxy /api
┌──────────────────────▼──────────────────────────┐
│               Backend (Bun + Hono)              │
│  Agent · Provider · Tool · Session · Permission │
│                  localhost:4096                  │
└──────────────────────┬──────────────────────────┘
                       │ AI SDK (Vercel)
┌──────────────────────▼──────────────────────────┐
│              LLM Providers                      │
│  Anthropic · OpenAI · Google · Bedrock · ...    │
└─────────────────────────────────────────────────┘
```

**Backend** — Bun 运行时，Hono HTTP 框架，SQLite (Drizzle ORM)，AI SDK 多 Provider 抽象。支持 Agent 定义、工具调用（bash/read/grep/glob/webfetch 等）、权限控制、SSE 事件推送。

**Web** — React 19 + Vite + TypeScript + TanStack Query。支持会话管理、聊天交互（Markdown 渲染、文件上传）、Skill 管理、任务进度跟踪。

## 快速开始

### 前置要求

- [Bun](https://bun.sh/) >= 1.0
- [Node.js](https://nodejs.org/) >= 18
- 可用的 LLM API（本地代理或云端 API Key）

### 安装

```bash
git clone git@github.com:tony-is-coding/opencode-powered-agent.git
cd opencode-powered-agent
npm run install:all
```

### 配置 LLM Provider

编辑项目根目录 `opencode.json`，配置你的 LLM Provider：

```json
{
  "model": "local-proxy/claude-sonnet-4-6",
  "provider": {
    "local-proxy": {
      "name": "Local Proxy",
      "env": ["LOCAL_PROXY_API_KEY"],
      "options": {
        "baseURL": "http://127.0.0.1:8000/v1"
      },
      "models": {
        "claude-sonnet-4-6": {
          "name": "Claude Sonnet 4.6",
          "npm": "@ai-sdk/openai-compatible",
          "limit": { "context": 200000, "output": 64000 }
        }
      }
    }
  }
}
```

设置 API Key 环境变量（参考 `.env.example`）：

```bash
export LOCAL_PROXY_API_KEY=sk-xxx
# 或直连 Anthropic
export ANTHROPIC_API_KEY=sk-ant-xxx
```

### 启动

```bash
npm run dev          # 一键启动前后端
# 或分别启动
cd backend && bun run dev    # Backend → localhost:4096
cd web && npm run dev        # Web → localhost:3000
```

浏览器访问 http://localhost:3000

## 项目结构

```
opencode-powered-agent/
├── backend/                 # Agent Core 服务
│   ├── src/
│   │   ├── agent/           # Agent 定义 (build/plan/explore/general)
│   │   ├── provider/        # 多 LLM Provider 抽象
│   │   ├── session/         # 会话、消息、LLM 调用
│   │   ├── server/          # Hono HTTP + SSE + 路由
│   │   ├── tool/            # Agent 工具 (bash/read/grep/glob/...)
│   │   ├── permission/      # 工具权限控制
│   │   ├── skill/           # Skill 发现与管理
│   │   ├── storage/         # SQLite + Drizzle ORM
│   │   ├── bus/             # 事件总线 (SSE 广播)
│   │   ├── config/          # 配置加载
│   │   └── mcp/             # Model Context Protocol
│   ├── migration/           # 数据库迁移
│   └── package.json
├── web/                     # React 前端
│   ├── src/
│   │   ├── pages/           # Sessions/Skills/NewTask/TaskDetail
│   │   ├── components/      # ChatView/Sidebar/Toast
│   │   └── api.ts           # API 客户端
│   └── package.json
├── opencode.json            # LLM Provider 配置
├── .env.example             # 环境变量模板
└── package.json             # 根目录 dev scripts
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 一键启动前后端 |
| `npm run dev:backend` | 仅启动 Backend |
| `npm run dev:web` | 仅启动 Web |
| `npm run typecheck` | 前后端类型检查 |
| `npm run build:web` | 构建前端 |
| `npm run install:all` | 安装所有依赖 |

## 技术栈

| 层 | 技术 |
|----|------|
| Runtime | Bun |
| HTTP | Hono + OpenAPI |
| Database | SQLite + Drizzle ORM |
| LLM | AI SDK (Vercel) — 多 Provider |
| Frontend | React 19 + Vite + TypeScript |
| State | TanStack Query + SSE |
| Styling | CSS Variables (Dark/Light) |

## License

MIT
