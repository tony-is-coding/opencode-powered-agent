# Roadmap: OpenCode Powered Agent v1.0

**Milestone:** v1.0
**Status:** In Progress

---

## Phase 1: P1 Features (COMPLETE)

**Goal:** 完成 P1 级别功能，建立前端增强基础

### Phase 1.1: Skill 管理增强 ✅
- Status: COMPLETE
- Commit: merged via PR #21
- Goal: Skill 详情 API + 前端弹窗展示

### Phase 1.2: Agent 过程展示增强 ✅
- Status: COMPLETE
- Commit: merged via PR #22, #27
- Goal: 工具折叠、token 计数、步骤耗时、错误重试

### Phase 1.3: SSE 连接状态 ✅
- Status: COMPLETE
- Commit: merged via PR #23
- Goal: 连接状态指示器

---

## Phase 2: P2 Features

**Goal:** 文档管理和配置增强

### Phase 2.1: 文档管理 ✅
- Status: COMPLETE (2026-03-26)
- Goal: 文档 CRUD API + 前端 Documents 页面
- Requirements:
  - GET /document — 列出文档
  - GET /document/:path — 读取内容
  - PUT /document/:path — 更新内容
  - POST /document — 创建文档
  - DELETE /document/:path — 删除文档
  - 前端 Documents 页面：文件树 + Markdown 编辑器
- UI hint: yes

### Phase 2.2: 配置管理增强 ✅
- Status: COMPLETE (2026-03-26)
- Goal: 前端配置管理界面
- Requirements:
  - PUT /config/model — 切换默认 model
  - 前端 Settings 页面
- UI hint: yes

---

## Phase 3: P3 Features

**Goal:** 自动化任务调度

### Phase 3.1: 自动化任务调度 ✅
- Status: COMPLETE (2026-03-26)
- Goal: 定时任务调度系统
- Requirements:
  - GET /schedule — 列出任务
  - POST /schedule — 创建任务
  - PUT /schedule/:id — 更新任务
  - DELETE /schedule/:id — 删除任务
  - POST /schedule/:id/trigger — 手动触发
  - 前端 Schedule 页面
  - SQLite 持久化
- UI hint: yes

---

## Progress Summary

| Phase | Name | Status |
|-------|------|--------|
| 1.1 | Skill 管理增强 | ✅ COMPLETE |
| 1.2 | Agent 过程展示增强 | ✅ COMPLETE |
| 1.3 | SSE 连接状态 | ✅ COMPLETE |
| 2.1 | 文档管理 | ✅ COMPLETE |
| 2.2 | 配置管理增强 | ✅ COMPLETE |
| 3.1 | 自动化任务调度 | ✅ COMPLETE |

**Progress:** 6/6 phases complete (100%)
