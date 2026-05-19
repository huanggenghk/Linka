# Linka MCP 协议层退役方案 — 2026-05-19

## 结论

Linka 当前产品主线已经从“活动里的 MCP 人脉工具”转向“微信小程序 + Linka Skill 的 Agent 社交链接层”。本阶段移除 MCP 协议层，不再暴露 `/mcp` Streamable HTTP 端点，也不再依赖 `@modelcontextprotocol/sdk`。

2026-05-20 追加决策：活动 REST API 也已退役。`POST /api/events`、`POST /api/events/join`、`GET /api/events/:event_id/attendees` 不再保留，后续多人场景由微信群聊加入替代。详见 [活动 REST API 退役方案](./2026-05-20-remove-activity-rest-api-design.md)。

邀请页 `/join/:code`、邀请卡片 `/card/:code.png`、统计 `/api/stats` 暂时只作为历史兼容保留。

## 为什么现在移除

1. 当前验证重心是微信身份、Agent 绑定、私聊建联和用户画像维护，这些路径都由小程序或 Skill 调普通 HTTPS API 完成。
2. MCP 配置是额外门槛，会干扰真机测试和微信内闭环验证。
3. 同时维护 MCP tool 和 REST API 会制造重复协议面，测试成本和文档成本都会上升。
4. 2026-05-20 起，活动 REST API 不再作为后续复用基础，多人场景改按微信群聊加入重新设计。

## 范围

移除：

- Hono `/mcp` 路由。
- `@modelcontextprotocol/sdk` 依赖。
- `src/mcp/tools.ts` 里的 `create_event`、`join_event`、`get_attendees` tool 注册。
- MCP JSON-RPC 测试 helper 和 MCP tool 测试。
- 面向用户的 MCP 客户端配置文档。
- 活动 REST API（在 2026-05-20 后续变更中移除）。

保留：

- `users`、`events`、`agents` 三张活动 legacy 表。
- `/join/:code` 活动落地页。
- `/card/:code.png` 邀请卡片生成。
- `/api/stats` 统计接口。

## 测试要求

- `POST /api/events`、`POST /api/events/join`、`GET /api/events/:event_id/attendees` 应返回 404。
- 回归覆盖 `/join/:code` JSON/HTML、`/card/:code.png`、`/api/stats`。
- 保持绑定、真实微信登录、私聊建联、画像更新和 Skill 更新测试不退化。

验证命令：

```bash
pnpm build
pnpm mini:check
pnpm test
```

当前结果以最新测试输出为准。

## 部署影响

部署后 `https://linka.zone/mcp` 应返回 404。Nginx 可保留通用后端代理规则，但文档和产品路径不再承诺 MCP 端点。

线上验证重点：

- `https://linka.zone/health` 返回健康状态。
- `https://linka.zone/api/stats` 返回统计 JSON。
- `https://linka.zone/api/events` 返回 404。
- 小程序仍能完成登录、绑定、分享建联。
- Linka Skill 仍能 claim 绑定码、读取/更新画像。
