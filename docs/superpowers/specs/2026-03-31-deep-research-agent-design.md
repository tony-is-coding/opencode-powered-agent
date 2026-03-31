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

---

## 请求上下文与中间件

### 现有 vs 新中间件对比

```
现有流程                              新流程
────────────────────────────         ────────────────────────────
读取 directory header/param          读取 x-tenant-id header
检测 Git 仓库                        读取 x-user-id header
计算 ProjectID                       验证两者存在（否则 401）
初始化 Instance（重量级）             提供 TenantContext（轻量级）
  - Config 加载                        - tenantId
  - MCP 连接                           - userId
  - FileWatcher                        - Config（全局单例）
  - VCS 初始化                         - Agent 定义（全局单例）
  - Snapshot 初始化                    - ToolRegistry（全局单例）
  - ToolRegistry                       - MCP 连接（按需）
```

### TenantContext

```typescript
// src/tenant/index.ts
export namespace TenantContext {
  export interface Info {
    tenantId: string
    userId: string
  }

  // 从 AsyncLocalStorage 获取当前上下文
  export const get = (): Info => { ... }

  // 中间件：从 header 提取并注入上下文
  export const middleware = async (c: Context, next: Next) => {
    const tenantId = c.req.header("x-tenant-id")
    const userId = c.req.header("x-user-id")
    if (!tenantId || !userId) {
      return c.json({ error: "missing tenant or user identity" }, 401)
    }
    return provide({ tenantId, userId }, next)
  }
}
```

### Session 查询强制过滤

所有 Session 查询必须带租户过滤，防止跨租户数据泄露：

```typescript
// Session.list 示例
export const list = fn(z.object({}), async () => {
  const { tenantId, userId } = TenantContext.get()
  return db
    .select()
    .from(SessionTable)
    .where(
      and(
        eq(SessionTable.tenant_id, tenantId),
        eq(SessionTable.user_id, userId),
      )
    )
})
```

---

## Deep Research Agent

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

系统提示词（`PROMPT_DEEP_RESEARCH`）聚焦于：
- 多源信息收集与交叉验证
- 结构化研究报告输出
- 引用来源标注

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

    const res = await fetch(`${baseUrl}/query`, {
      method: "POST",
      headers: {
        "x-tenant-id": tenantId,
        "x-user-id": userId,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
      signal: ctx.abort,
    })

    if (!res.ok) throw new Error(`Data API error: ${res.status}`)
    return res.text()
  },
}
```

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
