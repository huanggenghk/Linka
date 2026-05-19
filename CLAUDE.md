# Linka

## 项目愿景

Linka 是一个 AI Agent 驱动的线下活动社交网络平台。通过 MCP 协议，让参会者的 AI 助手（Codex、飞书 aily 等）具备活动社交能力：自动匹配人脉、跨活动搜索联系人、持续维护社交链接。

核心价值：让每场活动都变成人脉引擎。参会者不用挨个交流就能找到最匹配的人，组织者能自动获得参与者画像分析报告。

## 工程架构

```
用户 AI 助手 → MCP 协议 → Hono 后端 (port 3000) → SQLite (Drizzle ORM)
                                ↑
浏览器 → Nginx → 静态前端 (React/Vite)
```

### 技术栈
- **后端**: Hono + TypeScript, MCP SDK, Drizzle ORM + SQLite
- **前端**: React 19 + Vite 8, 纯 CSS (无框架)
- **部署**: 阿里云 ECS (123.56.163.63 / linka.zone), Nginx 反向代理, systemd, Let's Encrypt SSL

### 目录结构
- `src/` — 后端源码 (index.ts 入口, app.ts 路由+MCP, db/ 数据库, mcp/ 工具定义)
- `web/src/` — 前端源码 (components/ 下各页面组件)
- `dist/` — 后端编译输出
- `web/dist/` — 前端构建输出
- `docs/deployment.md` — 部署文档

### 数据模型
- **users**: 用户 (name, contact_info)
- **events**: 活动 (name, description, location, date, invite_code)
- **agents**: Agent 画像 (event_id, user_id, profile), event+user 唯一索引

### 常用命令
- 后端开发: `npm run dev` / 构建: `npm run build`
- 前端开发: `cd web && pnpm dev` / 构建: `cd web && npx vite build`
- 数据库迁移: `npm run db:push`
- 部署参考: `docs/deployment.md`

## 语言
用中文和用户对话。所有输出、问题、文档都用中文。

## Git 协作机制

任何已经和用户确认固定下来的产品方案、技术方案、架构决策，都必须同步到项目文档并提交到 git，方便其他人接力。

默认做法：
- 产品/技术方案写入 `docs/superpowers/specs/`，文件名使用 `YYYY-MM-DD-主题-design.md`。
- 如果该方案影响项目方向，同步更新 `README.md` 和 `TODOS.md`。
- 如果该方案影响协作规则，同步更新 `CLAUDE.md`。
- 完成文档同步后，只 stage 本次相关文件，提交并推送当前分支。
- 工作区若存在无关未跟踪文件或他人改动，不要自动纳入提交。

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
