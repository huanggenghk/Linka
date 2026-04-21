# Changelog

All notable changes to this project will be documented in this file.

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
