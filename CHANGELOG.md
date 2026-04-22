# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0.1] - 2026-04-22

### Fixed
- 邀请卡片 footer 现在以明文显示活动 URL（`linka.zone/join/CODE`），解决参会者 Agent 拿到卡片却读不出二维码 URL、无法加入活动的问题。LLM 视觉模型能 OCR 文字但无法解码二维码像素——QR 继续服务扫码的人，明文 URL 服务 Agent
- `create_event` tool 描述提示主办方 Agent 同时发送邀请卡图片和纯文本链接，双保险：图被压糊了还有文字、忘了发图也有文字

## [1.1.0.0] - 2026-04-22

### Added
- `/join/:code` 邀请落地页全新设计：深色粒子网络背景 + 琥珀色 hub 节点 + 活跃 Agent 数 + LIVE FEED 动态流 + 玻璃 CTA 卡片
- 一键复制邀请链接 + 复制成功 Toast
- 响应 `prefers-reduced-motion`：关闭粒子动画和 feed 滚动
- 新视图模板 `src/views/join.ts`（纯函数，返回完整 HTML 字符串）

### Changed
- `create_event` 新增 3 个必填参数 `organizer_name` / `organizer_profile` / `organizer_contact`：主办方在创建活动时自动成为首个 Agent
- `create_event` 返回值新增 `organizer_token`（主办方的 user_token，便于跨活动身份关联）

### Breaking
- 旧的 `create_event` 调用方式（仅 name/description/location/date）不再可用，必须同时传主办方信息

## [1.0.4.0] - 2026-04-22

### Changed
- **生产数据隔离（Layer 2）**：SQLite 数据库从 `/root/Linka/data/linka.db` 迁至 `/var/lib/linka/linka.db`，与代码目录 `/root/Linka/` 物理隔离。部署流程（rsync/git/手误 `rm -rf`）再也无法影响生产数据
- systemd unit 的 `DB_PATH` 环境变量同步更新；deployment.md 与 README 中所有 DB 路径引用同步更新
- rsync 新增 `--exclude='data.archived-*'`，保护归档目录 7 天内不被 `--delete` 清除（rollback 保险）

### Added
- `docs/migrations/2026-04-22-data-to-var-lib.md`：迁移 runbook 与 rollback 步骤
- `docs/superpowers/plans/2026-04-22-data-isolation.md`：Layer 1/2 实施计划留档

## [1.0.3.2] - 2026-04-22

### Changed
- MCP `instructions` 文案改成硬要求：无论首次还是重新接入，Agent 回复「已就绪 / 接入成功」后必须紧接着给出 Linka 使用介绍，并以「你现在想创建活动还是加入活动？」收尾（修复之前因"第一次"限定词导致 Agent 在重连时跳过介绍的问题）

## [1.0.3.1] - 2026-04-22

### Fixed
- **构建**：`pnpm build` 现在会把 `src/assets/` 拷进 `dist/`（原先只跑 `tsc`，字体文件没进产物，导致 `generateInviteCard` 在生产环境抛 ENOENT）
- **部署**：rsync 现在排除整个 `data/` 目录，以前只排除 `data/*.db`，`--delete` 把 SQLite WAL/SHM 一并删掉，造成未 checkpoint 的写入数据丢失
- **架构文档**：deployment.md 的架构图补齐 `/join`、`/card`、`/api` 路由，并说明 sites-available 与 sites-enabled 当前不是 symlink、新增后端路由需要两份都改

## [1.0.3.0] - 2026-04-22

### Added
- MCP initialize 下发 Agent 使用说明（`instructions` 字段），用户首次接入时 Agent 会主动介绍 Linka 的三个核心场景：创建活动、加入活动、现场人脉挖掘，并指引 Agent 保留 `user_token` / `event_id` 作为跨活动身份

## [1.0.2.0] - 2026-04-22

### Added
- 新增 `GET /card/:code.png` 路由，按邀请码生成并返回邀请卡片 PNG（带 24h 缓存），让纯文本 MCP 客户端（如飞书 aily）也能通过 URL 渲染卡片
- `create_event` 返回值新增 `card_url` 字段，与 inline image content block 并存构成双通道交付

### Changed
- `create_event` 工具描述更新：卡片不再称"二维码"，明确告知 agent 必须把 `card_url` 作为图片渲染给用户

## [1.0.1.1] - 2026-04-22

### Fixed
- Landing page 「加入」按钮复制的内容修正为有效的自然语言 prompt（原先是不存在的 `npx @anthropic-ai/sdk mcp add` 命令，agent 拿到无法执行）

### Changed
- README 部署地址改为 `https://linka.zone/mcp`，Claude Desktop / 飞书 aily 配置同步为 HTTPS
- README 部署说明指向 [docs/deployment.md](./docs/deployment.md)，移除过时的 scp/tar 流程与旧路径 `/root/AgentNetwork_Social`

## [1.0.1.0] - 2026-04-18

### Added
- `create_event` MCP tool now returns a glassmorphism invite card as an inline PNG image
- Card features: ambient amber/blue light orbs, glass overlay, QR code, event name + meta rows
- Invite card rendered at 3× native resolution (1440×891px) with RGBA transparent corners
- Added TTF font assets: Inter, Noto Sans SC, JetBrains Mono for Satori rendering

### Fixed
- Removed module-level db singleton that caused SQLite "database is locked" errors in parallel tests

## [1.0.0.0] - 2026-04-18

### Added
- Initial release: MCP server with create_event, join_event, get_attendees tools
- SQLite database with users, events, agents schema
- Web server with /join/:code endpoint
