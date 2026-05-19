# 私聊双方建联 MVP 方案 — 2026-05-19

## 结论

在私聊 Agent 绑定 MVP 之后，下一阶段交付“两个已绑定微信号通过小程序建立一条 Agent 社交边”。

发起方不复制链接、不生成外部卡片。发起方在小程序里点“发给好友建联”，小程序使用微信原生 `open-type="share"` 直接发送给好友。后端生成的 `share_id` 只放在小程序分享 path 里，例如 `pages/index/index?share_id=xxx`，对用户不可见。

## 用户流程

1. A 已绑定自己的 Agent。
2. A 在 Linka 小程序里点“发给好友建联”。
3. 小程序调用 `POST /api/direct-shares` 准备内部 `share_id`，然后通过微信原生分享把同一个小程序发给 B。
4. B 从微信私聊打开小程序，页面读取 `share_id`。
5. 小程序调用 `GET /api/direct-shares/:share_id` 展示发起方 Agent 信息。
6. 如果 B 已绑定 Agent，B 点击“确认建联”。
7. 后端调用 `POST /api/direct-shares/:share_id/accept`，创建 A ↔ B 的唯一关系边。
8. A 和 B 都可以通过 `GET /api/direct-edges` 看到这条连接。

## 产品规则

- A 主动分享小程序视为 A 已同意建联。
- B 必须点击确认，才创建关系边。
- 双方都必须已绑定 Agent。
- 不能和自己建联。
- 同一对用户只保留一条边，重复确认返回同一条边。
- 本阶段仍使用 `X-Mock-Wechat-User-Id` 模拟微信身份。

## API

### `POST /api/direct-shares`

小程序调用。要求当前 mock 微信用户已绑定 Agent。

返回：

- `share_id`
- `share_path`
- `initiator_agent_platform`
- `initiator_agent_name`
- `created_at`

### `GET /api/direct-shares/:share_id`

接收方打开小程序后调用。

返回：

- `share_id`
- `initiator_agent_platform`
- `initiator_agent_name`
- `viewer_status`: `self` / `bound` / `unbound`

### `POST /api/direct-shares/:share_id/accept`

接收方确认建联时调用。要求接收方已绑定 Agent。

返回：

- `edge_id`
- `peer_wechat_user_id`
- `peer_agent_platform`
- `peer_agent_name`
- `created_at`

### `GET /api/direct-edges`

返回当前 mock 微信用户已有的私聊 Agent 社交边列表。

## 数据模型

- `direct_shares`: 发起方创建的小程序分享会话。
- `direct_edges`: 两个微信用户之间的长期关系边。用排序后的 `user_a_wechat_user_id + user_b_wechat_user_id` 做唯一索引，保证幂等。

## 后置

- 真实 `wx.login` 替代 mock header。
- Agent 基于双方画像生成连接理由。
- 跟进提醒和关系状态维护。
