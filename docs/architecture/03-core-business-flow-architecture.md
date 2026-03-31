# Backend 核心业务流程架构

> 本文档描述 OpenCode Agent Core 后端服务的核心业务流程和工作流程。

## 流程概览

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Agent Core 业务流程总览                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

     ┌─────────┐      ┌─────────────┐      ┌──────────────┐      ┌─────────────┐
     │  HTTP   │      │   Session   │      │    Agent     │      │   Provider  │
     │  请求   │ ───▶ │   管理      │ ───▶ │    执行      │ ───▶ │   (LLM)     │
     └─────────┘      └─────────────┘      └──────────────┘      └─────────────┘
          │                 │                     │                     │
          │                 │                     │                     │
          ▼                 ▼                     ▼                     ▼
     ┌─────────┐      ┌─────────────┐      ┌──────────────┐      ┌─────────────┐
     │  SSE    │ ◀─── │     Bus     │ ◀─── │    Tool      │ ◀─── │   Stream    │
     │  推送   │      │   事件总线  │      │    执行      │      │   响应      │
     └─────────┘      └─────────────┘      └──────────────┘      └─────────────┘
```

---

## 1. 系统启动流程

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  系统启动流程                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

src/index.ts
     │
     ├─▶ Log.init()                          # 初始化日志系统
     │
     ├─▶ 环境变量处理
     │   ├── ANTHROPIC_AUTH_TOKEN → ANTHROPIC_API_KEY
     │   └── ANTHROPIC_AUTH_TOKEN → LOCAL_PROXY_API_KEY
     │
     ├─▶ Server.listen({ port, hostname })   # 启动 HTTP 服务
     │   │
     │   └─▶ Server.createApp()              # 创建 Hono 应用
     │        │
     │        ├─▶ 错误处理中间件
     │        │
     │        ├─▶ Basic Auth 中间件 (可选)
     │        │
     │        ├─▶ 请求日志中间件
     │        │
     │        ├─▶ CORS 中间件
     │        │
     │        ├─▶ 实例上下文中间件
     │        │    └─▶ Instance.provide({ directory, init, fn })
     │        │         ├── 创建/获取项目实例
     │        │         └── 初始化配置、MCP、Provider
     │        │
     │        └─▶ 注册路由
     │             ├── /global → GlobalRoutes
     │             ├── /project → ProjectRoutes
     │             ├── /session → SessionRoutes
     │             ├── /mcp → McpRoutes
     │             ├── /config → ConfigRoutes
     │             ├── /provider → ProviderRoutes
     │             ├── /permission → PermissionRoutes
     │             ├── /schedule → ScheduleRoutes
     │             └── /event → SSE 端点
     │
     └─▶ 等待进程信号 (保持运行)
```

### 项目实例初始化

```
Instance.provide({ directory, init: InstanceBootstrap, fn })
     │
     ├─▶ Project.fromDirectory(directory)
     │    ├── 检测 Git 仓库
     │    ├── 获取 root commit hash → ProjectID
     │    └── 返回 { project, sandbox }
     │
     ├─▶ context.provide(ctx, fn)
     │    │
     │    └─▶ InstanceBootstrap()
     │         │
     │         ├─▶ Config.state()           # 加载配置
     │         │    ├── 远程 .well-known/opencode
     │         │    ├── 全局 ~/.config/opencode/opencode.json
     │         │    ├── 项目 opencode.json
     │         │    └── .opencode/ 目录
     │         │
     │         ├─▶ MCP.state()              # 初始化 MCP 客户端
     │         │    └── 连接配置的 MCP 服务器
     │         │
     │         ├─▶ Agent.state()            # 初始化 Agent 配置
     │         │
     │         └─▶ ToolRegistry.state()     # 加载自定义工具
     │
     └─▶ 执行请求处理函数 fn()
```

---

## 2. 会话消息处理流程

### 2.1 创建会话

```
POST /session
     │
     ├─▶ Session.create({ title?, parentID?, permission? })
     │    │
     │    ├─▶ 生成 SessionID (ULID 降序)
     │    │
     │    ├─▶ 生成 slug
     │    │
     │    ├─▶ 构建 Session Info
     │    │    {
     │    │      id, slug, version, projectID, directory,
     │    │      title, permission, time: { created, updated }
     │    │    }
     │    │
     │    ├─▶ Database.use((db) => {
     │    │      db.insert(SessionTable).values(toRow(result)).run()
     │    │      Database.effect(() => Bus.publish(Event.Created, { info }))
     │    │    })
     │    │
     │    └─▶ 返回 Session Info
     │
     └─▶ SSE 推送 session.created 事件
```

### 2.2 发送消息 (流式处理)

```
POST /session/:sessionID/message
     │
     ├─▶ 验证请求参数
     │    ├── sessionID: SessionID
     │    ├── messageID: MessageID
     │    ├── model: string
     │    └── parts: Part[]
     │
     ├─▶ 创建 User Message
     │    ├── MessageV2.Info { id, sessionID, role: "user", parts }
     │    └── Session.updateMessage(msg)
     │         └── Bus.publish(MessageV2.Event.Updated, { sessionID, info })
     │
     ├─▶ 开始流式响应
       │
       ├─▶ SessionPrompt.chat({
       │      sessionID, messageID, model, parts
       │    })
       │         │
       │         ├─▶ 获取 Session 和历史消息
       │         │
       │         ├─▶ 构建系统提示词
       │         │    ├── 项目上下文
       │         │    ├── Agent 指令
       │         │    ├── MCP 提示词
       │         │    └── 技能提示词
       │         │
       │         ├─▶ 获取可用工具
       │         │    ToolRegistry.tools(model, agent)
       │         │         ├── 内置工具 (bash, read, glob, grep, ...)
       │         │        ├── MCP 工具
       │         │        └── 自定义工具
       │         │
       │         ├─▶ 调用 LLM API (流式)
       │         │    Provider.chat({ model, messages, tools })
       │         │         │
       │         │         └─▶ ai-sdk streamText/streamObject
       │         │
       │         └─▶ 处理流式响应
       │              ├── text-delta → 创建 TextPart → Bus.publish(PartDelta)
       │              ├── tool-call → 创建 ToolCallPart
       │              ├── reasoning → 创建 ReasoningPart
       │              └── finish → 计算使用量、保存消息
       │
       └─▶ SSE 流式推送
             ├── message.part.updated
             ├── message.part.delta
             └── message.updated
```

### 2.3 工具执行流程

```
LLM 返回 tool_call
     │
     ├─▶ 创建 ToolCallPart
     │    {
     │      type: "tool_call",
     │      name: "bash",
     │      args: { command: "npm test" },
     │      callID: "call_xxx",
     │      state: "pending"
     │    }
     │
     ├─▶ 权限检查
     │    PermissionNext.ask({
     │      permission: "bash",
     │      pattern: "npm test",
     │      ruleset: agent.permission
     │    })
     │         │
     │         ├── allow → 继续执行
     │         ├── deny → 返回拒绝结果
     │         └── ask → 等待用户响应
     │              │
     │              └─▶ PermissionNext.reply({ id, action })
     │
     ├─▶ 执行工具
     │    ToolRegistry.getTool("bash")
     │         │
     │         └─▶ tool.execute(args, ctx)
     │              ├── ctx.sessionID
     │              ├── ctx.messageID
     │              ├── ctx.abort (AbortSignal)
     │              └── ctx.metadata({ title, metadata })
     │
     ├─▶ 创建 ToolResultPart
     │    {
     │      type: "tool_result",
     │      toolCallID: "call_xxx",
     │      toolCallName: "bash",
     │      output: "test passed",
     │      metadata: { exitCode: 0 }
     │    }
     │
     └─▶ 继续对话循环
          LLM 收到 tool_result 后决定下一步
```

---

## 3. Agent 执行循环

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 Agent 执行循环                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │  开始消息    │
                         └──────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  构建系统提示词       │
                    │  - Agent 指令         │
                    │  - 项目上下文         │
                    │  - 可用工具列表       │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  调用 LLM API         │
                    │  (流式响应)           │
                    └───────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
        ┌───────────────┐               ┌───────────────┐
        │  文本输出     │               │  工具调用     │
        │  (text-delta) │               │  (tool-call)  │
        └───────────────┘               └───────────────┘
                │                               │
                │                               ▼
                │                    ┌───────────────────────┐
                │                    │  权限检查             │
                │                    │  allow/deny/ask       │
                │                    └───────────────────────┘
                │                               │
                │                    ┌──────────┴──────────┐
                │                    │                     │
                │                    ▼                     ▼
                │            ┌───────────────┐     ┌───────────────┐
                │            │  执行工具     │     │  等待用户     │
                │            └───────────────┘     └───────────────┘
                │                    │                     │
                │                    ▼                     │
                │            ┌───────────────┐             │
                │            │  工具结果     │             │
                │            │  (tool_result)│             │
                │            └───────────────┘             │
                │                    │                     │
                └────────────────────┴─────────────────────┘
                                     │
                                     ▼
                           ┌───────────────────────┐
                           │  是否继续?            │
                           │  - 工具结果需要处理   │
                           │  - 步数限制未达       │
                           └───────────────────────┘
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                         ▼                       ▼
                   ┌───────────────┐      ┌───────────────┐
                   │  继续对话     │      │  结束对话     │
                   │  (递归)       │      │  返回最终结果 │
                   └───────────────┘      └───────────────┘
```

---

## 4. SSE 事件流

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                SSE 事件流架构                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

客户端                                    服务端
  │                                         │
  │  GET /event                             │
  │────────────────────────────────────────▶│
  │                                         │
  │  event: server.connected                │
  │◀────────────────────────────────────────│
  │                                         │
  │                                         │  订阅 Bus 事件
  │                                         │  Bus.subscribeAll()
  │                                         │
  │  event: session.created                 │
  │◀────────────────────────────────────────│
  │  { type, properties: { info } }         │
  │                                         │
  │  event: message.part.updated            │
  │◀────────────────────────────────────────│
  │  { type, properties: { part } }         │
  │                                         │
  │  event: message.part.delta              │
  │◀────────────────────────────────────────│
  │  { type, properties: { field, delta } } │
  │                                         │
  │  ... (持续推送)                          │
  │                                         │
  │  心跳 (每 10s)                          │
  │◀────────────────────────────────────────│
  │  { type: "server.heartbeat" }           │
  │                                         │
  │  客户端断开                              │
  │                                         │  取消订阅
  │                                         │  unsub()
  │                                         │
```

### 事件类型

| 事件类型 | 数据 | 触发时机 |
|---------|------|---------|
| `server.connected` | `{}` | SSE 连接建立 |
| `server.heartbeat` | `{}` | 每 10 秒 |
| `server.instance.disposed` | `{ directory }` | 实例销毁 |
| `session.created` | `{ info: Session.Info }` | 创建会话 |
| `session.updated` | `{ info: Session.Info }` | 更新会话 |
| `session.deleted` | `{ info: Session.Info }` | 删除会话 |
| `session.error` | `{ sessionID?, error }` | 会话错误 |
| `message.updated` | `{ sessionID, info: Message.Info }` | 消息更新 |
| `message.removed` | `{ sessionID, messageID }` | 消息删除 |
| `message.part.updated` | `{ sessionID, part: Part }` | Part 更新 |
| `message.part.delta` | `{ sessionID, messageID, partID, field, delta }` | Part 增量 |
| `message.part.removed` | `{ sessionID, messageID, partID }` | Part 删除 |
| `mcp.tools.changed` | `{ server }` | MCP 工具变化 |

---

## 5. 权限控制流程

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 权限控制流程                                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

工具调用请求
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ PermissionNext.ask({                                                                │
│   permission: "bash",        // 权限类型                                            │
│   pattern: "npm test",       // 具体操作                                            │
│   ruleset: agent.permission  // Agent 的规则集                                      │
│ })                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌───────────────────────────────────────┐
│  遍历 ruleset，从后向前查找匹配规则    │
│                                       │
│  规则格式:                            │
│  {                                    │
│    permission: "bash",               │
│    pattern: "*",                     │
│    action: "ask"                     │
│  }                                    │
└───────────────────────────────────────┘
     │
     ├──────────────────┬──────────────────┐
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   allow     │  │    deny     │  │     ask     │
└─────────────┘  └─────────────┘  └─────────────┘
     │                  │                  │
     │                  │                  ▼
     │                  │         ┌───────────────────────┐
     │                  │         │  创建 PermissionRequest│
     │                  │         │  发布事件等待用户响应  │
     │                  │         └───────────────────────┘
     │                  │                  │
     │                  │                  ├─▶ 用户批准 → allow
     │                  │                  └─▶ 用户拒绝 → deny
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                    执行工具 / 拒绝执行                    │
└─────────────────────────────────────────────────────────┘
```

### 权限规则合并

```
规则合并优先级 (从低到高):

1. 默认规则 (Agent 内置)
   {
     "*": "allow",
     "read": { "*.env": "ask" },
     "bash": "allow",
     "edit": "allow"
   }

2. 用户全局配置 (~/.config/opencode/opencode.json)
   {
     "permission": {
       "bash": { "rm -rf": "ask" }
     }
   }

3. 项目配置 (opencode.json)
   {
     "permission": {
       "edit": { "*.env": "deny" }
     }
   }

4. 会话级配置
   {
     "permission": {
       "bash": { "sudo": "deny" }
     }
   }

最终合并结果:
- 后定义的规则覆盖先定义的
- 更具体的模式优先于通配符
```

---

## 6. MCP 协议集成流程

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                MCP 协议集成流程                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

配置 MCP 服务器 (opencode.json)
{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path"]
    },
    "github": {
      "type": "remote",
      "url": "https://api.github.com/mcp"
    }
  }
}
     │
     ▼
┌───────────────────────────────────────────────────────────────────┐
│  MCP.state() 初始化                                                │
│                                                                    │
│  For each MCP server:                                              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  创建 MCP Client                                             │  │
│  │                                                              │  │
│  │  Local: StdioClientTransport({ command, args, cwd })        │  │
│  │  Remote: StreamableHTTPClientTransport({ url })             │  │
│  │         或 SSEClientTransport({ url })                      │  │
│  │                                                              │  │
│  │  OAuth 流程 (可选):                                          │  │
│  │  ├── 检测需要认证                                            │  │
│  │  ├── 生成 state 参数                                         │  │
│  │  ├── 打开授权页面                                            │  │
│  │  ├── 等待回调                                                │  │
│  │  └── 完成 OAuth                                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  client.connect(transport)                                         │
│  client.listTools() → 注册到工具列表                               │
└───────────────────────────────────────────────────────────────────┘
     │
     ▼
┌───────────────────────────────────────────────────────────────────┐
│  工具调用流程                                                     │
│                                                                    │
│  LLM 返回 tool_call:                                               │
│  { "name": "filesystem_read_file", "args": { "path": "..." } }    │
│                                                                    │
│  ToolRegistry.getTool("filesystem_read_file")                      │
│      │                                                             │
│      └─▶ MCP 工具包装器                                            │
│           client.callTool({                                       │
│             name: "read_file",                                    │
│             arguments: { path: "..." }                            │
│           })                                                       │
│                                                                    │
│  返回结果                                                          │
└───────────────────────────────────────────────────────────────────┘
```

---

## 7. 会话压缩流程

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  会话压缩流程                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

触发条件:
- 上下文窗口接近限制
- 手动触发 (POST /session/:id/compact)

     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  SessionCompaction.compact(sessionID)                                               │
│                                                                                     │
│  1. 获取历史消息                                                                    │
│     Session.messages({ sessionID })                                                 │
│                                                                                     │
│  2. 选择压缩策略                                                                    │
│     ├── 自动: 保留最近的 N 条消息                                                   │
│     └── 摘要: 使用 LLM 生成历史摘要                                                 │
│                                                                                     │
│  3. 生成摘要 (如果需要)                                                             │
│     Agent.get("compaction")                                                         │
│     Provider.streamText({                                                           │
│       model,                                                                        │
│       system: PROMPT_COMPACTION,                                                    │
│       messages: 历史消息                                                            │
│     })                                                                              │
│                                                                                     │
│  4. 创建压缩消息                                                                    │
│     - 删除旧消息                                                                    │
│     - 创建摘要消息                                                                  │
│     - 更新会话状态                                                                  │
│                                                                                     │
│  5. 发布事件                                                                        │
│     Bus.publish(Session.Event.Updated, { info })                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. 定时任务执行流程

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                定时任务执行流程                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

Scheduler 定时检查
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  检查 Schedule 表                                                                   │
│                                                                                     │
│  SELECT * FROM schedule                                                             │
│  WHERE enabled = true                                                               │
│  AND next_run <= now()                                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  执行任务                                                                           │
│                                                                                     │
│  For each due schedule:                                                             │
│  1. 更新状态: last_run = now(), next_run = 计算下次时间                              │
│  2. 创建新会话 (或使用关联会话)                                                      │
│  3. 发送 prompt 作为用户消息                                                        │
│  4. 等待 Agent 执行完成                                                             │
│  5. 记录执行结果                                                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. 错误处理流程

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  错误处理流程                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

错误发生
     │
     ├──────────────────┬──────────────────┬──────────────────┐
     │                  │                  │                  │
     ▼                  ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  API 错误   │  │  工具错误   │  │  权限错误   │  │  系统错误   │
│  (Provider) │  │  (Tool)     │  │ (Permission)│  │  (System)   │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
     │                  │                  │                  │
     ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  错误分类与处理                                                                     │
│                                                                                     │
│  APIError:                                                                          │
│  ├── isRetryable → 重试                                                            │
│  ├── statusCode === 401 → 认证错误，通知用户                                        │
│  └── 其他 → 记录错误，返回给用户                                                    │
│                                                                                     │
│  PermissionError:                                                                   │
│  └── 创建错误 Part，返回给用户                                                      │
│                                                                                     │
│  ToolExecutionError:                                                                │
│  └── 创建 ToolResultPart (error)，继续对话                                          │
│                                                                                     │
│  SystemError:                                                                       │
│  └── 记录日志，发送 session.error 事件                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  SSE 推送错误事件                                                                   │
│                                                                                     │
│  Bus.publish(Session.Event.Error, {                                                 │
│    sessionID,                                                                       │
│    error: { type, message }                                                         │
│  })                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. 配置加载流程

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  配置加载流程                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

Config.get()
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  加载顺序 (优先级从低到高)                                                           │
│                                                                                     │
│  1. 远程配置 (.well-known/opencode)                                                 │
│     └── fetch(url/.well-known/opencode)                                             │
│                                                                                     │
│  2. 全局配置 (~/.config/opencode/)                                                  │
│     ├── opencode.jsonc                                                              │
│     ├── opencode.json                                                               │
│     └── config.json                                                                 │
│                                                                                     │
│  3. 自定义配置 (OPENCODE_CONFIG)                                                    │
│     └── 加载指定路径的配置文件                                                       │
│                                                                                     │
│  4. 项目配置                                                                        │
│     ├── <project>/opencode.json                                                     │
│     └── <project>/opencode.jsonc                                                    │
│                                                                                     │
│  5. .opencode 目录                                                                  │
│     ├── .opencode/opencode.json                                                     │
│     ├── .opencode/agents/*.md                                                       │
│     ├── .opencode/commands/*.md                                                     │
│     └── .opencode/plugins/*.ts                                                      │
│                                                                                     │
│  6. 内联配置 (OPENCODE_CONFIG_CONTENT)                                              │
│     └── 解析 JSON 内容                                                              │
│                                                                                     │
│  7. 托管配置 (企业管理)                                                             │
│     ├── /Library/Application Support/opencode/ (macOS)                              │
│     ├── C:\ProgramData\opencode\ (Windows)                                          │
│     └── /etc/opencode/ (Linux)                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  合并配置                                                                           │
│                                                                                     │
│  mergeConfigConcatArrays(target, source)                                            │
│  - 深度合并对象                                                                     │
│  - 数组字段连接 (plugin, instructions)                                              │
│  - 后加载的配置覆盖先加载的                                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  验证与返回                                                                         │
│                                                                                     │
│  Info.safeParse(config)                                                             │
│  返回 Config.Info                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 总结

### 关键流程概览

| 流程 | 入口 | 核心模块 | 输出 |
|------|------|---------|------|
| 系统启动 | `src/index.ts` | Server, Instance | HTTP 服务 |
| 会话创建 | `POST /session` | Session | Session.Info |
| 消息处理 | `POST /session/:id/message` | Session, Provider, Tool | SSE 流 |
| 权限检查 | `PermissionNext.ask()` | Permission | allow/deny/ask |
| 工具执行 | `Tool.execute()` | ToolRegistry | ToolResult |
| MCP 集成 | `MCP.state()` | MCP | Tools |
| 会话压缩 | `SessionCompaction.compact()` | Session, Agent | 压缩消息 |
| 事件推送 | `GET /event` | Bus, SSE | 事件流 |

### 数据流向

```
HTTP 请求 → 路由层 → 业务域层 → 服务层 → 基础设施层
                │
                ▼
              Bus 事件
                │
                ▼
              SSE 推送
                │
                ▼
              客户端
```