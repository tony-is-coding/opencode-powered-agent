# Backend 代码层级架构

> 本文档描述 OpenCode Agent Core 后端服务的代码分层架构和模块依赖关系。

## 架构概览图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              入口层 (Entry)                                  │
│                         src/index.ts, src/server/                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              路由层 (Routes)                                 │
│                       src/server/routes/*.ts                                │
│         session.ts, project.ts, mcp.ts, config.ts, schedule.ts, etc.        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             业务域层 (Domain)                                │
│    src/session/, src/agent/, src/skill/, src/project/, src/schedule/        │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Session    │  │    Agent     │  │    Skill     │  │   Project    │    │
│  │  (会话管理)   │  │  (代理定义)   │  │  (技能系统)   │  │  (项目管理)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           服务层 (Services)                                  │
│       src/provider/, src/permission/, src/bus/, src/mcp/, src/tool/         │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Provider   │  │  Permission  │  │     Bus      │  │     Tool     │    │
│  │ (LLM 提供者) │  │  (权限控制)   │  │  (事件总线)   │  │  (工具系统)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐                                        │
│  │     MCP      │  │   Config     │                                        │
│  │ (MCP 协议)   │  │  (配置管理)   │                                        │
│  └──────────────┘  └──────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           基础设施层 (Infrastructure)                        │
│              src/storage/, src/util/, src/file/, src/global/                │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Storage    │  │   Database   │  │    Global    │  │    Util      │    │
│  │ (文件存储)   │  │ (SQLite/ORM) │  │ (全局状态)   │  │  (工具函数)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 分层详解

### 1. 入口层 (Entry Layer)

**位置**: `src/index.ts`, `src/server/server.ts`

**职责**:
- 应用启动和初始化
- HTTP 服务器配置 (Hono 框架)
- 全局错误处理
- 中间件配置 (CORS, Basic Auth)
- SSE 事件流端点

**关键模块**:
```
src/
├── index.ts              # 应用入口，启动 HTTP 服务
├── server/
│   ├── server.ts         # Hono 应用配置，路由注册，中间件
│   └── routes/           # API 路由定义
```

**依赖方向**: 仅依赖路由层

---

### 2. 路由层 (Routes Layer)

**位置**: `src/server/routes/`

**职责**:
- HTTP 端点定义
- 请求验证 (Zod Schema)
- 响应格式化
- OpenAPI 文档生成

**路由模块**:
| 文件 | 端点前缀 | 职责 |
|------|---------|------|
| session.ts | `/session` | 会话 CRUD、消息流、权限管理 |
| project.ts | `/project` | 项目信息、初始化 |
| mcp.ts | `/mcp` | MCP 服务器管理 |
| config.ts | `/config` | 配置读写 |
| provider.ts | `/provider` | LLM 提供者管理 |
| schedule.ts | `/schedule` | 定时任务管理 |
| document.ts | `/document` | 文档处理 |
| permission.ts | `/permission` | 权限请求/响应 |
| global.ts | `/global` | 全局会话列表 |

**模式**: 使用 `hono-openapi` 进行 OpenAPI 规范和验证

---

### 3. 业务域层 (Domain Layer)

**位置**: `src/session/`, `src/agent/`, `src/skill/`, `src/project/`, `src/schedule/`

**职责**:
- 核心业务逻辑
- 领域实体定义
- 业务规则实现
- 事件发布

#### 3.1 Session 模块 (核心域)

```
src/session/
├── index.ts           # Session 命名空间，CRUD 操作
├── message-v2.ts      # Message/Part 数据结构
├── session.sql.ts     # Drizzle ORM 表定义
├── prompt.ts          # Prompt 构建逻辑
├── processor.ts       # Agent 消息处理
├── compaction.ts      # 会话压缩
├── revert.ts          # 回滚功能
├── summary.ts         # 会话摘要
└── todo.ts            # Todo 管理
```

**核心实体**:
- `Session`: 会话容器
- `Message`: 消息 (User/Assistant)
- `Part`: 消息部分 (Text, ToolCall, ToolResult, etc.)

#### 3.2 Agent 模块

```
src/agent/
├── agent.ts           # Agent 定义和配置
└── prompt/            # Agent 系统提示词
    ├── explore.txt    # 探索代理
    ├── compaction.txt # 压缩代理
    ├── title.txt      # 标题生成
    └── summary.txt    # 摘要生成
```

**内置代理**:
- `build`: 默认主代理
- `plan`: 规划模式代理
- `explore`: 代码库探索子代理
- `general`: 通用子代理
- `compaction`: 会话压缩
- `title`: 标题生成
- `summary`: 摘要生成

#### 3.3 Project 模块

```
src/project/
├── project.ts         # 项目信息管理
├── project.sql.ts     # Project 表定义
├── instance.ts        # 项目实例上下文
├── bootstrap.ts       # 实例初始化
├── vcs.ts             # 版本控制信息
└── state.ts           # 实例状态管理
```

---

### 4. 服务层 (Services Layer)

**位置**: `src/provider/`, `src/permission/`, `src/bus/`, `src/tool/`, `src/mcp/`

**职责**:
- 跨域服务
- 外部系统集成
- 基础能力提供

#### 4.1 Provider 模块 (LLM 提供者)

```
src/provider/
├── provider.ts        # 提供者管理，模型获取
├── models.ts          # 模型定义 (models.dev)
├── transform.ts       # 消息格式转换
├── auth.ts            # 认证处理
├── error.ts           # 错误定义
└── sdk/
    └── copilot/       # GitHub Copilot SDK 适配
```

**支持的提供者**:
- Anthropic, OpenAI, Azure
- Google (Gemini, Vertex)
- Amazon Bedrock
- OpenRouter, Groq, Mistral
- xAI, Cerebras, Cohere
- GitHub Copilot

#### 4.2 Permission 模块 (权限控制)

```
src/permission/
├── next.ts            # 权限 API
├── service.ts         # Effect-based 权限服务
├── arity.ts           # 权限规则处理
└── schema.ts          # 类型定义
```

**权限动作**:
- `allow`: 自动允许
- `deny`: 自动拒绝
- `ask`: 请求用户确认

#### 4.3 Bus 模块 (事件总线)

```
src/bus/
├── index.ts           # 发布/订阅 API
├── bus-event.ts       # 事件定义机制
└── global.ts          # 全局事件广播
```

**事件类型**:
- `session.created/updated/deleted`
- `message.updated/removed`
- `part.updated/delta`
- `mcp.tools.changed`

#### 4.4 Tool 模块 (工具系统)

```
src/tool/
├── tool.ts            # Tool 定义接口
├── registry.ts        # 工具注册中心
├── bash.ts            # Shell 命令执行
├── read.ts            # 文件读取
├── glob.ts            # 文件模式匹配
├── grep.ts            # 内容搜索
├── webfetch.ts        # 网页获取
├── websearch.ts       # 网页搜索
├── task.ts            # 子任务
├── todo.ts            # Todo 管理
├── batch.ts           # 批量执行
└── skill.ts           # 技能调用
```

#### 4.5 MCP 模块 (Model Context Protocol)

```
src/mcp/
├── index.ts           # MCP 客户端管理
├── auth.ts            # OAuth 认证
├── oauth-provider.ts  # OAuth 提供者
└── oauth-callback.ts  # OAuth 回调处理
```

---

### 5. 基础设施层 (Infrastructure Layer)

**位置**: `src/storage/`, `src/util/`, `src/file/`, `src/global/`

#### 5.1 Storage 模块 (数据持久化)

```
src/storage/
├── db.ts              # SQLite + Drizzle ORM
├── storage.ts         # 文件存储抽象
├── schema.ts          # 表定义导出
└── schema.sql.ts      # 通用字段定义
```

**数据库配置**:
- 使用 Bun SQLite
- WAL 模式
- Drizzle ORM 迁移
- 事务支持

#### 5.2 Util 模块 (工具函数)

```
src/util/
├── log.ts             # 日志系统
├── context.ts         # 异步上下文
├── fn.ts              # Zod 验证函数包装器
├── filesystem.ts      # 文件系统操作
├── git.ts             # Git 操作
├── glob.ts            # 文件匹配
├── lazy.ts            # 延迟初始化
├── lock.ts            # 读写锁
├── timeout.ts         # 超时处理
├── retry.ts           # 重试逻辑
└── ...
```

#### 5.3 Global 模块 (全局状态)

```
src/global/
└── index.ts           # 全局路径、状态
```

---

## 模块依赖规则

```
入口层 → 路由层 → 业务域层 → 服务层 → 基础设施层
  │         │          │          │           │
  │         │          │          │           └── 无依赖
  │         │          │          └── 依赖基础设施层
  │         │          └── 依赖服务层 + 基础设施层
  │         └── 依赖业务域层 + 服务层
  └── 依赖路由层

禁止: 下层依赖上层，形成循环依赖
```

## 命名空间模式

项目采用 TypeScript 命名空间模式组织代码：

```typescript
// 模块导出为命名空间
export namespace Session {
  // 类型定义
  export const Info = z.object({...})
  export type Info = z.infer<typeof Info>

  // 事件定义
  export const Event = {
    Created: BusEvent.define("session.created", ...),
    Updated: BusEvent.define("session.updated", ...),
  }

  // 业务函数
  export const create = fn(schema, async (input) => {...})
  export const get = fn(SessionID.zod, async (id) => {...})
}
```

## 关键设计模式

### 1. Zod 验证函数 (fn pattern)

```typescript
export const create = fn(
  z.object({ title: z.string() }),
  async (input) => {
    // input 已验证
  }
)
```

### 2. 实例状态 (Instance.state)

```typescript
const state = Instance.state(async () => {
  // 每个项目实例独立的状态
  return { /* ... */ }
})
```

### 3. 事件驱动 (Bus)

```typescript
// 发布事件
Bus.publish(Session.Event.Created, { info })

// 订阅事件
Bus.subscribe(Session.Event.Updated, (event) => {...})
```

### 4. 数据库事务 (Database.use)

```typescript
Database.use((db) => {
  db.insert(SessionTable).values(...)
  Database.effect(() => Bus.publish(...))
})
```