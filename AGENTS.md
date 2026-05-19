# Linka

## 项目愿景

Linka 是微信关系链上的 Agent 社交链接层。用户在小程序里绑定自己的 AI 助手，随后通过微信私聊分享和对方建立 Agent 社交边；后续扩展到微信群聊里的连接网络。

核心价值：让用户的 AI 助手接管微信里的社交链接，持续维护画像、关系边和后续连接机会。

## 工程架构

```
微信小程序 / Linka Skill → HTTPS REST API → Hono 后端 → SQLite (Drizzle ORM)
                                      ↑
                          Nginx TLS 反向代理
```

### 技术栈
- **后端**: Hono + TypeScript, Drizzle ORM + SQLite
- **前端**: React 19 + Vite 8, 纯 CSS (无框架)
- **小程序**: 微信原生 TS
- **部署**: 阿里云 ECS (123.56.163.63 / linka.zone), Nginx 反向代理, systemd, Let's Encrypt SSL

### 目录结构
- `src/` — 后端源码 (index.ts 入口, app.ts 路由工厂, db/ 数据库)
- `mini-wx/` — 微信原生 TS 小程序
- `skills/linka/` — Linka Skill：绑定、画像维护、自更新脚本
- `web/src/` — 前端源码 (components/ 下各页面组件)
- `dist/` — 后端编译输出
- `web/dist/` — 前端构建输出
- `docs/deployment.md` — 部署文档

### 数据模型
- **wechat_users**: 微信小程序用户身份
- **wechat_login_sessions**: 小程序登录态
- **binding_sessions**: 一次性 Agent 绑定码
- **agent_bindings**: 微信用户与 Agent 的绑定关系和 token
- **direct_shares / direct_edges**: 私聊分享建联和关系边
- **wechat_user_profiles / wechat_profile_preferences**: 用户画像与自动总结偏好

### 常用命令
- 后端开发: `pnpm dev` / 构建: `pnpm build`
- 前端开发: `cd web && pnpm dev` / 构建: `cd web && npx vite build`
- 测试: `pnpm test` / 小程序类型检查: `pnpm mini:check`
- 测试环境部署: `pnpm deploy:test`
- 生产环境部署: `pnpm deploy:prod`（只能在 `main` 执行）
- 数据库迁移: `pnpm db:push`
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

## 环境与发布流程（强制）

这是项目级关键流程，默认执行：

- 功能分支只能部署到测试环境，禁止直发生产。
- 生产环境只能从 `main` 部署。
- 测试环境：`https://linka.zone/test-api` → `linka-test.service` → `/root/Linka-test` → `/var/lib/linka-test/linka-test.db`。
- 生产环境：`https://linka.zone` → `linka.service` → `/root/Linka` → `/var/lib/linka/linka.db`。
- 标准顺序：功能分支开发 → 更新文档 → `pnpm build` → `pnpm mini:check` → `pnpm test` → `pnpm deploy:test` → CEO 验证 → 合并 `main` → `pnpm deploy:prod`。
- 小程序测试环境验证时，把小程序 API 地址设为 `https://linka.zone/test-api`。
- 任何删表、删除线上 API、token 失效、登录/绑定语义变化，都必须先写方案文档、测试环境验证、生产数据库备份，再部署生产。
- 不允许把未提交、未跟踪、本地 IDE 配置或小程序私有配置带入部署。

详见 `docs/superpowers/specs/2026-05-20-release-environment-flow-design.md` 和 `docs/deployment.md`。

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
