# Linka MCP 协议层退役方案 — 2026-05-19

## 结论

Linka 当前产品主线已经从“活动里的 MCP 人脉工具”转向“微信小程序 + Linka Skill 的 Agent 社交链接层”。本阶段移除 MCP 协议层，不再暴露 `/mcp` Streamable HTTP 端点，也不再依赖 `@modelcontextprotocol/sdk`。

活动人脉 MVP 不删除。它作为 legacy 能力保留，改由 REST API 承载：

- `POST /api/events`: 主办方创建活动，自动把主办方写成首个 Agent。
- `POST /api/events/join`: 参会者通过邀请码加入活动，支持跨活动 `user_token` 和同活动 upsert。
- `GET /api/events/:event_id/attendees`: 获取活动参会者画像和联系方式。

邀请页 `/join/:code`、邀请卡片 `/card/:code.png`、统计 `/api/stats` 保留。

## 为什么现在移除

1. 当前验证重心是微信身份、Agent 绑定、私聊建联和用户画像维护，这些路径都由小程序或 Skill 调普通 HTTPS API 完成。
2. MCP 配置是额外门槛，会干扰真机测试和微信内闭环验证。
3. 同时维护 MCP tool 和 REST API 会制造重复协议面，测试成本和文档成本都会上升。
4. 活动 legacy 能力迁到 REST 后，仍能被 Skill、管理后台或后续小程序复用。

## 范围

移除：

- Hono `/mcp` 路由。
- `@modelcontextprotocol/sdk` 依赖。
- `src/mcp/tools.ts` 里的 `create_event`、`join_event`、`get_attendees` tool 注册。
- MCP JSON-RPC 测试 helper 和 MCP tool 测试。
- 面向用户的 MCP 客户端配置文档。

保留：

- `users`、`events`、`agents` 三张活动 legacy 表。
- `/join/:code` 活动落地页。
- `/card/:code.png` 邀请卡片生成。
- `/api/stats` 统计接口。
- 活动创建、加入、参会者查询的行为语义。

## 迁移映射

| 原 MCP tool | 新 REST API | 说明 |
| --- | --- | --- |
| `create_event` | `POST /api/events` | 返回 `event_id`、`invite_code`、`join_url`、`card_url`、`organizer_token` |
| `join_event` | `POST /api/events/join` | 返回 `event_id`、`event_name`、`agent_id`、`user_token`、`registered_count` |
| `get_attendees` | `GET /api/events/:event_id/attendees` | 返回 `attendees` 数组 |

## 测试要求

- 活动 REST API 覆盖创建活动、主办方自动加入、无效参数、加入活动、无效邀请码、跨活动 token、重复加入 upsert、获取参会者、无效 event_id。
- 回归覆盖 `/join/:code` JSON/HTML、`/card/:code.png`、`/api/stats`。
- 保持绑定、真实微信登录、私聊建联、画像更新和 Skill 更新测试不退化。

验证命令：

```bash
pnpm build
pnpm mini:check
pnpm test
```

当前结果：7 个测试文件、48 条测试通过。

## 部署影响

部署后 `https://linka.zone/mcp` 应返回 404。Nginx 可保留通用后端代理规则，但文档和产品路径不再承诺 MCP 端点。

线上验证重点：

- `https://linka.zone/health` 返回健康状态。
- `https://linka.zone/api/stats` 返回统计 JSON。
- 小程序仍能完成登录、绑定、分享建联。
- Linka Skill 仍能 claim 绑定码、读取/更新画像。
