# Deep Research Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI Core 从 Git 项目感知引擎改造为多租户 AI Agent 执行引擎，并新增 Deep Research Agent。

**Architecture:** 移除 `project` 表和 `Instance` 中间件，用轻量的 `TenantContext`（读取 `x-tenant-id` / `x-user-id` header）替代。Session 表加 `tenant_id` + `user_id` 列，所有查询通过 `forTenant()` 辅助函数强制过滤。新增 `data_api` 工具和 `deep_research` Agent。

**Tech Stack:** Bun, Hono, Drizzle ORM (SQLite), TypeScript, Zod, `@/util/context` (AsyncLocalStorage)

**Spec:** `docs/superpowers/specs/2026-03-31-deep-research-agent-design.md`

---

## File Map

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `backend/src/tenant/index.ts` | TenantContext 模块 |
| 新建 | `backend/src/tool/data_api.ts` | data_api 工具 |
| 新建 | `backend/src/agent/prompt/deep_research.txt` | Deep Research 系统提示词 |
| 修改 | `backend/src/session/session.sql.ts` | Session 表结构改造 |
| 修改 | `backend/src/session/index.ts` | 移除 Instance 依赖，加 forTenant() |
| 修改 | `backend/src/storage/schema.ts` | 移除 ProjectTable / PermissionTable 导出 |
| 修改 | `backend/src/agent/agent.ts` | 移除 Instance.state，加 deep_research agent |
| 修改 | `backend/src/tool/registry.ts` | 移除 Instance.state，注册 DataApiTool |
| 修改 | `backend/src/server/server.ts` | 替换 Instance 中间件为 TenantContext 中间件 |
| 修改 | `backend/src/mcp/index.ts` | 移除 Instance.state，改为全局 lazy 初始化 |
| 修改 | `backend/src/index.ts` | 服务启动时初始化 MCP 全局连接 |
| 删除 | `backend/src/project/` | 整个目录（project.ts, instance.ts, bootstrap.ts, vcs.ts, state.ts, schema.ts, project.sql.ts） |

---

## Task 1: 新建 TenantContext 模块

**Files:**
- Create: `backend/src/tenant/index.ts`

- [ ] **Step 1: 写 TenantContext 模块**

```typescript
// backend/src/tenant/index.ts
import { Context } from "@/util/context"
import { Log } from "@/util/log"
import type { Context as HonoContext, Next } from "hono"

interface TenantInfo {
  tenantId: string
  userId: string
}

const ctx = Context.create<TenantInfo>("tenant")
const log = Log.create({ service: "tenant" })

export namespace TenantContext {
  export type Info = TenantInfo

  export function get(): TenantInfo {
    return ctx.use()
  }

  export function provide<R>(value: TenantInfo, fn: () => R): R {
    return ctx.provide(value, fn)
  }

  export async function middleware(c: HonoContext, next: Next) {
    const tenantId = c.req.header("x-tenant-id")?.trim()
    const userId = c.req.header("x-user-id")?.trim()
    if (!tenantId || !userId) {
      log.warn("missing tenant or user identity", {
        path: c.req.path,
        hasTenantId: !!tenantId,
        hasUserId: !!userId,
      })
      return c.json({ error: "missing tenant or user identity" }, 401)
    }
    return ctx.provide({ tenantId, userId }, next)
  }
}
```

- [ ] **Step 2: 类型检查**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit 2>&1 | head -30
```

期望：只有与 project/Instance 相关的现有错误，无新增错误。

- [ ] **Step 3: Commit**

```bash
git add backend/src/tenant/index.ts
git commit -m "feat(tenant): add TenantContext module with middleware"
```

---

## Task 2: 改造 Session 表结构

**Files:**
- Modify: `backend/src/session/session.sql.ts`

- [ ] **Step 1: 修改 session.sql.ts**

将 `SessionTable` 改为：

```typescript
// backend/src/session/session.sql.ts
import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core"
import type { MessageV2 } from "./message-v2"
import type { PermissionNext } from "../permission/next"
import type { SessionID, MessageID, PartID } from "./schema"
import { Timestamps } from "../storage/schema.sql"

type PartData = Omit<MessageV2.Part, "id" | "sessionID" | "messageID">
type InfoData = Omit<MessageV2.Info, "id" | "sessionID">

export const SessionTable = sqliteTable(
  "session",
  {
    id: text().$type<SessionID>().primaryKey(),
    tenant_id: text().notNull(),
    user_id: text().notNull(),
    parent_id: text().$type<SessionID>(),
    slug: text().notNull(),
    title: text().notNull(),
    version: text().notNull(),
    // Session 级权限覆盖（可选）。null 时使用 Agent 默认权限；
    // 非 null 时与 Agent 权限合并，Session 规则优先级更高。
    // 安全约束：Session 权限只能限制工具，不能授予 Agent 定义之外的工具。
    permission: text({ mode: "json" }).$type<PermissionNext.Ruleset>(),
    ...Timestamps,
    time_compacting: integer(),
    time_archived: integer(),
  },
  (table) => [
    index("session_tenant_user_idx").on(table.tenant_id, table.user_id),
    index("session_tenant_idx").on(table.tenant_id),
    index("session_parent_idx").on(table.parent_id),
  ],
)

export const MessageTable = sqliteTable(
  "message",
  {
    id: text().$type<MessageID>().primaryKey(),
    session_id: text()
      .$type<SessionID>()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    ...Timestamps,
    data: text({ mode: "json" }).notNull().$type<InfoData>(),
  },
  (table) => [index("message_session_time_created_id_idx").on(table.session_id, table.time_created, table.id)],
)

export const PartTable = sqliteTable(
  "part",
  {
    id: text().$type<PartID>().primaryKey(),
    message_id: text()
      .$type<MessageID>()
      .notNull()
      .references(() => MessageTable.id, { onDelete: "cascade" }),
    session_id: text().$type<SessionID>().notNull(),
    ...Timestamps,
    data: text({ mode: "json" }).notNull().$type<PartData>(),
  },
  (table) => [
    index("part_message_id_id_idx").on(table.message_id, table.id),
    index("part_session_idx").on(table.session_id),
  ],
)

export const TodoTable = sqliteTable(
  "todo",
  {
    session_id: text()
      .$type<SessionID>()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    content: text().notNull(),
    status: text().notNull(),
    priority: text().notNull(),
    position: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.session_id, table.position] }),
    index("todo_session_idx").on(table.session_id),
  ],
)
// PermissionTable 已移除（项目级权限表不再需要）
```

- [ ] **Step 2: 更新 storage/schema.ts**

```typescript
// backend/src/storage/schema.ts
export { SessionTable, MessageTable, PartTable, TodoTable } from "../session/session.sql"
export { ScheduleTable } from "../schedule/schedule.sql"
// ProjectTable 和 PermissionTable 已移除
```

- [ ] **Step 3: 类型检查**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit 2>&1 | head -40
```

期望：出现与 `project_id`、`directory`、`Instance` 相关的错误（后续任务修复），无其他新增错误。

- [ ] **Step 4: Commit**

```bash
git add backend/src/session/session.sql.ts backend/src/storage/schema.ts
git commit -m "feat(session): replace project_id with tenant_id+user_id in session table"
```

---

## Task 3: 改造 Session 业务逻辑

**Files:**
- Modify: `backend/src/session/index.ts`

- [ ] **Step 1: 更新 Session.Info Zod schema**

在 `session/index.ts` 中，将 `Info` schema 中的 `projectID`、`workspaceID`、`directory`、`summary`、`share`、`revert` 替换为 `tenantId` + `userId`：

```typescript
// 替换 Info schema（约第 119 行）
export const Info = z
  .object({
    id: SessionID.zod,
    slug: z.string(),
    tenantId: z.string(),
    userId: z.string(),
    parentID: SessionID.zod.optional(),
    title: z.string(),
    version: z.string(),
    time: z.object({
      created: z.number(),
      updated: z.number(),
      compacting: z.number().optional(),
      archived: z.number().optional(),
    }),
    permission: PermissionNext.Ruleset.optional(),
  })
  .meta({ ref: "Session" })
export type Info = z.output<typeof Info>
```

- [ ] **Step 2: 更新 fromRow / toRow**

```typescript
export function fromRow(row: SessionRow): Info {
  return {
    id: row.id,
    slug: row.slug,
    tenantId: row.tenant_id,
    userId: row.user_id,
    parentID: row.parent_id ?? undefined,
    title: row.title,
    version: row.version,
    permission: row.permission ?? undefined,
    time: {
      created: row.time_created,
      updated: row.time_updated,
      compacting: row.time_compacting ?? undefined,
      archived: row.time_archived ?? undefined,
    },
  }
}

export function toRow(info: Info) {
  return {
    id: info.id,
    tenant_id: info.tenantId,
    user_id: info.userId,
    parent_id: info.parentID,
    slug: info.slug,
    title: info.title,
    version: info.version,
    permission: info.permission,
    time_created: info.time.created,
    time_updated: info.time.updated,
    time_compacting: info.time.compacting,
    time_archived: info.time.archived,
  }
}
```

- [ ] **Step 3a: 添加 forTenant() 辅助函数**

在 `Session` namespace 顶部（`const log = ...` 之后）添加：

```typescript
import { TenantContext } from "@/tenant"

function forTenant() {
  const { tenantId, userId } = TenantContext.get()
  return and(
    eq(SessionTable.tenant_id, tenantId),
    eq(SessionTable.user_id, userId),
  )
}
```

- [ ] **Step 3b: 更新读取函数（get、list、children）**

```typescript
// get（第 344 行）
export const get = fn(SessionID.zod, async (id) => {
  const row = Database.use((db) =>
    db.select().from(SessionTable)
      .where(and(eq(SessionTable.id, id), forTenant()))
      .get()
  )
  if (!row) throw new NotFoundError({ message: `Session not found: ${id}` })
  return fromRow(row)
})

// list（第 518 行）— 移除 Instance.project 依赖
export function* list(input?: { roots?: boolean; start?: number; search?: string; limit?: number }) {
  const conditions = [forTenant()]
  if (input?.roots) conditions.push(isNull(SessionTable.parent_id))
  if (input?.start) conditions.push(gte(SessionTable.time_updated, input.start))
  if (input?.search) conditions.push(like(SessionTable.title, `%${input.search}%`))
  const rows = Database.use((db) =>
    db.select().from(SessionTable).where(and(...conditions))
      .orderBy(desc(SessionTable.time_updated)).limit(input?.limit ?? 100).all()
  )
  for (const row of rows) yield fromRow(row)
}

// children（第 631 行）— 移除 Instance.project 依赖
export const children = fn(SessionID.zod, async (parentID) => {
  const rows = Database.use((db) =>
    db.select().from(SessionTable)
      .where(and(forTenant(), eq(SessionTable.parent_id, parentID)))
      .all()
  )
  return rows.map(fromRow)
})
```

- [ ] **Step 3c: 更新写入函数（touch、setTitle、setArchived、setPermission）**

在每个函数的 `.where(eq(SessionTable.id, ...))` 后追加 `forTenant()`：

```typescript
// touch（第 279 行）
.where(and(eq(SessionTable.id, sessionID), forTenant()))

// setTitle（第 359 行）
.where(and(eq(SessionTable.id, input.sessionID), forTenant()))

// setArchived（第 380 行）
.where(and(eq(SessionTable.id, input.sessionID), forTenant()))

// setPermission（第 401 行）
.where(and(eq(SessionTable.id, input.sessionID), forTenant()))
```

- [ ] **Step 3d: 更新 setRevert、clearRevert、setSummary（保留但加 forTenant()）**

```typescript
// setRevert（第 422 行）
.where(and(eq(SessionTable.id, input.sessionID), forTenant()))

// clearRevert（第 450 行）
.where(and(eq(SessionTable.id, sessionID), forTenant()))

// setSummary（第 468 行）
.where(and(eq(SessionTable.id, input.sessionID), forTenant()))
```

- [ ] **Step 3e: 更新 remove，删除废弃函数**

```typescript
// remove（第 643 行）— 移除 Instance.project 引用，加 forTenant()
export const remove = fn(SessionID.zod, async (sessionID) => {
  try {
    const session = await get(sessionID)  // get 已带 forTenant()，跨租户会抛 NotFoundError
    for (const child of await children(sessionID)) {
      await remove(child.id)
    }
    Database.use((db) => {
      db.delete(SessionTable).where(and(eq(SessionTable.id, sessionID), forTenant())).run()
      Database.effect(() => Bus.publish(Event.Deleted, { info: session }))
    })
  } catch (e) {
    log.error(e)
  }
})
```

删除以下函数（整个函数体）：
- `listGlobal`（第 562 行）
- `plan`（第 337 行）
- `diff`（第 494 行）
- `share`（第 351 行）
- `unshare`（第 355 行）
- `initialize`（第 857 行）

删除以下类型：
- `ProjectInfo`（第 163 行）
- `GlobalInfo`（第 174 行）

- [ ] **Step 4: 移除不再需要的 import**

移除：
```typescript
import { Instance } from "../project/instance"
import { ProjectID } from "../project/schema"
import { Snapshot } from "@/snapshot"
import { Storage } from "@/storage/storage"
import { Flag } from "../flag/flag"
```

- [ ] **Step 5: 类型检查**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/session/index.ts
git commit -m "feat(session): replace Instance/project with TenantContext, add forTenant() isolation"
```

---

## Task 4: 改造 Agent 模块

**Files:**
- Modify: `backend/src/agent/agent.ts`
- Create: `backend/src/agent/prompt/deep_research.txt`

- [ ] **Step 1: 创建 Deep Research 系统提示词**

```
# backend/src/agent/prompt/deep_research.txt
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

- [ ] **Step 2: 改造 agent.ts**

将 `const state = Instance.state(async () => { ... })` 改为全局懒加载（移除 `Instance.state` 依赖）：

```typescript
// 替换 Instance.state 为全局 lazy 初始化（约第 51 行）
import { lazy } from "@/util/lazy"

const state = lazy(async () => {
  const cfg = await Config.get()
  // skillDirs 仍然可用（不依赖 Instance）
  const skillDirs = await Skill.dirs()
  const whitelistedDirs = [Truncate.GLOB, ...skillDirs.map((dir) => path.join(dir, "*"))]
  const defaults = PermissionNext.fromConfig({ /* 不变 */ })
  const user = PermissionNext.fromConfig(cfg.permission ?? {})

  const result: Record<string, Info> = {
    build: { /* 不变 */ },
    // plan agent: 移除依赖 Instance.worktree 的 edit 权限行
    // 原来有：
    //   edit: { [path.relative(Instance.worktree, path.join(Global.Path.data, "plans", "*.md"))]: "allow" }
    // 改为只保留绝对路径版本：
    plan: {
      name: "plan",
      description: "Plan mode. Disallows all edit tools.",
      options: {},
      permission: PermissionNext.merge(
        defaults,
        PermissionNext.fromConfig({
          question: "allow",
          plan_exit: "allow",
          external_directory: {
            [path.join(Global.Path.data, "plans", "*")]: "allow",
          },
          edit: {
            "*": "deny",
            [path.join(".opencode", "plans", "*.md")]: "allow",
            [path.join(Global.Path.data, "plans", "*.md")]: "allow",
            // 移除：path.relative(Instance.worktree, ...) — 无 worktree 概念
          },
        }),
        user,
      ),
      mode: "primary",
      native: true,
    },
    // general, explore, compaction, title, summary 不变（不依赖 Instance）
  }
  // ... 其余逻辑不变
})
```

在 `result` 对象中新增 `deep_research` agent（在 `summary` 之后）：

```typescript
import PROMPT_DEEP_RESEARCH from "./prompt/deep_research.txt"

deep_research: {
  name: "deep_research",
  description: "Deep research agent. Searches the web and internal data APIs to produce comprehensive research reports.",
  options: {},
  permission: PermissionNext.merge(
    PermissionNext.fromConfig({
      "*": "deny",
      websearch: "allow",
      webfetch: "allow",
      data_api: "allow",
    }),
  ),
  prompt: PROMPT_DEEP_RESEARCH,
  mode: "primary",
  native: true,
},
```

- [ ] **Step 3: 类型检查**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/agent/agent.ts backend/src/agent/prompt/deep_research.txt
git commit -m "feat(agent): add deep_research agent, convert state to global lazy init"
```

---

## Task 5: 新建 data_api 工具

**Files:**
- Create: `backend/src/tool/data_api.ts`

- [ ] **Step 1: 创建 data_api.ts**

```typescript
// backend/src/tool/data_api.ts
import z from "zod"
import { Tool } from "./tool"
import { TenantContext } from "@/tenant"
import { Log } from "@/util/log"

const log = Log.create({ service: "tool.data_api" })

export const DataApiTool = Tool.define("data_api", {
  description:
    "Query structured data from the internal data API. Use this to retrieve domain-specific knowledge, internal datasets, or structured records.",
  parameters: z.object({
    query: z.string().describe("Natural language query or structured query expression"),
    dataset: z
      .string()
      .optional()
      .describe("Target dataset name, omit to search across all accessible datasets"),
  }),
  async execute(args, _ctx) {
    const { tenantId, userId } = TenantContext.get()
    const baseUrl = process.env.DATA_API_BASE_URL
    if (!baseUrl) throw new Error("DATA_API_BASE_URL is not configured")

    const timeout = AbortSignal.timeout(30_000)

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
        signal: timeout,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.warn("data_api fetch failed", { error: msg, tenantId })
      return {
        title: "data_api",
        output: `[data_api error] Failed to reach Data API: ${msg}`,
        metadata: { error: true },
      }
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      log.warn("data_api non-ok response", { status: res.status, tenantId })
      return {
        title: "data_api",
        output: `[data_api error] Data API returned ${res.status}: ${body}`,
        metadata: { error: true, status: res.status },
      }
    }

    const output = await res.text()
    return {
      title: "data_api",
      output,
      metadata: {},
    }
  },
})
```

- [ ] **Step 2: 注册到 ToolRegistry**

在 `backend/src/tool/registry.ts` 中：

1. 将第 32 行 `const state = Instance.state(async () => {` 改为 `const state = lazy(async () => {`
2. 移除第 35-47 行中 `Config.directories()` 调用里的 `Instance.directory` / `Instance.worktree` 引用（自定义工具目录改为从 `Config.get()` 的全局配置路径获取）
3. 移除第 69 行 `Instance.directory` 和 `Instance.worktree` 引用（`fromPlugin` 函数中的 `pluginCtx`）
4. 在 `all()` 函数的工具列表中加入 `DataApiTool`：

```typescript
import { DataApiTool } from "./data_api"
import { lazy } from "@/util/lazy"

// 第 32 行：替换 Instance.state 为 lazy
const state = lazy(async () => {
  const custom = [] as Tool.Info[]
  // 自定义工具加载：移除 Instance.directory 依赖，改用 Global.Path.config
  const cfg = await Config.get()
  // ... 其余逻辑不变
  return { custom }
})

// fromPlugin 函数（第 59 行）：移除 Instance.directory / Instance.worktree
function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
  return {
    id,
    init: async (initCtx) => ({
      parameters: z.object(def.args),
      description: def.description,
      execute: async (args, ctx) => {
        const pluginCtx = { ...ctx } as unknown as PluginToolContext
        // 移除 directory 和 worktree 字段（不再有 Instance 概念）
        const result = await def.execute(args as any, pluginCtx)
        const out = await Truncate.output(result, {}, initCtx?.agent)
        return {
          title: "",
          output: out.truncated ? out.content : result,
          metadata: { truncated: out.truncated, outputPath: out.truncated ? out.outputPath : undefined },
        }
      },
    }),
  }
}

// all() 函数工具列表（约第 98 行）加入 DataApiTool：
return [
  InvalidTool,
  ...(question ? [QuestionTool] : []),
  BashTool,
  ReadTool,
  GlobTool,
  GrepTool,
  TaskTool,
  WebFetchTool,
  WebSearchTool,
  DataApiTool,  // 新增
  ...custom,
  // ...
]
```

**注意**：`Tool.define` 的 `execute` 返回格式为 `{ title: string, output: string, metadata: object }`，与 `WebFetchTool` 一致，data_api.ts 中的实现已正确匹配此格式。

- [ ] **Step 3: 类型检查**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/tool/data_api.ts backend/src/tool/registry.ts
git commit -m "feat(tool): add data_api tool with tenant context injection"
```

---

## Task 6: 改造 Server 中间件

**Files:**
- Modify: `backend/src/server/server.ts`

- [ ] **Step 1: 替换 Instance 中间件**

在 `server.ts` 中，将 `Instance.provide(...)` 中间件替换为 `TenantContext.middleware`：

```typescript
import { TenantContext } from "@/tenant"

// 删除这些 import：
// import { Instance } from "../project/instance"
// import { InstanceBootstrap } from "../project/bootstrap"
// import { Vcs } from "../project/vcs"
// import { Filesystem } from "@/util/filesystem"

// 替换中间件（约第 124-145 行）：
.use(async (c, next) => {
  if (c.req.path === "/log") return next()
  return TenantContext.middleware(c, next)
})
```

- [ ] **Step 2: 移除依赖 Instance 的路由**

删除 `server.ts` 中以下代码块（按行号定位）：

- 第 168-169 行：`.route("/project", ProjectRoutes())` — 删除整行
- 第 181-202 行：`POST /instance/dispose` 路由 — 删除整个 `.post("/instance/dispose", ...)` 块
- 第 203-241 行：`GET /path` 路由 — 删除整个 `.get("/path", ...)` 块
- 第 242-265 行：`GET /vcs` 路由 — 删除整个 `.get("/vcs", ...)` 块

移除对应 import（`server.ts` 顶部）：
```typescript
// 删除以下 import：
// import { ProjectRoutes } from "./routes/project"   // 第 22 行
// import { Instance } from "../project/instance"      // 第 12 行
// import { Vcs } from "../project/vcs"               // 第 13 行
// import { InstanceBootstrap } from "../project/bootstrap"  // 第 28 行
// import { Filesystem } from "@/util/filesystem"     // 第 33 行
// import { Global } from "../global"                 // 第 20 行（如果只被 /path 路由使用）
```

同时移除第 159-167 行的 `validator("query", ...)` 中间件（验证 `directory` 和 `workspace` query 参数，不再需要）。

- [ ] **Step 3: 类型检查**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/server/server.ts
git commit -m "feat(server): replace Instance middleware with TenantContext middleware"
```

---

## Task 6.5: 改造 MCP 全局初始化

**Files:**
- Modify: `backend/src/mcp/index.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: 将 MCP.state 改为全局 lazy**

在 `src/mcp/index.ts` 中，将第 182 行的 `const state = Instance.state(async () => {` 改为：

```typescript
import { lazy } from "@/util/lazy"

// 替换 Instance.state 为全局 lazy（第 182 行）
const state = lazy(async () => {
  const cfg = await Config.get()
  const config = cfg.mcp ?? {}
  // ... 其余逻辑不变
})
```

同时移除第 16 行的 `import { Instance } from "../project/instance"`。

- [ ] **Step 2: 在服务启动时触发 MCP 初始化**

在 `src/index.ts` 中，在 `Server.listen(...)` 之前加入 MCP 预热：

```typescript
import { MCP } from "./mcp"

// 服务启动时初始化 MCP 全局连接（非阻断，失败只记录警告）
MCP.init().catch((err) => {
  Log.Default.warn("MCP initialization failed", { error: err instanceof Error ? err.message : err })
})

const server = Server.listen({ port, hostname })
```

**注意**：`MCP.init()` 是触发 `lazy()` 的辅助函数，需在 `mcp/index.ts` 中导出：

```typescript
// 在 MCP namespace 中新增（mcp/index.ts）
export async function init() {
  return state()  // 触发 lazy 初始化
}
```

- [ ] **Step 3: 类型检查**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/mcp/index.ts backend/src/index.ts
git commit -m "feat(mcp): convert to global lazy init, trigger at server startup"
```

---

## Task 7: 删除 project/ 目录

**Files:**
- Delete: `backend/src/project/` (整个目录)

- [ ] **Step 1: 检查还有哪些文件引用 project/**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && grep -r "from.*project" src/ --include="*.ts" -l | grep -v "node_modules"
```

已知需要清理的文件（根据代码分析）：

| 文件 | 引用 | 处理方式 |
|------|------|---------|
| `src/session/index.ts` | `Instance`, `ProjectID`, `Snapshot`, `Storage` | Task 3 已处理 |
| `src/agent/agent.ts` | `Instance` | Task 4 已处理 |
| `src/tool/registry.ts` | `Instance` | Task 5 已处理 |
| `src/server/server.ts` | `Instance`, `InstanceBootstrap`, `Vcs`, `Filesystem` | Task 6 已处理 |
| `src/server/routes/project.ts` | `Project`, `Instance` | 整个文件删除 |
| `src/server/routes/global.ts` | `Session.listGlobal`, `ProjectTable` | 移除 listGlobal 调用，或删除整个路由 |
| `src/server/routes/session.ts` | `Session.plan`, `Session.diff`, `Snapshot` | 移除相关路由 handler |
| `src/project/bootstrap.ts` | `Project`, `Instance`, `Vcs`, `Snapshot` | 整个文件删除 |
| `src/scheduler/index.ts` | `Instance` | 检查并移除 Instance 依赖 |
| `src/session/prompt.ts` | `Instance` | 检查并移除 Instance.directory 引用 |
| `src/session/compaction.ts` | `Instance` | 检查并移除 |
| `src/session/summary.ts` | `Instance` | 检查并移除 |

- [ ] **Step 2: 修复剩余引用**

对 Step 1 grep 结果中每个文件，逐一处理：

```bash
# 查看每个文件的具体引用行
grep -n "Instance\|project/" src/server/routes/global.ts
grep -n "Instance\|project/" src/server/routes/session.ts
grep -n "Instance\|project/" src/session/prompt.ts
grep -n "Instance\|project/" src/scheduler/index.ts
```

**`src/server/routes/global.ts`**：移除 `Session.listGlobal` 调用（该函数已删除），或删除整个 `/global` 路由。

**`src/server/routes/session.ts`**：移除以下路由 handler（依赖已删除的函数）：
- `GET /session/:id/diff`（调用 `Session.diff`）
- `GET /session/:id/plan`（调用 `Session.plan`）
- 任何引用 `Snapshot` 的路由

**`src/session/prompt.ts`**：将 `Instance.directory` 替换为从 Session 信息中获取（Session 不再有 directory 字段，相关逻辑需移除）。

**`src/scheduler/index.ts`**：检查是否有 `Instance.provide()` 调用，若有则移除（scheduler 应直接使用 TenantContext 或不依赖 Instance）。

- [ ] **Step 3: 删除 project/ 目录**

```bash
rm -rf /Users/terrence_tan/startups/opencode-powered-agent/backend/src/project
```

- [ ] **Step 4: 类型检查（应无错误）**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit 2>&1 | head -40
```

期望：0 个错误。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove project/ directory and all Instance dependencies"
```

---

## Task 8: 生成并运行数据库迁移

**Files:**
- 由 drizzle-kit 自动生成迁移文件

- [ ] **Step 1: 备份现有数据库**

```bash
DB_PATH=$(cd /Users/terrence_tan/startups/opencode-powered-agent/backend && node -e "
const path = require('path'); const os = require('os');
const base = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library/Application Support/opencode')
  : path.join(os.homedir(), '.local/share/opencode');
console.log(path.join(base, 'opencode.db'));
")
cp "$DB_PATH" "${DB_PATH}.backup-$(date +%Y%m%d%H%M%S)" 2>/dev/null && echo "Backup created" || echo "No existing DB to backup"
```

- [ ] **Step 2: 生成迁移**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bun run db generate
```

- [ ] **Step 3: 检查生成的迁移 SQL**

```bash
ls -la drizzle/
cat drizzle/*.sql | head -60
```

确认迁移包含：
- DROP TABLE permission
- DROP TABLE project
- DROP TABLE session（旧结构）
- CREATE TABLE session（新结构，含 tenant_id + user_id）

- [ ] **Step 3: 运行迁移**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bun run db migrate
```

期望：迁移成功，无错误。

- [ ] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "feat(db): add migration for tenant-based session schema"
```

---

## Task 9: 最终验证

- [ ] **Step 1: 完整类型检查**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && bunx tsc --noEmit
```

期望：0 个错误。

- [ ] **Step 2: 启动服务验证**

```bash
cd /Users/terrence_tan/startups/opencode-powered-agent/backend && DATA_API_BASE_URL=http://localhost:9999 bun run dev &
sleep 3

# 1. 无 tenant header → 应返回 401
curl -s http://localhost:4096/session | python3 -m json.tool
# 期望: { "error": "missing tenant or user identity" }

# 2. 有 tenant header → 应返回空列表 []
curl -s -H "x-tenant-id: t1" -H "x-user-id: u1" http://localhost:4096/session | python3 -m json.tool
# 期望: []

# 3. agent 列表包含 deep_research
curl -s -H "x-tenant-id: t1" -H "x-user-id: u1" http://localhost:4096/agent | python3 -c "import sys,json; agents=json.load(sys.stdin); print([a['name'] for a in agents])"
# 期望: [..., 'deep_research']

# 4. 创建 session → 应成功
SESSION=$(curl -s -X POST -H "x-tenant-id: t1" -H "x-user-id: u1" -H "content-type: application/json" \
  -d '{"title":"test session"}' http://localhost:4096/session)
echo $SESSION | python3 -m json.tool
SESSION_ID=$(echo $SESSION | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
# 期望: session 对象含 tenantId="t1", userId="u1"

# 5. 跨租户隔离验证：t2 不应看到 t1 的 session
curl -s -H "x-tenant-id: t2" -H "x-user-id: u1" http://localhost:4096/session | python3 -m json.tool
# 期望: []

kill %1
```

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete multi-tenant AI Core with Deep Research Agent"
```
