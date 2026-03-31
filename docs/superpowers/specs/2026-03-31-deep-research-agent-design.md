# Deep Research Agent 设计文档

**日期**: 2026-03-31
**状态**: 待实现
**作者**: Terrence Tan

---

## 背景与目标

当前系统（AI Core）基于 opencode 项目改造，原本面向代码开发场景，核心概念是"项目（Project）= Git 仓库"。

本次改造目标：
1. 移除 Git/项目感知层，将 AI Core 改造为**多租户 AI Agent 执行引擎**
2. 引入租户+用户数据隔离机制
3. 在此基础上构建 **Deep Research Agent**，支持网络搜索和内部数据 API 查询

---

## 系统架构

### 三层架构

```
┌─────────────────────────────────────────────────────┐
│                   Gateway 层                         │
│  - 统一认证/鉴权                                     │
│  - 注入 x-tenant-id + x-user-id header              │
│  - 路由转发到 AI Core                                │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              AI Core（当前系统）                      │
│  - 读取 tenant_id + user_id，建立请求上下文           │
│  - Session/Message/Part 管理（数据按租户隔离）        │
│  - Deep Research Agent 执行                          │
│  - 工具调用：websearch、webfetch、data_api           │
│  - SSE 实时推送                                      │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                AI Data API 层                        │
│  - 结构化数据查询（内部知识库、数据库等）              │
│  - 接受 tenant_id + user_id 做数据权限控制            │
└─────────────────────────────────────────────────────┘
```

三层之间用户身份统一，AI Core 不做认证，信任 Gateway 注入的 header。

---

## 数据模型变更

### 移除的实体

- `project` 表 — 完全删除，Git 仓库感知能力随之移除
- `permission` 表（项目级权限）— 删除，权限仅保留在 Session 级别

### Session 表改造

```
移除字段                    新增字段
────────────────────        ────────────────────
project_id (FK)             tenant_id  TEXT NOT NULL
workspace_id                user_id    TEXT NOT NULL
directory
summary_additions
summary_deletions
summary_files
summary_diffs
revert
```

完整新表结构：

```typescript
const SessionTable = sqliteTable("session", {
  id: text().$type<SessionID>().primaryKey(),
  tenant_id: text().notNull(),              // 租户 ID（来自 gateway）
  user_id: text().notNull(),                // 用户 ID（来自 gateway）
  parent_id: text().$type<SessionID>(),     // 自引用，支持会话树
  slug: text().notNull(),
  title: text().notNull(),
  version: text().notNull(),
  // Session 级工具权限覆盖（可选）。
  // 解析规则：null 时使用 Agent 默认权限；非 null 时与 Agent 权限合并，
  // Session 规则优先级更高（后定义覆盖先定义）。
  // 安全约束：Session 权限只能限制工具，不能授予 Agent 定义之外的工具。
  permission: text({ mode: "json" }).$type<PermissionNext.Ruleset>(),
  time_created: integer(),
  time_updated: integer(),
  time_compacting: integer(),
  time_archived: integer(),
}, (table) => [
  index("session_tenant_user_idx").on(table.tenant_id, table.user_id),
  index("session_tenant_idx").on(table.tenant_id),
  index("session_parent_idx").on(table.parent_id),
])
```

### 其他表不变

`message`、`part`、`todo`、`schedule` 通过 `session_id` FK 级联，租户隔离通过 Session 层自然传递，无需修改。

### 数据迁移策略

**决策：清空现有数据，重建表结构。**

理由：现有 Session 记录绑定 Git 项目语义，无法反向推导出 `tenant_id` / `user_id`，强行回填无意义。

Drizzle 迁移步骤：
1. 删除 `permission` 表
2. 删除 `project` 表
3. 删除现有 `session` 表（含级联数据：message、part、todo、schedule）
4. 重建 `session` 表（新结构）

```sql
-- 迁移脚本（由 drizzle-kit generate 生成后手动确认）
DROP TABLE IF EXISTS permission;
DROP TABLE IF EXISTS schedule;
DROP TABLE IF EXISTS todo;
DROP TABLE IF EXISTS part;
DROP TABLE IF EXISTS message;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS project;
-- 重建 session 表（新结构见上方 SessionTable 定义）
```

**注意**：本次改造为破坏性迁移，执行前需备份或确认现有数据可丢弃。

迁移在单个事务中执行，失败时自动回滚：

```sql
BEGIN TRANSACTION;
DROP TABLE IF EXISTS permission;
DROP TABLE IF EXISTS schedule;
DROP TABLE IF EXISTS todo;
DROP TABLE IF EXISTS part;
DROP TABLE IF EXISTS message;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS project;
-- 重建 session 表（新结构）
CREATE TABLE session ( ... );
COMMIT;
-- 若任意步骤失败，Drizzle 迁移框架自动执行 ROLLBACK
```

---

## 请求上下文与中间件

### Config 作用域说明

本次改造中，Config 变为**全局单例**，所有租户共享相同的 Agent 定义、工具权限和 LLM Provider 配置。这是有意为之的设计决策：

- AI Core 是一个执行引擎，租户差异化配置由 Gateway 层管理
- 本次不实现租户级 Config 隔离（Out of Scope）
- Config 来源：环境变量 + 服务器全局配置文件（`~/.config/opencode/opencode.json`）
- 移除项目级配置加载（`opencode.json`、`.opencode/` 目录）

### 现有 vs 新中间件对比

```
现有流程                              新流程
────────────────────────────         ────────────────────────────
读取 directory header/param          读取 x-tenant-id header
检测 Git 仓库                        读取 x-user-id header
计算 ProjectID                       验证格式合法（否则 401）
初始化 Instance（重量级）             提供 TenantContext（轻量级）
  - Config 加载（项目级）               - tenantId
  - MCP 连接                           - userId
  - FileWatcher
  - VCS 初始化                       全局单例（服务启动时初始化）
  - Snapshot 初始化                    - Config
  - ToolRegistry                       - Agent 定义
                                       - ToolRegistry
                                       - MCP 连接（全局共享，见下方说明）
```

### MCP 连接生命周期

MCP 连接改为**全局共享**，在服务启动时初始化，所有租户共用同一组 MCP 连接：

- 连接在 `src/index.ts` 启动阶段初始化（替代原来在 `InstanceBootstrap` 中按目录初始化）
- 连接失败不阻断服务启动，记录警告日志后继续
- 不支持运行时热重载 MCP 配置（Out of Scope）

**多租户隔离说明**：MCP 工具本身不携带租户上下文，调用时不会自动注入 `tenant_id`。本次 Deep Research Agent 不使用 MCP 工具（仅使用 `websearch`、`webfetch`、`data_api`），因此无跨租户泄露风险。未来若需要租户感知的 MCP 工具，需单独设计。

### TenantContext

```typescript
// src/tenant/index.ts
export namespace TenantContext {
  export interface Info {
    tenantId: string   // 格式：非空字符串，由 gateway 保证合法性
    userId: string     // 格式：非空字符串，由 gateway 保证合法性
  }

  // 从 AsyncLocalStorage 获取当前上下文
  export const get = (): Info => { ... }

  // 中间件：从 header 提取并注入上下文
  // 验证规则：两个 header 均必须存在且非空
  // Gateway 负责保证值的合法性，AI Core 不做格式校验
  export const middleware = async (c: Context, next: Next) => {
    const tenantId = c.req.header("x-tenant-id")?.trim()
    const userId = c.req.header("x-user-id")?.trim()
    if (!tenantId || !userId) {
      // 记录安全日志
      Log.warn("missing tenant or user identity", {
        path: c.req.path,
        hasTenantId: !!tenantId,
        hasUserId: !!userId,
      })
      return c.json({ error: "missing tenant or user identity" }, 401)
    }
    return provide({ tenantId, userId }, next)
  }
}
```

### Session 查询强制过滤

**强制规则**：所有 Session 查询必须通过 `Session.forTenant()` 辅助函数构建 where 条件，禁止直接查询 SessionTable 而不带租户过滤。

```typescript
// src/session/index.ts

// 辅助函数：构建租户过滤条件（所有查询必须使用此函数）
const forTenant = () => {
  const { tenantId, userId } = TenantContext.get()
  return and(
    eq(SessionTable.tenant_id, tenantId),
    eq(SessionTable.user_id, userId),
  )
}

// Session.list 示例
export const list = fn(z.object({}), async () => {
  return db.select().from(SessionTable).where(forTenant())
})

// Session.get 示例（防止跨租户读取单条记录）
export const get = fn(SessionID.zod, async (id) => {
  return db
    .select()
    .from(SessionTable)
    .where(and(eq(SessionTable.id, id), forTenant()))
    .get()
})
```

**实现要求**：更新 `src/session/index.ts` 中所有 CRUD 函数，确保每个函数都调用 `forTenant()`。

**其他表的隔离保障**：`message`、`part`、`todo`、`schedule` 不需要单独加租户过滤。原因：
- 这些表的查询入口都先通过 `Session.get(sessionID)` 验证 Session 归属
- `Session.get` 已强制带 `forTenant()` 过滤，非本租户的 Session 会返回 null
- 路由层在 Session 不存在时返回 404，不会继续查询子表
- 因此租户隔离在 Session 层统一保障，子表无需重复过滤

### 路由迁移示例

所有路由移除 `Instance` 中间件依赖，改为从 `TenantContext` 读取身份信息。

**移除的路由**（依赖 Git/项目概念，本次直接删除）：
- `GET/POST /project` — 项目信息路由
- `GET /global` — 全局会话列表（原依赖 project_id）

**保留并改造的路由示例**：

```typescript
// 改造前（src/server/routes/session.ts）
app.get("/session", async (c) => {
  const instance = Instance.get()  // 依赖项目实例
  const sessions = await Session.list({ projectID: instance.project.id })
  return c.json(sessions)
})

// 改造后
app.get("/session", async (c) => {
  // TenantContext 由中间件注入，路由无需显式读取
  const sessions = await Session.list()  // 内部自动调用 forTenant()
  return c.json(sessions)
})
```

**健康检查路由**（无需 TenantContext，跳过中间件）：
```typescript
// /health 路由注册在 TenantContext 中间件之前
app.get("/health", (c) => c.json({ status: "ok" }))
```

---



### Agent 定义

```typescript
// src/agent/agent.ts 新增
{
  id: "deep_research",
  name: "Deep Research",
  prompt: PROMPT_DEEP_RESEARCH,
  tools: ["websearch", "webfetch", "data_api"],
  permission: {
    "websearch": [{ pattern: "*", action: "allow" }],
    "webfetch":  [{ pattern: "*", action: "allow" }],
    "data_api":  [{ pattern: "*", action: "allow" }],
  }
}
```

系统提示词（`PROMPT_DEEP_RESEARCH`）内容如下：

```
You are a deep research assistant. Your goal is to produce comprehensive, well-sourced research reports.

## Research Process
1. Break the research question into sub-questions
2. Search for information using websearch and webfetch
3. Query internal structured data using data_api when domain-specific knowledge is needed
4. Cross-validate findings across multiple sources
5. Synthesize into a structured report

## Output Format
- Start with an executive summary (2-3 sentences)
- Use clear headings and sections
- Cite every factual claim with its source URL or data source name
- End with a "Sources" section listing all references

## Guidelines
- Prefer primary sources over secondary summaries
- Acknowledge uncertainty when sources conflict
- Do not fabricate citations or data
- If data_api returns no results, note the gap explicitly
```

### 新增工具：`data_api`

**文件位置**: `src/tool/data_api.ts`

**调用流程**:

```
Agent 决定调用 data_api
        │
        ▼
构建请求（自动注入租户上下文）
  POST {DATA_API_BASE_URL}/query
  Headers:
    x-tenant-id: {tenantId}   ◀── 从 TenantContext 注入
    x-user-id: {userId}       ◀── 从 TenantContext 注入
  Body: { query, dataset? }
        │
        ▼
AI Data API 层处理（数据权限在此层控制）
        │
        ▼
返回结构化数据 → Agent 继续推理
```

**Data API 响应契约**：

AI Data API 层返回 JSON，工具直接将响应文本传给 Agent：

```json
// 成功响应
{
  "data": [...],
  "metadata": { "count": 10, "source": "dataset_name" }
}

// 错误响应（HTTP 4xx/5xx）
{
  "error": "dataset not found",
  "code": "NOT_FOUND"
}
```

工具实现中 `res.text()` 直接返回原始 JSON 字符串，Agent 负责解析和理解内容。AI Data API 层的具体 schema 由该层自行定义，AI Core 不做强约束。

**工具实现**:

```typescript
export const DataApiTool: Tool = {
  name: "data_api",
  description: "Query structured data from the internal data API. Use this to retrieve domain-specific knowledge, internal datasets, or structured records.",
  parameters: z.object({
    query: z.string().describe("Natural language query or structured query expression"),
    dataset: z.string().optional().describe("Target dataset name, omit to search across all accessible datasets"),
  }),
  execute: async (args, ctx) => {
    const { tenantId, userId } = TenantContext.get()
    const baseUrl = process.env.DATA_API_BASE_URL
    if (!baseUrl) throw new Error("DATA_API_BASE_URL not configured")

    // 30 秒超时，与 AbortSignal 合并
    const timeout = AbortSignal.timeout(30_000)
    const signal = AbortSignal.any([ctx.abort, timeout])

    let res: Response
    try {
      res = await fetch(`${baseUrl}/query`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId,
          "x-user-id": userId,
          "content-type": "application/json",
        },
        body: JSON.stringify(args),
        signal,
      })
    } catch (err) {
      // 网络错误或超时，返回可读错误信息给 Agent
      const msg = err instanceof Error ? err.message : String(err)
      return `[data_api error] Failed to reach Data API: ${msg}`
    }

    if (!res.ok) {
      // 4xx/5xx 返回错误描述，不抛出异常，让 Agent 决定如何处理
      return `[data_api error] Data API returned ${res.status}: ${await res.text()}`
    }

    return res.text()
  },
}
```

**错误处理策略**：
- 网络错误/超时：返回误字符串给 Agent，Agent 可决定重试或告知用户
- 4xx/5xx：同上，不抛出异常，避免中断整个 Agent 执行循环
- `DATA_API_BASE_URL` 未配置：抛出异常（服务配置错误，应在启动时发现）

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 4096 |
| `HOST` | 绑定地址 | 0.0.0.0 |
| `DATA_API_BASE_URL` | AI Data API 层地址 | 无（必填） |
| `OPENCODE_SERVER_PASSWORD` | Basic Auth 密码（可选） | - |
| `LOG_LEVEL` | 日志级别 | INFO |

---

## 实现范围

### 本次实现（In Scope）

1. 移除 `project` 表和相关代码（`src/project/`）
2. 移除 `permission` 表（项目级）
3. Session 表加 `tenant_id` + `user_id` 列，移除 Git 相关字段
4. 新增 `TenantContext` 模块替换 `Instance` 中间件
5. 更新所有 Session CRUD 查询加入租户过滤
6. 新增 `data_api` 工具（`src/tool/data_api.ts`）
7. 新增 `deep_research` Agent 定义和系统提示词
8. 生成并运行 Drizzle 迁移

### 不在本次范围（Out of Scope）

- Gateway 层实现
- AI Data API 层实现
- 前端 UI 改造
- 多租户配置管理（租户级 MCP、Agent 配置）

---

## 风险与注意事项

1. **数据迁移**：现有数据库中的 Session 记录有 `project_id`，迁移时需要决定是清空还是保留历史数据
2. **租户过滤遗漏**：单库方案要求每条 Session 查询都带 `tenant_id` 过滤，需要代码审查确保无遗漏
3. **Config 全局化**：原来 Config 是按项目实例加载的，改为全局单例后需要确认配置来源（环境变量 + 全局配置文件）
