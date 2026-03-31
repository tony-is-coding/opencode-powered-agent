# Requirements: OpenCode Powered Agent

**Milestone:** v1.0

## Must Have (P1)

### Skill 管理增强
- [x] GET /skill/:name — 获取单个 skill 详情（含 SKILL.md 内容）
- [x] 前端 Skill 详情弹窗：点击 skill 卡片展示完整描述和 SKILL.md 内容

### Agent 过程展示增强
- [x] 工具调用折叠面板 — 工具输出默认折叠，点击展开
- [x] 实时 token 计数 — 消息级别显示 input/output token 和费用
- [x] Agent 模式指示器 — 当前 session 使用的 agent 模式和 model 显示在 header
- [x] 步骤耗时 — 每个工具调用显示执行耗时
- [x] 错误重试 — 工具调用失败时提供重试按钮

### SSE 连接状态
- [x] 前端显示 SSE 连接状态指示器（connected/reconnecting/disconnected）

## Should Have (P2)

### 文档管理
- [ ] GET /document — 列出项目目录下的文档文件
- [ ] GET /document/:path — 读取文档内容
- [ ] PUT /document/:path — 更新文档内容
- [ ] POST /document — 创建新文档
- [ ] DELETE /document/:path — 删除文档
- [ ] 前端 Documents 页面，文件树 + 编辑器

### 配置管理增强
- [ ] PUT /config/model — 切换默认 model
- [ ] 前端 Settings 页面：默认 model 选择、provider 状态查看

## Nice to Have (P3)

### 自动化任务调度
- [ ] GET /schedule — 列出所有定时任务
- [ ] POST /schedule — 创建定时任务（cron + session 模板）
- [ ] PUT /schedule/:id — 更新定时任务
- [ ] DELETE /schedule/:id — 删除定时任务
- [ ] POST /schedule/:id/trigger — 手动触发一次
- [ ] 前端 Schedule 页面，cron 编辑器

## Non-Goals

- 多 Agent 并行执行
- 修改 opencode core
- 复杂的权限管理系统（复用 core 即可）
