# 活动 REST API 退役方案 — 2026-05-20

## 结论

移除活动 legacy REST API：

- `POST /api/events`
- `POST /api/events/join`
- `GET /api/events/:event_id/attendees`

该场景后续不再沿用“创建活动 + 邀请码加入 + 拉参会者列表”的模型，而是按微信群聊加入重新设计。小程序和 Linka Skill 的当前主路径仍是：真实微信登录、Agent 绑定、私聊建联、画像维护和 Skill 更新。

## 保留范围

暂时保留：

- `users`、`events`、`agents` 三张活动 MVP 遗留表。
- `/join/:code` 旧活动邀请页。
- `/card/:code.png` 旧活动邀请卡片。
- `/api/stats` 对旧活动数据的统计兼容。

这些能力只用于历史数据和线上兼容，不再作为产品主路径继续扩展。

## 移除范围

- 删除 `src/activity-events.ts`。
- 从 `src/app.ts` 移除活动 REST 路由注册。
- 删除活动 REST API 自动化测试。
- 测试 helper 不再通过 HTTP 创建或加入活动，改为直接 seed legacy 数据，用于 `/join/:code`、`/card/:code.png` 和 `/api/stats` 兼容测试。
- 删除旧活动 API 类型文件。

## 行为预期

退役后以下请求应返回 404：

- `POST /api/events`
- `POST /api/events/join`
- `GET /api/events/:event_id/attendees`

## 后续方向

多人场景重新进入规划时，入口应从微信群聊开始，而不是复用活动邀请码：

1. 用户在群聊里打开 Linka 小程序。
2. 小程序确认用户微信身份和 Agent 绑定状态。
3. Linka 为群聊生成群上下文和成员连接图。
4. Agent 基于用户授权查询群内可连接对象。

该方向需要单独设计数据模型、授权边界和小程序交互，不和旧活动 API 混用。

## 验证

本次变更需要跑：

```bash
pnpm build
pnpm mini:check
pnpm test
```

当前结果：6 个测试文件、30 条测试通过。
