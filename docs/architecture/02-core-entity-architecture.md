# Backend 核心实体架构

> 本文档描述 OpenCode Agent Core 后端服务的核心数据实体及其关系。

## 实体关系图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    Project                                           │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │ id: ProjectID                                                                    │ │
│ │ worktree: string           # Git worktree 路径                                  │ │
│ │ vcs: "git" | null          # 版本控制系统                                       │ │
│ │ name: string               # 项目名称                                           │ │
│ │ sandboxes: string[]        # Sandbox 路径列表                                   │ │
│ │ commands: { start?: string }                                                    │ │
│ │ time_created, time_updated, time_initialized                                    │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
│                                       1:N                                           │
│                                       │                                             │
│                                       ▼                                             │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │                                   Session                                        │ │
│ │ ┌─────────────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ id: SessionID                                                               │ │ │
│ │ │ project_id: ProjectID (FK)                                                  │ │ │
│ │ │ parent_id: SessionID (FK, self-ref)   # 子会话关联                          │ │ │
│ │ │ workspace_id: string                  # 工作区 ID                            │ │ │
│ │ │ slug: string                          # URL 友好标识                         │ │ │
│ │ │ directory: string                     # 工作目录                             │ │ │
│ │ │ title: string                         # 会话标题                             │ │ │
│ │ │ version: string                       # 版本号                               │ │ │
│ │ │ permission: PermissionNext.Ruleset    # 会话级权限                           │ │ │
│ │ │ summary: { additions, deletions, files, diffs }                              │ │ │
│ │ │ revert: { messageID, partID, snapshot, diff }  # 回滚点                      │ │ │
│ │ │ time_created, time_updated, time_compacting, time_archived                   │ │ │
│ │ └─────────────────────────────────────────────────────────────────────────────┘ │ │
│ │                                       1:N                                       │ │
│ │                                       │                                         │ │
│ │           ┌───────────────────────────┴───────────────────────────┐            │ │
│ │           ▼                                                       ▼            │ │
│ │ ┌───────────────────────┐                           ┌───────────────────────┐  │ │
│ │ │       Message         │                           │         Todo          │  │ │
│ │ │ ───────────────────── │                           │ ───────────────────── │  │ │
│ │ │ id: MessageID         │                           │ session_id: SessionID │  │ │
│ │ │ session_id: SessionID │                           │ content: string       │  │ │
│ │ │ data: InfoData (JSON) │                           │ status: "pending" |   │  │ │
│ │ │ time_created          │                           │         "completed"   │  │ │
│ │ └───────────────────────┘                           │ priority: string      │  │ │
│ │         1:N                                         │ position: number      │  │ │
│ │         │                                           └───────────────────────┘  │ │
│ │         ▼                                                                      │ │
│ │ ┌───────────────────────┐                                                      │ │
│ │ │         Part          │                                                      │ │
│ │ │ ───────────────────── │                                                      │ │
│ │ │ id: PartID            │                                                      │ │
│ │ │ message_id: MessageID │                                                      │ │
│ │ │ session_id: SessionID │                                                      │ │
│ │ │ data: PartData (JSON) │                                                      │ │
│ │ │ time_created          │                                                      │ │
│ │ └───────────────────────┘                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   Schedule                                           │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │ id: ScheduleID                                                                   │ │
│ │ session_id: SessionID (FK)                                                       │ │
│ │ cron: string              # Cron 表达式                                          │ │
│ │ prompt: string            # 要执行的提示                                         │ │
│ │ enabled: boolean          # 是否启用                                             │ │
│ │ last_run: number          # 上次运行时间                                         │ │
│ │ next_run: number          # 下次运行时间                                         │ │
│ │ time_created, time_updated                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  Permission                                          │
│ ┌─────────────────────────────────────────────────────────────────────────────────┐ │
│ │ project_id: ProjectID (PK)                                                       │ │
│ │ data: PermissionNext.Ruleset (JSON)                                              │ │
│ │ time_created, time_updated                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 核心实体详解

### 1. Project (项目)

**数据表**: `project`

**职责**: 管理代码项目上下文

```typescript
// src/project/project.sql.ts
const ProjectTable = sqliteTable("project", {
  id: text().$type<ProjectID>().primaryKey(),
  worktree: text().notNull(),          // Git worktree 路径
  vcs: text(),                          // "git" 或 null
  name: text(),                         // 项目名称
  icon_url: text(),                     // 图标 URL
  icon_color: text(),                   // 图标颜色
  time_created: integer(),
  time_updated: integer(),
  time_initialized: integer(),
  sandboxes: text({ mode: "json" }).$type<string[]>(),
  commands: text({ mode: "json" }).$type<{ start?: string }>(),
})
```

**项目 ID 生成**: 基于 Git 仓库的第一个 commit hash

**生命周期**:
1. 检测目录是否为 Git 仓库
2. 获取 root commit hash 作为 ProjectID
3. 创建或获取现有项目记录
4. 初始化项目实例上下文

---

### 2. Session (会话)

**数据表**: `session`

**职责**: AI 对话会话容器

```typescript
// src/session/session.sql.ts
const SessionTable = sqliteTable("session", {
  id: text().$type<SessionID>().primaryKey(),
  project_id: text().$type<ProjectID>().notNull()
    .references(() => ProjectTable.id, { onDelete: "cascade" }),
  workspace_id: text(),
  parent_id: text().$type<SessionID>(),    // 自引用，支持会话树
  slug: text().notNull(),                   // URL 友好标识
  directory: text().notNull(),              // 工作目录
  title: text().notNull(),                  // 会话标题
  version: text().notNull(),                // 版本
  share_url: text(),                        // 分享 URL
  summary_additions: integer(),             // 代码增加行数
  summary_deletions: integer(),             // 代码删除行数
  summary_files: integer(),                 // 修改文件数
  summary_diffs: text({ mode: "json" }).$type<Snapshot.FileDiff[]>(),
  revert: text({ mode: "json" }).$type<{
    messageID: MessageID,
    partID?: PartID,
    snapshot?: string,
    diff?: string
  }>(),
  permission: text({ mode: "json" }).$type<PermissionNext.Ruleset>(),
  time_created: integer(),
  time_updated: integer(),
  time_compacting: integer(),
  time_archived: integer(),
})
```

**ID 生成**: `SessionID.descending()` - ULID 降序，支持按 ID 排序获取最新

**会话树结构**:
```
Session A (root, parent_id = null)
├── Session B (child, parent_id = A.id)
│   └── Session D (grandchild, parent_id = B.id)
└── Session C (child, parent_id = A.id)
```

**会话状态**:
- 正常: `time_archived = null`
- 已归档: `time_archived != null`
- 正在压缩: `time_compacting != null`

---

### 3. Message (消息)

**数据表**: `message`

**职责**: 会话中的单条消息 (用户或助手)

```typescript
// src/session/message-v2.ts
const Info = z.object({
  id: MessageID.zod,
  sessionID: SessionID.zod,
  role: z.enum(["user", "assistant"]),
  parentID: MessageID.zod.optional(),    // 用于助手消息关联用户消息

  // 用户消息特有
  command: z.string().optional(),        // 触发的命令
  args: z.string().optional(),           // 命令参数

  // 助手消息特有
  model: z.custom<Provider.Model>().optional(),
  usage: z.object({
    cost: z.number(),
    tokens: z.object({
      total: z.number(),
      input: z.number(),
      output: z.number(),
      reasoning: z.number(),
      cache: { write: z.number(), read: z.number() }
    })
  }).optional(),
  error: z.object({
    type: z.string(),
    message: z.string(),
  }).optional(),
})

// 数据库存储
const MessageTable = sqliteTable("message", {
  id: text().$type<MessageID>().primaryKey(),
  session_id: text().$type<SessionID>().notNull()
    .references(() => SessionTable.id, { onDelete: "cascade" }),
  time_created: integer(),
  data: text({ mode: "json" }).notNull().$type<InfoData>(),
})
```

**消息链**:
```
User Message 1 (command: "explain this code")
    │
    ▼
Assistant Message 1 (parentID: User Message 1.id)
    │
    ▼
User Message 2 (follow-up question)
    │
    ▼
Assistant Message 2 (parentID: User Message 2.id)
```

---

### 4. Part (消息部分)

**数据表**: `part`

**职责**: 消息的组成部分，支持丰富的内容类型

```typescript
// src/session/message-v2.ts

// 基础结构
const PartBase = z.object({
  id: PartID.zod,
  sessionID: SessionID.zod,
  messageID: MessageID.zod,
})

// 文本部分
const TextPart = PartBase.extend({
  type: z.literal("text"),
  text: z.string(),
  synthetic: z.boolean().optional(),     // 是否为合成内容
  ignored: z.boolean().optional(),       // 是否被忽略
  time: z.object({ start: z.number(), end: z.number().optional() }).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

// 推理部分 (Claude extended thinking)
const ReasoningPart = PartBase.extend({
  type: z.literal("reasoning"),
  text: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
  time: z.object({ start: z.number(), end: z.number().optional() }),
})

// 工具调用
const ToolCallPart = PartBase.extend({
  type: z.literal("tool_call"),
  name: z.string(),                      // 工具名称
  args: z.record(z.string(), z.any()),   // 参数
  callID: z.string(),                    // 调用 ID
  state: z.enum(["pending", "running", "done", "error"]),
  time: z.object({ start: z.number(), end: z.number().optional() }),
})

// 工具结果
const ToolResultPart = PartBase.extend({
  type: z.literal("tool_result"),
  toolCallID: z.string(),                // 对应的 tool_call ID
  toolCallName: z.string(),              // 工具名称
  output: z.string(),                    // 输出内容
  metadata: z.record(z.string(), z.any()).optional(),
  attachments: z.array(FilePart).optional(),
})

// 文件部分
const FilePart = PartBase.extend({
  type: z.literal("file"),
  name: z.string(),
  mime: z.string(),
  source: FileSource,                    // 文件来源 (path/base64/url)
})

// 快照部分
const SnapshotPart = PartBase.extend({
  type: z.literal("snapshot"),
  snapshot: z.string(),                  // Git 快照内容
})

// 补丁部分
const PatchPart = PartBase.extend({
  type: z.literal("patch"),
  hash: z.string(),
  files: z.string().array(),
})
```

**Part 类型汇总**:

| 类型 | 用途 | 角色 |
|------|------|------|
| `text` | 文本内容 | User/Assistant |
| `reasoning` | 推理过程 | Assistant |
| `tool_call` | 工具调用 | Assistant |
| `tool_result` | 工具结果 | System |
| `file` | 文件附件 | User |
| `snapshot` | 代码快照 | Assistant |
| `patch` | 代码补丁 | Assistant |

---

### 5. Todo (待办事项)

**数据表**: `todo`

**职责**: 会话级别的任务跟踪

```typescript
const TodoTable = sqliteTable("todo", {
  session_id: text().$type<SessionID>().notNull()
    .references(() => SessionTable.id, { onDelete: "cascade" }),
  content: text().notNull(),
  status: text().notNull(),              // "pending" | "in_progress" | "completed"
  priority: text().notNull(),            // 优先级
  position: integer().notNull(),         // 排序位置
  time_created: integer(),
  time_updated: integer(),
})
```

---

### 6. Schedule (定时任务)

**数据表**: `schedule`

**职责**: 定时执行 AI 任务

```typescript
const ScheduleTable = sqliteTable("schedule", {
  id: text().$type<ScheduleID>().primaryKey(),
  session_id: text().$type<SessionID>().notNull()
    .references(() => SessionTable.id, { onDelete: "cascade" }),
  cron: text().notNull(),                // Cron 表达式
  prompt: text().notNull(),              // 要执行的提示
  enabled: integer({ mode: "boolean" }).notNull().default(true),
  last_run: integer(),
  next_run: integer(),
  time_created: integer(),
  time_updated: integer(),
})
```

---

### 7. Permission (权限规则)

**数据表**: `permission`

**职责**: 项目级别的权限配置

```typescript
// 权限规则
const Rule = z.object({
  permission: z.string(),                // 权限名称 (如 "bash", "edit")
  pattern: z.string(),                   // 匹配模式 (如 "*", "*.env")
  action: z.enum(["allow", "deny", "ask"]),
})

// 规则集
const Ruleset = z.array(Rule)

// 数据库存储
const PermissionTable = sqliteTable("permission", {
  project_id: text().primaryKey()
    .references(() => ProjectTable.id, { onDelete: "cascade" }),
  time_created: integer(),
  time_updated: integer(),
  data: text({ mode: "json" }).notNull().$type<PermissionNext.Ruleset>(),
})
```

**权限检查流程**:
```
1. 查找最具体的匹配规则
2. 从后向前查找（后定义的规则优先级高）
3. 返回匹配的动作 (allow/deny/ask)
```

---

## ID 类型系统

所有实体使用类型安全的 ID：

```typescript
// src/session/schema.ts
export const SessionID = z.string().brand("SessionID")
export const MessageID = z.string().brand("MessageID")
export const PartID = z.string().brand("PartID")

// src/project/schema.ts
export const ProjectID = z.string().brand("ProjectID")

// src/provider/schema.ts
export const ProviderID = z.string().brand("ProviderID")
export const ModelID = z.string().brand("ModelID")
```

**ID 生成器** (基于 ULID):
```typescript
// 升序 ID (用于时间排序)
SessionID.ascending()  // 01ARZ3NDEKTSV4RRFFQ69G5FAV

// 降序 ID (用于反向时间排序)
SessionID.descending() // 7ZZZZZZZZZZZZZZZZZZZZZZZZZ
```

---

## 实体生命周期

### Session 生命周期

```
┌─────────────┐     create()      ┌─────────────┐
│   不存在    │ ─────────────────▶ │    新建     │
└─────────────┘                   └─────────────┘
                                        │
                                        │ 用户发送消息
                                        ▼
                                  ┌─────────────┐
                                  │    活跃     │
                                  └─────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
              ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
              │   压缩中    │     │    归档     │     │    删除     │
              └─────────────┘     └─────────────┘     └─────────────┘
                    │
                    ▼
              ┌─────────────┐
              │   已压缩    │
              └─────────────┘
```

### Message 生命周期

```
┌─────────────┐   User 发送    ┌─────────────┐
│   创建消息  │ ──────────────▶ │  User 消息  │
└─────────────┘                 └─────────────┘
                                      │
                                      │ Agent 处理
                                      ▼
┌─────────────┐   流式响应    ┌─────────────┐
│  创建 Parts │ ◀──────────── │ Assistant   │
└─────────────┘               │   消息      │
                              └─────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
              ┌─────────────┐                 ┌─────────────┐
              │  成功完成   │                 │   出错      │
              └─────────────┘                 └─────────────┘
```

---

## 数据完整性

### 外键约束

```sql
-- Session 删除时级联删除 Message, Part, Todo, Schedule
ON DELETE CASCADE

-- Permission 与 Project 一对一
project_id PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE
```

### 索引策略

```typescript
// Session 表索引
index("session_project_idx").on(table.project_id)
index("session_workspace_idx").on(table.workspace_id)
index("session_parent_idx").on(table.parent_id)

// Message 表索引
index("message_session_time_created_id_idx").on(table.session_id, table.time_created, table.id)

// Part 表索引
index("part_message_id_id_idx").on(table.message_id, table.id)
index("part_session_idx").on(table.session_id)
```

---

## 数据存储位置

```
~/Library/Application Support/opencode/     # macOS
├── opencode.db                              # SQLite 数据库
├── storage/                                 # 文件存储
│   ├── session_diff/                        # Session diff 存储
│   └── migration                            # 迁移版本
└── plans/                                   # 计划文件
```