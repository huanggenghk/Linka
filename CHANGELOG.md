# Changelog

All notable changes to this project will be documented in this file.

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
