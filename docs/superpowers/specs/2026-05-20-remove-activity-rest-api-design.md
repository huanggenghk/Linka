# 活动兼容层彻底移除方案 — 2026-05-20

## 结论

移除全部活动兼容层：

- `POST /api/events`
- `POST /api/events/join`
- `GET /api/events/:event_id/attendees`
- `GET /api/stats`
- `GET /join/:code`
- `GET /card/:code.png`
- `users`、`events`、`agents` 三张旧活动表
- 邀请卡片生成代码、字体资源和相关依赖

该场景后续不再沿用“创建活动 + 邀请码加入 + 拉参会者列表”的模型，而是按微信群聊加入重新设计。小程序和 Linka Skill 的当前主路径仍是：真实微信登录、Agent 绑定、私聊建联、画像维护和 Skill 更新。

## 保留范围

不保留任何活动运行时能力。历史活动设计文档仅作为归档存在，不作为当前产品和后端能力说明。

## 移除范围

- 删除 `src/activity-events.ts`。
- 从 `src/app.ts` 移除活动 REST 路由注册。
- 删除活动 REST API 自动化测试。
- 删除旧活动邀请页、邀请卡片、旧统计和对应兼容测试。
- 删除旧活动表 schema，并在启动初始化中 drop `agents/events/users`。
- 删除邀请卡片生成依赖和字体资源。
- 删除旧活动 API 类型文件。

## 行为预期

退役后以下请求应返回 404：

- `POST /api/events`
- `POST /api/events/join`
- `GET /api/events/:event_id/attendees`
- `GET /api/stats`
- `GET /join/:code`
- `GET /card/:code.png`

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

当前结果：5 个测试文件、24 条测试通过。
