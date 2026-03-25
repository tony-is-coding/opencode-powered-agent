# OpenCode Agent Core API 文档

> 基于 OpenAPI 3.1.1 规范自动生成
>
> 版本: 0.0.3 | 共 66 个接口 | 118 个数据模型

## 目录

1. [全局管理 (Global)](#1-全局管理-global)
2. [应用信息 (App)](#2-应用信息-app)
3. [会话管理 (Session)](#3-会话管理-session)
4. [消息片段 (Part)](#4-消息片段-part)
5. [模型提供商 (Provider)](#5-模型提供商-provider)
6. [项目配置 (Config)](#6-项目配置-config)
7. [项目管理 (Project)](#7-项目管理-project)
8. [MCP 服务 (MCP)](#8-mcp-服务-mcp)
9. [权限管理 (Permission)](#9-权限管理-permission)
10. [问题交互 (Question)](#10-问题交互-question)
11. [工具管理 (Tool)](#11-工具管理-tool)
12. [事件订阅 (Event)](#12-事件订阅-event)
13. [实例管理 (Instance)](#13-实例管理-instance)
14. [路径信息 (Path)](#14-路径信息-path)
15. [版本控制 (VCS)](#15-版本控制-vcs)
16. [命令管理 (Command)](#16-命令管理-command)
17. [数据模型 (Schemas)](#17-数据模型-schemas)

---

## 基本信息

| 项目 | 值 |
|------|-----|
| 基础 URL | `http://{HOST}:{PORT}` (默认 `http://0.0.0.0:4096`) |
| 认证方式 | HTTP Basic Auth (用户名: `opencode`, 密码: `OPENCODE_SERVER_PASSWORD` 环境变量) |
| 内容类型 | `application/json` |
| SSE 事件流 | `text/event-stream` (`/event`, `/global/event`) |

### 通用查询参数

以下参数适用于除 `/global/*` 之外的所有接口:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `directory` | string | 否 | 项目目录路径 (也可通过 `x-opencode-directory` Header 传递) |
| `workspace` | string | 否 | 工作区标识 |

---

## 1. 全局管理 (Global)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/global/health` | `global.health` | 获取健康状态 |
| `GET` | `/global/config` | `global.config.get` | 获取全局配置 |
| `PATCH` | `/global/config` | `global.config.update` | 更新全局配置 |
| `GET` | `/global/event` | `global.event` | 订阅全局事件 |
| `POST` | `/global/dispose` | `global.dispose` | 销毁实例 |

### `GET` /global/health

**获取健康状态**

获取 OpenCode 服务器的健康信息。

- Operation ID: `global.health`

#### 响应

**`200`** — 成功

Content-Type: `application/json`

```typescript
object
```

---

### `GET` /global/config

**获取全局配置**

获取当前全局 OpenCode 配置设置和偏好。

- Operation ID: `global.config.get`

#### 响应

**`200`** — 成功

Content-Type: `application/json` — 参见 [Config](#config)

---

### `PATCH` /global/config

**更新全局配置**

更新全局 OpenCode 配置设置和偏好。

- Operation ID: `global.config.update`

#### 请求体 (`application/json`)

参见 [Config](#config)

#### 响应

- **`200`** — 成功，返回 `Config`
- **`400`** — 请求错误，返回 `BadRequestError`

---

### `GET` /global/event

**订阅全局事件**

通过 Server-Sent Events 订阅 OpenCode 系统的全局事件。

- Operation ID: `global.event`

#### 响应

**`200`** — SSE 事件流

Content-Type: `text/event-stream` — 参见 [GlobalEvent](#globalevent)

---

### `POST` /global/dispose

**销毁实例**

清理并销毁所有 OpenCode 实例，释放所有资源。

- Operation ID: `global.dispose`

#### 响应

**`200`** — 成功

```typescript
boolean
```

---

## 2. 应用信息 (App)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/agent` | `app.agents` | 列出所有 Agent |
| `GET` | `/skill` | `app.skills` | 列出所有 Skill |
| `POST` | `/log` | `app.log` | 写入日志 |

### `GET` /agent

**列出所有 Agent**

获取 OpenCode 系统中所有可用的 AI Agent 列表。

- Operation ID: `app.agents`

#### 响应

**`200`** — 成功

Content-Type: `application/json` — `Agent[]`

---

### `GET` /skill

**列出所有 Skill**

获取 OpenCode 系统中所有可用的 Skill 列表。

- Operation ID: `app.skills`

#### 响应

**`200`** — 成功

Content-Type: `application/json` — `Skill[]`

---

### `POST` /log

**写入日志**

向服务器日志写入一条日志条目，包含指定的级别和元数据。

- Operation ID: `app.log`

#### 请求体 (`application/json`)

```typescript
{
  service: string       // 服务名称
  level: "debug" | "info" | "error" | "warn"  // 日志级别
  message: string       // 日志消息
  extra?: Record<string, any>  // 附加元数据
}
```

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误，返回 `BadRequestError`

---

## 3. 会话管理 (Session)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/session` | `session.list` | 列出会话 |
| `POST` | `/session` | `session.create` | 创建会话 |
| `GET` | `/session/status` | `session.status` | 获取会话状态 |
| `GET` | `/session/{sessionID}` | `session.get` | 获取会话详情 |
| `PATCH` | `/session/{sessionID}` | `session.update` | 更新会话 |
| `DELETE` | `/session/{sessionID}` | `session.delete` | 删除会话 |
| `POST` | `/session/{sessionID}/abort` | `session.abort` | 中止会话 |
| `GET` | `/session/{sessionID}/children` | `session.children` | 获取子会话 |
| `POST` | `/session/{sessionID}/command` | `session.command` | 发送命令 |
| `GET` | `/session/{sessionID}/diff` | `session.diff` | 获取消息 diff |
| `POST` | `/session/{sessionID}/fork` | `session.fork` | 分叉会话 |
| `POST` | `/session/{sessionID}/init` | `session.init` | 初始化会话 |
| `GET` | `/session/{sessionID}/message` | `session.messages` | 获取会话消息 |
| `POST` | `/session/{sessionID}/message` | `session.prompt` | 发送消息 |
| `GET` | `/session/{sessionID}/message/{messageID}` | `session.message` | 获取单条消息 |
| `DELETE` | `/session/{sessionID}/message/{messageID}` | `session.deleteMessage` | 删除消息 |
| `POST` | `/session/{sessionID}/prompt_async` | `session.prompt_async` | 异步发送消息 |
| `POST` | `/session/{sessionID}/revert` | `session.revert` | 回退消息 |
| `POST` | `/session/{sessionID}/unrevert` | `session.unrevert` | 恢复已回退消息 |
| `POST` | `/session/{sessionID}/share` | `session.share` | 分享会话 |
| `DELETE` | `/session/{sessionID}/share` | `session.unshare` | 取消分享 |
| `POST` | `/session/{sessionID}/shell` | `session.shell` | 执行 Shell 命令 |
| `POST` | `/session/{sessionID}/summarize` | `session.summarize` | 总结会话 |
| `GET` | `/session/{sessionID}/todo` | `session.todo` | 获取待办事项 |

### `GET` /session

**列出会话**

获取所有 OpenCode 会话列表，按最近更新排序。

- Operation ID: `session.list`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `roots` | query | `boolean` | 否 | 仅返回根会话 (无 parentID) |
| `start` | query | `number` | 否 | 过滤此时间戳之后更新的会话 (毫秒) |
| `search` | query | `string` | 否 | 按标题过滤 (不区分大小写) |
| `limit` | query | `number` | 否 | 最大返回数量 |

#### 响应

**`200`** — 成功，返回 `Session[]`

---

### `POST` /session

**创建会话**

创建新的 OpenCode 会话，用于与 AI 助手交互和管理对话。

- Operation ID: `session.create`

#### 请求体 (`application/json`)

```typescript
{
  parentID?: string           // 父会话 ID
  title?: string              // 会话标题
  permission?: PermissionRuleset  // 权限规则集
  workspaceID?: string        // 工作区 ID
}
```

#### 响应

- **`200`** — 成功，返回 `Session`
- **`400`** — 请求错误，返回 `BadRequestError`

---

### `GET` /session/status

**获取会话状态**

获取所有会话的当前状态，包括活跃、空闲和已完成状态。

- Operation ID: `session.status`

#### 响应

- **`200`** — 成功，返回 `Record<string, SessionStatus>`
- **`400`** — 请求错误

---

### `GET` /session/{sessionID}

**获取会话详情**

获取指定 OpenCode 会话的详细信息。

- Operation ID: `session.get`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 响应

- **`200`** — 成功，返回 `Session`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `PATCH` /session/{sessionID}

**更新会话**

更新现有会话的属性，如标题或其他元数据。

- Operation ID: `session.update`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

```typescript
{
  title?: string
  time?: { created?: number, updated?: number }
}
```

#### 响应

- **`200`** — 成功，返回 `Session`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `DELETE` /session/{sessionID}

**删除会话**

删除会话并永久移除所有关联数据，包括消息和历史记录。

- Operation ID: `session.delete`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/abort

**中止会话**

中止活跃会话，停止所有正在进行的 AI 处理或命令执行。

- Operation ID: `session.abort`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `GET` /session/{sessionID}/children

**获取子会话**

获取从指定父会话分叉出的所有子会话。

- Operation ID: `session.children`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 响应

- **`200`** — 成功，返回 `Session[]`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/command

**发送命令**

向会话发送新命令，由 AI 助手执行。

- Operation ID: `session.command`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

```typescript
{
  command: string          // 命令名称
  arguments: string        // 命令参数
  messageID?: string       // 消息 ID
  agent?: string           // Agent 名称
  model?: string           // 模型名称
  variant?: string         // 模型变体
  parts?: Part[]           // 附加消息片段
}
```

#### 响应

- **`200`** — 成功
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `GET` /session/{sessionID}/diff

**获取消息 diff**

获取会话中特定用户消息产生的文件变更 (diff)。

- Operation ID: `session.diff`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |
| `messageID` | query | `string` (^msg.*) | 否 | 消息 ID |

#### 响应

**`200`** — 成功，返回 `FileDiff[]`

---

### `POST` /session/{sessionID}/fork

**分叉会话**

在指定消息点分叉现有会话，创建新会话。

- Operation ID: `session.fork`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

```typescript
{
  messageID?: string  // 从此消息点分叉
}
```

#### 响应

**`200`** — 成功，返回 `Session`

---

### `POST` /session/{sessionID}/init

**初始化会话**

分析当前应用并创建 AGENTS.md 文件，包含项目特定的 Agent 配置。

- Operation ID: `session.init`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

```typescript
{
  modelID: string      // 模型 ID
  providerID: string   // 提供商 ID
  messageID: string    // 消息 ID
}
```

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `GET` /session/{sessionID}/message

**获取会话消息**

获取会话中的所有消息，包括用户提示和 AI 响应。

- Operation ID: `session.messages`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |
| `limit` | query | `integer` | 否 | 最大返回消息数 |
| `before` | query | `string` | 否 | 游标分页 |

#### 响应

- **`200`** — 成功，返回 `Message[]`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/message

**发送消息**

创建并发送新消息到会话，流式返回 AI 响应。

- Operation ID: `session.prompt`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

```typescript
{
  parts: Part[]              // 消息片段 (必填)
  messageID?: string         // 消息 ID
  model?: { id: string, providerID: string }  // 指定模型
  agent?: string             // Agent 名称
  noReply?: boolean          // 不需要 AI 回复
  tools?: object             // 工具配置
  format?: OutputFormat      // 输出格式
  system?: string            // 系统提示
  variant?: string           // 模型变体
}
```

#### 响应

- **`200`** — 成功
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `GET` /session/{sessionID}/message/{messageID}

**获取单条消息**

通过消息 ID 获取会话中的特定消息。

- Operation ID: `session.message`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |
| `messageID` | path | `string` (^msg.*) | 是 | 消息 ID |

#### 响应

- **`200`** — 成功，返回 `Message`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `DELETE` /session/{sessionID}/message/{messageID}

**删除消息**

永久删除会话中的特定消息 (及其所有片段)。不会回退消息处理期间可能做出的文件更改。

- Operation ID: `session.deleteMessage`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |
| `messageID` | path | `string` (^msg.*) | 是 | 消息 ID |

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/prompt_async

**异步发送消息**

异步创建并发送新消息到会话，立即返回。

- Operation ID: `session.prompt_async`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

与 `session.prompt` 相同。

#### 响应

- **`204`** — 已接受
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/revert

**回退消息**

回退会话中的特定消息，撤销其效果并恢复到之前的状态。

- Operation ID: `session.revert`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

```typescript
{
  messageID: string    // 要回退的消息 ID
  partID?: string      // 可选的片段 ID
}
```

#### 响应

- **`200`** — 成功，返回 `Session`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/unrevert

**恢复已回退消息**

恢复会话中所有之前回退的消息。

- Operation ID: `session.unrevert`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 响应

- **`200`** — 成功，返回 `Session`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/share

**分享会话**

创建会话的可分享链接，允许他人查看对话。

- Operation ID: `session.share`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 响应

- **`200`** — 成功，返回 `Session`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `DELETE` /session/{sessionID}/share

**取消分享**

移除会话的可分享链接，使其重新变为私有。

- Operation ID: `session.unshare`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 响应

- **`200`** — 成功，返回 `Session`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/shell

**执行 Shell 命令**

在会话上下文中执行 Shell 命令并返回 AI 的响应。

- Operation ID: `session.shell`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

```typescript
{
  agent: string              // Agent 名称
  command: string            // Shell 命令
  model?: { id: string, providerID: string }  // 指定模型
}
```

#### 响应

- **`200`** — 成功，返回 `AssistantMessage`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/summarize

**总结会话**

使用 AI 压缩生成会话的简洁摘要，保留关键信息。

- Operation ID: `session.summarize`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 请求体 (`application/json`)

```typescript
{
  providerID: string   // 提供商 ID
  modelID: string      // 模型 ID
  auto?: boolean       // 是否自动总结
}
```

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `GET` /session/{sessionID}/todo

**获取待办事项**

获取与特定会话关联的待办事项列表，显示任务和操作项。

- Operation ID: `session.todo`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |

#### 响应

- **`200`** — 成功，返回 `Todo[]`
- **`400`** — 请求错误
- **`404`** — 未找到

---

## 4. 消息片段 (Part)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `PATCH` | `/session/{sessionID}/message/{messageID}/part/{partID}` | `part.update` | 更新消息片段 |
| `DELETE` | `/session/{sessionID}/message/{messageID}/part/{partID}` | `part.delete` | 删除消息片段 |

### `PATCH` /session/{sessionID}/message/{messageID}/part/{partID}

**更新消息片段**

更新消息中的一个片段。

- Operation ID: `part.update`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |
| `messageID` | path | `string` (^msg.*) | 是 | 消息 ID |
| `partID` | path | `string` (^prt.*) | 是 | 片段 ID |

#### 请求体 (`application/json`)

参见 [Part](#part) — 支持多种片段类型的联合类型。

#### 响应

- **`200`** — 成功，返回 `Part`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `DELETE` /session/{sessionID}/message/{messageID}/part/{partID}

**删除消息片段**

从消息中删除一个片段。

- Operation ID: `part.delete`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |
| `messageID` | path | `string` (^msg.*) | 是 | 消息 ID |
| `partID` | path | `string` (^prt.*) | 是 | 片段 ID |

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

## 5. 模型提供商 (Provider)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/provider` | `provider.list` | 列出提供商 |
| `GET` | `/provider/auth` | `provider.auth` | 获取认证方式 |
| `POST` | `/provider/{providerID}/oauth/authorize` | `provider.oauth.authorize` | OAuth 授权 |
| `POST` | `/provider/{providerID}/oauth/callback` | `provider.oauth.callback` | OAuth 回调 |

### `GET` /provider

**列出提供商**

获取所有可用的 AI 提供商列表，包括可用和已连接的提供商。

- Operation ID: `provider.list`

#### 响应

**`200`** — 成功

Content-Type: `application/json` — `Record<ProviderID, Provider>`

---

### `GET` /provider/auth

**获取认证方式**

获取所有 AI 提供商的可用认证方式。

- Operation ID: `provider.auth`

#### 响应

**`200`** — 成功

Content-Type: `application/json` — `Record<ProviderID, ProviderAuthMethod[]>`

---

### `POST` /provider/{providerID}/oauth/authorize

**OAuth 授权**

为特定 AI 提供商发起 OAuth 授权，获取授权 URL。

- Operation ID: `provider.oauth.authorize`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `providerID` | path | `string` | 是 | 提供商 ID |

#### 请求体 (`application/json`)

```typescript
{
  method: number  // 认证方式索引
}
```

#### 响应

- **`200`** — 成功，返回 `ProviderAuthAuthorization`
- **`400`** — 请求错误

---

### `POST` /provider/{providerID}/oauth/callback

**OAuth 回调**

处理提供商用户授权后的 OAuth 回调。

- Operation ID: `provider.oauth.callback`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `providerID` | path | `string` | 是 | 提供商 ID |

#### 请求体 (`application/json`)

```typescript
{
  method: number     // 认证方式索引
  code?: string      // 授权码
}
```

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误

---

## 6. 项目配置 (Config)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/config` | `config.get` | 获取配置 |
| `PATCH` | `/config` | `config.update` | 更新配置 |
| `GET` | `/config/providers` | `config.providers` | 列出配置的提供商 |

### `GET` /config

**获取配置**

获取当前 OpenCode 配置设置和偏好。

- Operation ID: `config.get`

#### 响应

**`200`** — 成功，返回 `Config`

---

### `PATCH` /config

**更新配置**

更新 OpenCode 配置设置和偏好。

- Operation ID: `config.update`

#### 请求体 (`application/json`)

参见 [Config](#config)

#### 响应

- **`200`** — 成功，返回 `Config`
- **`400`** — 请求错误

---

### `GET` /config/providers

**列出配置的提供商**

获取所有已配置的 AI 提供商及其默认模型。

- Operation ID: `config.providers`

#### 响应

**`200`** — 成功

Content-Type: `application/json` — `Record<string, ProviderConfig>`

---

## 7. 项目管理 (Project)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/project` | `project.list` | 列出所有项目 |
| `GET` | `/project/current` | `project.current` | 获取当前项目 |
| `POST` | `/project/git/init` | `project.initGit` | 初始化 Git 仓库 |
| `PATCH` | `/project/{projectID}` | `project.update` | 更新项目 |

### `GET` /project

**列出所有项目**

获取已使用 OpenCode 打开的项目列表。

- Operation ID: `project.list`

#### 响应

**`200`** — 成功，返回 `Project[]`

---

### `GET` /project/current

**获取当前项目**

获取 OpenCode 当前正在使用的活跃项目。

- Operation ID: `project.current`

#### 响应

**`200`** — 成功，返回 `Project`

---

### `POST` /project/git/init

**初始化 Git 仓库**

为当前项目创建 Git 仓库并返回刷新后的项目信息。

- Operation ID: `project.initGit`

#### 响应

**`200`** — 成功，返回 `Project`

---

### `PATCH` /project/{projectID}

**更新项目**

更新项目属性，如名称、图标和命令。

- Operation ID: `project.update`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `projectID` | path | `string` | 是 | 项目 ID |

#### 请求体 (`application/json`)

```typescript
{
  name?: string
  icon?: { type: string, value: string }
  commands?: Record<string, string>
}
```

#### 响应

- **`200`** — 成功，返回 `Project`
- **`400`** — 请求错误
- **`404`** — 未找到

---

## 8. MCP 服务 (MCP)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/mcp` | `mcp.status` | 获取 MCP 状态 |
| `POST` | `/mcp` | `mcp.add` | 添加 MCP 服务器 |
| `POST` | `/mcp/{name}/connect` | `mcp.connect` | 连接 MCP 服务器 |
| `POST` | `/mcp/{name}/disconnect` | `mcp.disconnect` | 断开 MCP 服务器 |
| `POST` | `/mcp/{name}/auth` | `mcp.auth.start` | 启动 MCP OAuth |
| `DELETE` | `/mcp/{name}/auth` | `mcp.auth.remove` | 移除 MCP OAuth |
| `POST` | `/mcp/{name}/auth/authenticate` | `mcp.auth.authenticate` | MCP OAuth 认证 |
| `POST` | `/mcp/{name}/auth/callback` | `mcp.auth.callback` | 完成 MCP OAuth |

### `GET` /mcp

**获取 MCP 状态**

获取所有 Model Context Protocol (MCP) 服务器的状态。

- Operation ID: `mcp.status`

#### 响应

**`200`** — 成功

Content-Type: `application/json` — `Record<string, MCPStatus>`

---

### `POST` /mcp

**添加 MCP 服务器**

动态添加新的 MCP 服务器到系统。

- Operation ID: `mcp.add`

#### 请求体 (`application/json`)

```typescript
{
  name: string                    // 服务器名称
  config: McpLocalConfig | McpRemoteConfig  // 服务器配置
}
```

#### 响应

- **`200`** — 成功
- **`400`** — 请求错误

---

### `POST` /mcp/{name}/connect

**连接 MCP 服务器**

- Operation ID: `mcp.connect`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `name` | path | `string` | 是 | MCP 服务器名称 |

#### 响应

**`200`** — 成功，返回 `boolean`

---

### `POST` /mcp/{name}/disconnect

**断开 MCP 服务器**

- Operation ID: `mcp.disconnect`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `name` | path | `string` | 是 | MCP 服务器名称 |

#### 响应

**`200`** — 成功，返回 `boolean`

---

### `POST` /mcp/{name}/auth

**启动 MCP OAuth**

为 MCP 服务器启动 OAuth 认证流程。

- Operation ID: `mcp.auth.start`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `name` | path | `string` | 是 | MCP 服务器名称 |

#### 响应

- **`200`** — 成功
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `DELETE` /mcp/{name}/auth

**移除 MCP OAuth**

移除 MCP 服务器的 OAuth 凭证。

- Operation ID: `mcp.auth.remove`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `name` | path | `string` | 是 | MCP 服务器名称 |

#### 响应

- **`200`** — 成功
- **`404`** — 未找到

---

### `POST` /mcp/{name}/auth/authenticate

**MCP OAuth 认证**

启动 OAuth 流程并等待回调 (打开浏览器)。

- Operation ID: `mcp.auth.authenticate`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `name` | path | `string` | 是 | MCP 服务器名称 |

#### 响应

- **`200`** — 成功，返回 `MCPStatus`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /mcp/{name}/auth/callback

**完成 MCP OAuth**

使用授权码完成 MCP 服务器的 OAuth 认证。

- Operation ID: `mcp.auth.callback`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `name` | path | `string` | 是 | MCP 服务器名称 |

#### 请求体 (`application/json`)

```typescript
{
  code: string  // 授权码
}
```

#### 响应

- **`200`** — 成功，返回 `MCPStatus`
- **`400`** — 请求错误
- **`404`** — 未找到

---

## 9. 权限管理 (Permission)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/permission` | `permission.list` | 列出待处理权限 |
| `POST` | `/permission/{requestID}/reply` | `permission.reply` | 回复权限请求 |
| `POST` | `/session/{sessionID}/permissions/{permissionID}` | `permission.respond` | 响应权限请求 |

### `GET` /permission

**列出待处理权限**

获取所有会话中待处理的权限请求。

- Operation ID: `permission.list`

#### 响应

**`200`** — 成功，返回 `PermissionRequest[]`

---

### `POST` /permission/{requestID}/reply

**回复权限请求**

批准或拒绝 AI 助手的权限请求。

- Operation ID: `permission.reply`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `requestID` | path | `string` (^per.*) | 是 | 权限请求 ID |

#### 请求体 (`application/json`)

```typescript
{
  reply: string       // "allow" | "deny"
  message?: string    // 附加消息
}
```

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /session/{sessionID}/permissions/{permissionID}

**响应权限请求**

批准或拒绝 AI 助手的权限请求。

- Operation ID: `permission.respond`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `sessionID` | path | `string` (^ses.*) | 是 | 会话 ID |
| `permissionID` | path | `string` (^per.*) | 是 | 权限 ID |

#### 请求体 (`application/json`)

```typescript
{
  response: string  // "allow" | "deny"
}
```

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

## 10. 问题交互 (Question)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/question` | `question.list` | 列出待处理问题 |
| `POST` | `/question/{requestID}/reply` | `question.reply` | 回复问题 |
| `POST` | `/question/{requestID}/reject` | `question.reject` | 拒绝问题 |

### `GET` /question

**列出待处理问题**

获取所有会话中待处理的问题请求。

- Operation ID: `question.list`

#### 响应

**`200`** — 成功，返回 `QuestionRequest[]`

---

### `POST` /question/{requestID}/reply

**回复问题**

为 AI 助手的问题请求提供答案。

- Operation ID: `question.reply`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `requestID` | path | `string` (^que.*) | 是 | 问题请求 ID |

#### 请求体 (`application/json`)

```typescript
{
  answers: string[]  // 答案列表
}
```

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

### `POST` /question/{requestID}/reject

**拒绝问题**

拒绝 AI 助手的问题请求。

- Operation ID: `question.reject`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `requestID` | path | `string` (^que.*) | 是 | 问题请求 ID |

#### 响应

- **`200`** — 成功，返回 `boolean`
- **`400`** — 请求错误
- **`404`** — 未找到

---

## 11. 工具管理 (Tool)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/experimental/tool` | `tool.list` | 列出工具 |
| `GET` | `/experimental/tool/ids` | `tool.ids` | 列出工具 ID |

### `GET` /experimental/tool

**列出工具**

获取特定提供商和模型组合的可用工具列表及其 JSON Schema 参数。

- Operation ID: `tool.list`

#### 参数

| 名称 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `provider` | query | `string` | 是 | 提供商 ID |
| `model` | query | `string` | 是 | 模型 ID |

#### 响应

- **`200`** — 成功，返回 `ToolListItem[]`
- **`400`** — 请求错误

---

### `GET` /experimental/tool/ids

**列出工具 ID**

获取所有可用工具 ID 的列表，包括内置工具和动态注册的工具。

- Operation ID: `tool.ids`

#### 响应

- **`200`** — 成功，返回 `string[]`
- **`400`** — 请求错误

---

## 12. 事件订阅 (Event)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/event` | `event.subscribe` | 订阅事件 |

### `GET` /event

**订阅事件**

通过 Server-Sent Events (SSE) 订阅实例级别的实时事件。

- Operation ID: `event.subscribe`

#### 响应

**`200`** — SSE 事件流

Content-Type: `text/event-stream`

连接后首先收到 `server.connected` 事件，之后持续接收以下事件类型:

| 事件类型 | 说明 |
|----------|------|
| `server.connected` | 连接已建立 |
| `server.heartbeat` | 心跳 (每 10 秒) |
| `server.instance.disposed` | 实例已销毁 |
| `session.created` | 会话已创建 |
| `session.updated` | 会话已更新 |
| `session.deleted` | 会话已删除 |
| `session.status` | 会话状态变更 |
| `session.idle` | 会话空闲 |
| `session.error` | 会话错误 |
| `session.compacted` | 会话已压缩 |
| `session.diff` | 会话 diff 变更 |
| `message.updated` | 消息已更新 |
| `message.removed` | 消息已移除 |
| `message.part.updated` | 消息片段已更新 |
| `message.part.delta` | 消息片段增量更新 |
| `message.part.removed` | 消息片段已移除 |
| `permission.asked` | 权限请求 |
| `permission.replied` | 权限已回复 |
| `question.asked` | 问题请求 |
| `question.replied` | 问题已回复 |
| `question.rejected` | 问题已拒绝 |
| `project.updated` | 项目已更新 |
| `todo.updated` | 待办已更新 |
| `mcp.tools.changed` | MCP 工具变更 |
| `command.executed` | 命令已执行 |
| `file.edited` | 文件已编辑 |
| `file.watcher.updated` | 文件监视器更新 |
| `vcs.branch.updated` | VCS 分支更新 |

---

## 13. 实例管理 (Instance)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `POST` | `/instance/dispose` | `instance.dispose` | 销毁实例 |

### `POST` /instance/dispose

**销毁实例**

清理并销毁当前 OpenCode 实例，释放所有资源。

- Operation ID: `instance.dispose`

#### 响应

**`200`** — 成功，返回 `boolean`

---

## 14. 路径信息 (Path)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/path` | `path.get` | 获取路径信息 |

### `GET` /path

**获取路径信息**

获取 OpenCode 实例的当前工作目录和相关路径信息。

- Operation ID: `path.get`

#### 响应

**`200`** — 成功

```typescript
{
  home: string       // 主目录
  state: string      // 状态目录
  config: string     // 配置目录
  worktree: string   // 工作树目录
  directory: string  // 当前目录
}
```

---

## 15. 版本控制 (VCS)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/vcs` | `vcs.get` | 获取 VCS 信息 |

### `GET` /vcs

**获取 VCS 信息**

获取当前项目的版本控制系统 (VCS) 信息，如 Git 分支。

- Operation ID: `vcs.get`

#### 响应

**`200`** — 成功

```typescript
{
  branch: string  // 当前分支名
}
```

---

## 16. 命令管理 (Command)

| 方法 | 路径 | 操作 ID | 说明 |
|------|------|---------|------|
| `GET` | `/command` | `command.list` | 列出命令 |

### `GET` /command

**列出命令**

获取 OpenCode 系统中所有可用命令的列表。

- Operation ID: `command.list`

#### 响应

**`200`** — 成功，返回 `Command[]`

---

## 17. 数据模型 (Schemas)

共 118 个数据模型。以下列出主要模型的结构定义。

---

### `Session`

```typescript
{
  id: string                    // 会话 ID (^ses.*)
  slug: string                  // 会话 slug
  projectID: string             // 项目 ID
  workspaceID?: string          // 工作区 ID
  directory: string             // 项目目录
  parentID?: string             // 父会话 ID
  summary?: { title: string }   // 摘要
  share?: { url: string }       // 分享信息
  title: string                 // 标题
  version: string               // 版本
  time: { created: number, updated: number }
  permission?: PermissionRuleset
  revert?: object               // 回退信息
}
```

### `Message`

联合类型: `UserMessage | AssistantMessage`

### `UserMessage`

```typescript
{
  id: string                    // 消息 ID (^msg.*)
  sessionID: string             // 会话 ID
  role: "user"                  // 角色
  time: { created: number, updated: number }
  format?: OutputFormat         // 输出格式
  summary?: object              // 摘要
  agent: string                 // Agent 名称
  model: { id: string, providerID: string }
  system?: string               // 系统提示
  tools?: object                // 工具配置
  variant?: string              // 模型变体
}
```

### `AssistantMessage`

```typescript
{
  id: string                    // 消息 ID (^msg.*)
  sessionID: string             // 会话 ID
  role: "assistant"             // 角色
  time: { created: number, updated: number }
  error?: ProviderAuthError | UnknownError | MessageOutputLengthError | MessageAbortedError
  parentID: string              // 父消息 ID (对应的用户消息)
  modelID: string               // 模型 ID
  providerID: string            // 提供商 ID
  mode: string                  // 模式
  agent: string                 // Agent 名称
  path: { state: string }      // 路径
  summary?: boolean             // 是否为摘要
  cost: number                  // 费用
  tokens: { input: number, output: number, reasoning?: number, cache_read?: number, cache_write?: number }
  structured?: any              // 结构化输出
  variant?: string              // 模型变体
  finish?: string               // 完成原因
}
```

### `Part`

联合类型，消息片段:

```typescript
TextPart | SubtaskPart | ReasoningPart | FilePart | ToolPart
| StepStartPart | StepFinishPart | SnapshotPart | PatchPart
| AgentPart | RetryPart | CompactionPart
```

### `TextPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "text"
  text: string
  synthetic?: boolean
  ignored?: boolean
  time?: { created: number, updated: number }
  metadata?: object
}
```

### `ToolPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "tool"
  callID: string               // 工具调用 ID
  tool: string                 // 工具名称
  state: ToolState             // 工具状态
  metadata?: object
}
```

### `ToolState`

联合类型: `ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError`

```typescript
// Pending
{ status: "pending", input: object, raw: string }

// Running
{ status: "running", input: object, title?: string, metadata?: object, time: object }

// Completed
{ status: "completed", input: object, output: string, title: string, metadata: object, time: object, attachments?: FilePart[] }

// Error
{ status: "error", input: object, error: string, metadata?: object, time: object }
```

### `SubtaskPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "subtask"
  prompt: string               // 子任务提示
  description: string          // 描述
  agent: string                // Agent 名称
  model?: { id: string, providerID: string }
  command?: string             // 命令
}
```

### `ReasoningPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "reasoning"
  text: string                 // 推理文本
  metadata?: object
  time: { created: number, updated: number }
}
```

### `FilePart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "file"
  mime: string                 // MIME 类型
  filename?: string            // 文件名
  url: string                  // 文件 URL
  source?: FilePartSource      // 来源 (FileSource | SymbolSource | ResourceSource)
}
```

### `StepStartPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "step-start"
  snapshot?: string            // 快照 ID
}
```

### `StepFinishPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "step-finish"
  reason: string               // 完成原因
  snapshot?: string            // 快照 ID
  cost: number                 // 费用
  tokens: { input: number, output: number, reasoning?: number }
}
```

### `SnapshotPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "snapshot"
  snapshot: string             // 快照 ID
}
```

### `PatchPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "patch"
  hash: string                 // 补丁哈希
  files: string[]              // 受影响的文件列表
}
```

### `AgentPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "agent"
  name: string                 // Agent 名称
  source?: object
}
```

### `RetryPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "retry"
  attempt: number              // 重试次数
  error: APIError              // 错误信息
  time: { created: number, updated: number }
}
```

### `CompactionPart`

```typescript
{
  id: string
  sessionID: string
  messageID: string
  type: "compaction"
  auto: boolean                // 是否自动压缩
  overflow?: boolean           // 是否溢出
}
```

---

### `Config`

```typescript
{
  $schema?: string                    // JSON Schema 引用
  logLevel?: "DEBUG" | "INFO" | "WARN" | "ERROR"
  server?: ServerConfig               // 服务器配置
  command?: Record<string, object>    // 命令配置
  skills?: Record<string, string>     // 技能文件夹路径
  watcher?: object                    // 文件监视器配置
  plugin?: string[]                   // 插件列表
  snapshot?: boolean                  // 快照开关
  share?: "manual" | "auto" | "disabled"  // 分享行为
  autoupdate?: boolean | string       // 自动更新
  disabled_providers?: string[]       // 禁用的提供商
  enabled_providers?: string[]        // 启用的提供商 (设置后仅这些生效)
  model?: Model                       // 默认模型
  small_model?: Model                 // 小模型
  default_agent?: string              // 默认 Agent
  username?: string                   // 自定义用户名
  agent?: Record<string, AgentConfig> // Agent 配置
  provider?: Record<string, ProviderConfig>  // 提供商配置
  mcp?: Record<string, McpLocalConfig | McpRemoteConfig>  // MCP 配置
  formatter?: boolean | object        // 格式化器
  lsp?: boolean | object              // LSP 配置
  instructions?: string[]             // 附加指令文件
  permission?: PermissionConfig       // 权限配置
  tools?: object                      // 工具配置
  compaction?: object                 // 压缩配置
  experimental?: object               // 实验性功能
}
```

### `ServerConfig`

```typescript
{
  port?: integer               // 监听端口
  hostname?: string            // 监听主机名
  mdns?: boolean               // 启用 mDNS 服务发现
  mdnsDomain?: string          // mDNS 域名 (默认: opencode.local)
  cors?: string[]              // 额外 CORS 域名
}
```

### `Agent`

```typescript
{
  name: string                 // Agent 名称
  description?: string         // 描述
  mode: "subagent" | "primary" | "all"  // 模式
  native?: boolean             // 是否内置
  hidden?: boolean             // 是否隐藏
  topP?: number                // Top-P 采样
  temperature?: number         // 温度
  color?: string               // 颜色
  permission: PermissionRuleset  // 权限规则
  model?: object               // 模型配置
  variant?: string             // 变体
  prompt?: string              // 提示
  options: object              // 选项
  steps?: integer              // 最大迭代步数
}
```

### `AgentConfig`

```typescript
{
  model?: Model                // 模型
  variant?: string             // 默认模型变体
  temperature?: number         // 温度
  top_p?: number               // Top-P
  prompt?: string              // 提示
  disable?: boolean            // 禁用
  description?: string         // 描述
  mode?: "subagent" | "primary" | "all"
  hidden?: boolean             // 隐藏
  options?: object             // 选项
  color?: string               // 颜色
  steps?: integer              // 最大步数
  permission?: PermissionConfig
}
```

### `Model`

```typescript
{
  id: string                   // 模型 ID
  providerID: string           // 提供商 ID
  api: object                  // API 配置
  name: string                 // 模型名称
  family?: string              // 模型系列
  capabilities: object         // 能力 (vision, reasoning, etc.)
  cost: object                 // 费用 (input, output per token)
  limit: object                // 限制 (context, output tokens)
  status: "alpha" | "beta" | "deprecated" | "active"
  options: object              // 选项
  headers: object              // 自定义 Headers
  release_date: string         // 发布日期
  variants?: object            // 变体
}
```

### `Provider`

```typescript
{
  id: string                   // 提供商 ID
  name: string                 // 名称
  source: "env" | "config" | "custom" | "api"  // 来源
  env: string[]                // 环境变量
  key?: string                 // API Key
  options: object              // 选项
  models: Record<string, Model>  // 模型列表
}
```

### `ProviderConfig`

```typescript
{
  api?: string                 // API 端点
  name?: string                // 名称
  env?: string[]               // 环境变量
  id?: string                  // ID
  npm?: string                 // NPM 包
  models?: Record<string, object>  // 模型配置
  whitelist?: string[]         // 白名单
  blacklist?: string[]         // 黑名单
  options?: object             // 选项
}
```

### `ProviderAuthAuthorization`

```typescript
{
  url: string                  // 授权 URL
  method: string               // 认证方式
  instructions: string         // 说明
}
```

### `ProviderAuthMethod`

```typescript
{
  type: string                 // 类型 ("api_key" | "oauth")
  label: string                // 标签
}
```

### `Project`

```typescript
{
  id: string                   // 项目 ID
  worktree: string             // 工作树路径
  vcs?: string                 // VCS 类型
  name?: string                // 项目名称
  icon?: object                // 图标
  commands?: object            // 命令
  time: { created: number, updated: number }
  sandboxes: string[]          // 沙箱列表
}
```

### `Command`

```typescript
{
  name: string                 // 命令名称
  description?: string         // 描述
  agent?: string               // Agent
  model?: string               // 模型
  source?: "command" | "mcp" | "skill"  // 来源
  template: string             // 模板
  subtask?: boolean            // 是否子任务
  hints: string[]              // 提示
}
```

### `Todo`

```typescript
{
  content: string              // 任务描述
  status: string               // 状态: pending, in_progress, completed, cancelled
  priority: string             // 优先级: high, medium, low
}
```

### `FileDiff`

```typescript
{
  file: string                 // 文件路径
  before: string               // 变更前内容
  after: string                // 变更后内容
  additions: number            // 新增行数
  deletions: number            // 删除行数
  status?: "added" | "deleted" | "modified"
}
```

---

### `PermissionRequest`

```typescript
{
  id: string                   // 权限请求 ID (^per.*)
  sessionID: string            // 会话 ID
  permission: string           // 权限类型
  patterns: string[]           // 匹配模式
  metadata: object             // 元数据
  always: string[]             // 始终允许的操作
  tool?: object                // 关联工具
}
```

### `PermissionRule`

```typescript
{
  permission: string           // 权限名称
  pattern: string              // 匹配模式
  action: "allow" | "deny" | "ask"  // 动作
}
```

### `PermissionRuleset`

```typescript
PermissionRule[]               // 权限规则数组
```

### `PermissionConfig`

```typescript
"ask" | "allow" | "deny"      // 或详细对象配置
```

### `QuestionRequest`

```typescript
{
  id: string                   // 问题请求 ID (^que.*)
  sessionID: string            // 会话 ID
  questions: QuestionInfo[]    // 问题列表
  tool?: object                // 关联工具
}
```

### `QuestionInfo`

```typescript
{
  question: string             // 完整问题
  header: string               // 简短标签 (最多 30 字符)
  options: QuestionOption[]    // 可选项
  multiple?: boolean           // 允许多选
  custom?: boolean             // 允许自定义答案 (默认: true)
}
```

### `QuestionOption`

```typescript
{
  label: string                // 显示文本 (1-5 个词)
  description: string          // 选项说明
}
```

### `MCPStatus`

联合类型:

```typescript
{ status: "connected" }
| { status: "disabled" }
| { status: "failed", error: string }
| { status: "needs_auth" }
| { status: "needs_client_registration", error: string }
```

### `McpLocalConfig`

```typescript
{
  type: "local"                // 连接类型
  command: string[]            // 命令和参数
  environment?: Record<string, string>  // 环境变量
  enabled?: boolean            // 启用/禁用
  timeout?: integer            // 超时 (毫秒, 默认 5000)
}
```

### `McpRemoteConfig`

```typescript
{
  type: "remote"               // 连接类型
  url: string                  // 远程 MCP 服务器 URL
  enabled?: boolean            // 启用/禁用
  headers?: Record<string, string>  // 请求头
  oauth?: McpOAuthConfig | false    // OAuth 配置
  timeout?: integer            // 超时 (毫秒, 默认 5000)
}
```

### `McpOAuthConfig`

```typescript
{
  clientId?: string            // OAuth 客户端 ID
  clientSecret?: string        // OAuth 客户端密钥
  scope?: string               // OAuth 作用域
}
```

### `OutputFormat`

联合类型:

```typescript
{ type: "text" }
| { type: "json_schema", schema: JSONSchema, retryCount?: integer }
```

### `Event`

联合类型，包含 29 种事件类型:

```typescript
Event.project.updated | Event.server.instance.disposed | Event.server.connected
| Event.global.disposed | Event.message.updated | Event.message.removed
| Event.message.part.updated | Event.message.part.delta | Event.message.part.removed
| Event.permission.asked | Event.permission.replied
| Event.question.asked | Event.question.replied | Event.question.rejected
| Event.session.status | Event.session.idle | Event.session.compacted
| Event.todo.updated | Event.mcp.tools.changed | Event.mcp.browser.open.failed
| Event.command.executed | Event.session.created | Event.session.updated
| Event.session.deleted | Event.session.diff | Event.session.error
| Event.file.watcher.updated | Event.vcs.branch.updated | Event.file.edited
```

每个事件的通用结构:

```typescript
{
  type: string                 // 事件类型标识
  properties: object           // 事件数据 (因事件类型而异)
}
```

### `GlobalEvent`

```typescript
{
  directory: string            // 项目目录
  payload: Event               // 事件载荷
}
```

### `APIError`

```typescript
{
  name: string                 // 错误名称
  data: object                 // 错误数据
}
```

### `BadRequestError`

```typescript
{
  data: any
  errors: object[]             // 错误列表
  success: boolean             // 始终为 false
}
```

### `NotFoundError`

```typescript
{
  name: string                 // 错误名称
  data: object                 // 错误数据
}
```

### `ToolListItem`

```typescript
{
  id: string                   // 工具 ID
  description: string          // 工具描述
  parameters: any              // JSON Schema 参数定义
}
```

### `FilePartSource`

联合类型: `FileSource | SymbolSource | ResourceSource`

### `FileSource`

```typescript
{
  type: "file"
  path: string                 // 文件路径
  text: { value: string, start: integer, end: integer }
}
```

### `SymbolSource`

```typescript
{
  type: "symbol"
  path: string                 // 文件路径
  name: string                 // 符号名称
  kind: integer                // 符号类型
  range: { start: { line: number, character: number }, end: { line: number, character: number } }
  text: { value: string, start: integer, end: integer }
}
```

### `ResourceSource`

```typescript
{
  type: "resource"
  clientName: string           // MCP 客户端名称
  uri: string                  // 资源 URI
  text: { value: string, start: integer, end: integer }
}
```

### `SessionStatus`

联合类型:

```typescript
{ status: "active", ... }
| { status: "idle", ... }
| { status: "completed", ... }
```

### `VcsInfo`

```typescript
{
  branch: string               // 当前分支名
}
```

### `Path`

```typescript
{
  home: string                 // 主目录
  state: string                // 状态目录
  config: string               // 配置目录
  worktree: string             // 工作树目录
  directory: string            // 当前目录
}
```

### `LogLevel`

```typescript
"DEBUG" | "INFO" | "WARN" | "ERROR"
```

### `LayoutConfig`

```typescript
"auto" | "stretch"             // @deprecated 始终使用 stretch 布局
```
